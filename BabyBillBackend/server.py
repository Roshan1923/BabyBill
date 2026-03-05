import os
import re
import json
import base64
import httpx
import io
from decimal import Decimal, InvalidOperation
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from azure.ai.formrecognizer import DocumentAnalysisClient
from azure.core.credentials import AzureKeyCredential
from openai import OpenAI
from PIL import Image


load_dotenv()

app = Flask(__name__)
CORS(app)

#-----------------------------------------------------------------------------------------------
# ── Image compression (toggle off when Azure limit increases) ──
COMPRESS_ENABLED = True
COMPRESS_MAX_MB = 3.5
COMPRESS_MAX_DIMENSION = 2500

def compress_image(image_bytes):
    """Compress image for Azure OCR 4MB limit. Set COMPRESS_ENABLED=False to disable."""
    if not COMPRESS_ENABLED:
        return image_bytes
    if len(image_bytes) <= COMPRESS_MAX_MB * 1024 * 1024:
        return image_bytes
    
    print(f"⚠️ Image too large ({len(image_bytes)} bytes), compressing...")
    img = Image.open(io.BytesIO(image_bytes))
    
    if max(img.size) > COMPRESS_MAX_DIMENSION:
        ratio = COMPRESS_MAX_DIMENSION / max(img.size)
        new_size = (int(img.size[0] * ratio), int(img.size[1] * ratio))
        img = img.resize(new_size, Image.LANCZOS)
    
    for quality in [85, 70, 55, 40]:
        buffer = io.BytesIO()
        img.save(buffer, format='JPEG', quality=quality)
        compressed = buffer.getvalue()
        if len(compressed) <= COMPRESS_MAX_MB * 1024 * 1024:
            print(f"✅ Compressed to {len(compressed)} bytes (quality={quality})")
            return compressed
    
    return compressed


#-----------------------------------------------------------------------------------------------
# ── Data sanitization helpers ──

def to_money(val, default="0.00"):
    """Safely convert any value to a decimal money string. Handles GPT weirdness."""
    if val is None:
        return str(Decimal(default))
    if isinstance(val, (int, float, Decimal)):
        return str(Decimal(str(val)).quantize(Decimal("0.01")))
    if isinstance(val, str):
        cleaned = val.strip().replace(",", "").replace("$", "").replace("₹", "").replace("CAD", "").replace("INR", "")
        try:
            return str(Decimal(cleaned).quantize(Decimal("0.01")))
        except InvalidOperation:
            return str(Decimal(default))
    return str(Decimal(default))


def clean_last_four(val):
    """Validate last four digits. Returns exactly 4 digits or None."""
    if not val:
        return None
    s = str(val).strip()
    return s if re.fullmatch(r"\d{4}", s) else None


def normalize_rpc_uuid(result):
    """Normalize Supabase RPC response to a UUID string or None.
    Handles scalar, list, or dict responses."""
    if not result:
        return None
    # Scalar uuid as string
    if isinstance(result, str):
        return result
    # List of rows
    if isinstance(result, list) and len(result) > 0:
        row = result[0]
        if isinstance(row, str):
            return row
        if isinstance(row, dict):
            return row.get("id") or row.get("payment_method_id")
    # Single row dict
    if isinstance(result, dict):
        return result.get("id") or result.get("payment_method_id")
    return None


#-----------------------------------------------------------------------------------------------
# --- Clients ---
azure_client = DocumentAnalysisClient(
    endpoint=os.getenv("AZURE_ENDPOINT"),
    credential=AzureKeyCredential(os.getenv("AZURE_KEY"))
)

openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# HTTP timeout for all Supabase calls (seconds)
HTTP_TIMEOUT = 15.0

# Fallback categories if fetching user categories fails
DEFAULT_CATEGORIES = ["Food", "Bills", "Gas", "Shopping", "Medical", "Other"]


#-----------------------------------------------------------------------------------------------
# ── Fetch user categories ──

def fetch_user_categories(user_id):
    """Fetch the user's categories from the user_categories table."""
    try:
        response = httpx.get(
            f"{SUPABASE_URL}/rest/v1/user_categories",
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type": "application/json",
            },
            params={
                "user_id": f"eq.{user_id}",
                "select": "name",
            },
            timeout=HTTP_TIMEOUT,
        )

        if response.status_code == 200:
            categories = response.json()
            if categories and len(categories) > 0:
                names = [cat["name"] for cat in categories]
                print(f"📂 Fetched {len(names)} categories for user: {', '.join(names)}")
                return names

        print(f"⚠️ Could not fetch user categories (status {response.status_code}), using defaults")
        return DEFAULT_CATEGORIES

    except Exception as e:
        print(f"⚠️ Error fetching user categories: {str(e)}, using defaults")
        return DEFAULT_CATEGORIES


#-----------------------------------------------------------------------------------------------
# ── OCR + GPT ──

def ocr_receipt(image_bytes):
    """Send image to Azure Document Intelligence and get raw text."""
    poller = azure_client.begin_analyze_document(
        "prebuilt-receipt", image_bytes
    )
    result = poller.result()

    raw_text = ""
    for page in result.pages:
        for line in page.lines:
            raw_text += line.content + "\n"

    return raw_text


def extract_with_gpt(raw_text, category_names=None):
    """Send raw OCR text to GPT and get structured receipt data with payment details."""
    if category_names is None:
        category_names = DEFAULT_CATEGORIES

    category_list = ", ".join(category_names)

    response = openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": f"""You are a financial document parser. Extract structured data from document text.
Return ONLY valid JSON with this exact format:
{{
    "store_name": "Store Name",
    "date": "YYYY-MM-DD",
    "subtotal": "0.00",
    "tax": "0.00",
    "discount": "0.00",
    "total_amount": "0.00",
    "payment_method": "Visa ending 4521",
    "category": "one of the categories listed below",
    "document_type": "receipt",
    "direction": "outgoing",
    "payment_status": "paid",
    "items": [
        {{"name": "Item name", "price": "0.00", "quantity": 1}}
    ],
    "payment_details": {{
        "methods": [
            {{
                "line_index": 0,
                "raw_type": "credit",
                "raw_network": "visa",
                "raw_last_four": "4521",
                "raw_text": "VISA ************4521 AUTH:087234",
                "amount": "45.67",
                "auth_code": "087234",
                "is_contactless": false
            }}
        ],
        "payment_total": "45.67"
    }}
}}

EXISTING FIELD RULES:
- total_amount: FINAL amount paid (after tax, after discounts). Look for "TOTAL", "AMOUNT DUE".
- subtotal: Amount BEFORE tax. Look for "SUBTOTAL", "SUB-TOTAL".
- tax: Tax amount. Look for "TAX", "HST", "GST", "PST".
- discount: Any discounts applied. "0.00" if none.
- items: Extract ALL line items with prices.
- category: Pick best match from: {category_list}. If none fit well, use "Other".
- If you can't determine a field, use "Unknown" for strings and "0.00" for amounts.

DOCUMENT TYPE DETECTION:
- "receipt" = proof of purchase from a store/restaurant/service (most common)
- "bill" = demand for payment like hydro, phone, internet, insurance
- "invoice" = formal payment request from contractor/business
- "payment_confirmation" = proof that money was sent (e-transfer, bank confirmation)
- "government" = tax notice, property tax, CRA document

DIRECTION:
- "outgoing" = you spent money (most receipts, bills you pay)
- "incoming" = you received money (refund, payment to you)
- "internal" = transfer between own accounts

PAYMENT STATUS:
- "paid" = money already exchanged (most receipts)
- "unpaid" = amount owing, not yet paid (bills, invoices)
- "scheduled" = payment set up but not happened yet (pre-authorized debit mentioned)
- "refunded" = this is a refund/return

PAYMENT DETAILS — THIS IS CRITICAL:
Look at the BOTTOM of the receipt for payment information.
Extract EVERY payment method line separately (for split payments).

raw_type — pick the closest:
- "credit" = credit card (Visa, Mastercard, Amex)
- "debit" = debit card, Interac
- "cash" = cash payment
- "gift_card" = gift card, store gift card
- "store_credit" = store credit applied
- "loyalty_points" = points/rewards redeemed (PC Optimum, Aeroplan, Scene+, etc.)
- "upi" = UPI payment
- "e_transfer" = Interac e-Transfer
- "pad" = pre-authorized debit
- "cheque" = cheque
- "paypal" = PayPal
- "other" = anything else

raw_network — when it's a card:
- "visa", "mastercard", "amex", "interac", "discover", "rupay"
- null if not a card (cash, gift card, UPI, etc.)

raw_last_four:
- Last 4 digits of card. Look for ****4521, ************4521, XXXX4521
- null if no card number (cash, some gift cards)

is_contactless:
- true if receipt says "CONTACTLESS", "TAP", "NFC", or "CL"
- false otherwise

auth_code:
- Authorization code or reference number if present
- null if not found

SPLIT PAYMENTS:
- Multiple payment methods = one entry per method in the methods array
- Each gets its own line_index (0, 1, 2...)
- Each gets the amount paid via that method
- payment_total = sum of all method amounts

CASH:
- raw_type="cash", amount = purchase total (NOT tendered amount)
- Put full text in raw_text (e.g., "CASH TENDERED: $20.00 CHANGE: $1.47")

NO PAYMENT INFO FOUND:
- Return empty: "payment_details": {{"methods": [], "payment_total": "0.00"}}

BACKWARD COMPATIBILITY:
- Always fill "payment_method" as a simple string too (e.g., "Visa ending 4521", "Cash", "Debit")"""
            },
            {
                "role": "user",
                "content": f"Extract data from this document:\n\n{raw_text}"
            }
        ],
        temperature=0.1,
    )

    reply = response.choices[0].message.content.strip()

    # Clean markdown code blocks if present
    if reply.startswith("```"):
        reply = reply.split("\n", 1)[1]
        reply = reply.rsplit("```", 1)[0]

    parsed = json.loads(reply)

    # Ensure payment_details exists with correct structure
    if "payment_details" not in parsed:
        parsed["payment_details"] = {"methods": [], "payment_total": "0.00"}
    if "methods" not in parsed["payment_details"]:
        parsed["payment_details"]["methods"] = []
    if "payment_total" not in parsed["payment_details"]:
        parsed["payment_details"]["payment_total"] = "0.00"

    # Ensure document fields have defaults
    parsed.setdefault("document_type", "receipt")
    parsed.setdefault("direction", "outgoing")
    parsed.setdefault("payment_status", "paid")

    return parsed


def check_duplicate(user_id, store_name, date, total_amount):
    """Check if a duplicate receipt already exists for this user."""
    params = {
        "user_id": f"eq.{user_id}",
        "store_name": f"eq.{store_name}",
        "date": f"eq.{date}",
        "total_amount": f"eq.{total_amount}",
    }

    response = httpx.get(
        f"{SUPABASE_URL}/rest/v1/receipts",
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
        },
        params=params,
        timeout=HTTP_TIMEOUT,
    )

    if response.status_code == 200:
        results = response.json()
        return len(results) > 0
    return False


#-----------------------------------------------------------------------------------------------
# ── Payment method matching ──

def auto_match_payment_method(user_id, last_four):
    """Find a matching saved payment method for this user by last four digits.
    Uses the find_payment_method SQL function created in Supabase.
    Returns the payment_method UUID string or None."""
    if not last_four:
        return None

    try:
        response = httpx.post(
            f"{SUPABASE_URL}/rest/v1/rpc/find_payment_method",
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "p_user_id": user_id,
                "p_last_four": last_four,
            },
            timeout=HTTP_TIMEOUT,
        )

        if response.status_code == 200:
            return normalize_rpc_uuid(response.json())
        return None
    except Exception as e:
        print(f"⚠️ Auto-match error: {str(e)}")
        return None


def save_receipt_payments(receipt_id, user_id, payment_details):
    """Save payment details to the receipt_payments table.
    Batch inserts all payment legs in one request."""
    methods = payment_details.get("methods", [])

    if not methods:
        print("ℹ️ No payment methods detected on this document")
        return True

    rows = []
    for method in methods:
        # Validate and clean last four
        last_four = clean_last_four(method.get("raw_last_four"))

        # Try to auto-match to a saved payment method
        matched_id = auto_match_payment_method(user_id, last_four)

        if matched_id:
            print(f"  ✅ Auto-matched ****{last_four} → saved payment method")

        rows.append({
            "receipt_id": receipt_id,
            "payment_method_id": matched_id,
            "line_index": int(method.get("line_index", 0) or 0),
            "raw_type": method.get("raw_type"),
            "raw_network": method.get("raw_network"),
            "raw_last_four": last_four,
            "raw_text": method.get("raw_text"),
            "amount": to_money(method.get("amount")),
            "auth_code": method.get("auth_code"),
            "is_contactless": bool(method.get("is_contactless", False)),
        })

    # Batch insert all payment legs in one request
    response = httpx.post(
        f"{SUPABASE_URL}/rest/v1/receipt_payments",
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        json=rows,
        timeout=HTTP_TIMEOUT,
    )

    if response.status_code not in [200, 201, 204]:
        print(f"⚠️ Failed to save receipt_payments batch: {response.status_code} - {response.text}")
        return False

    print(f"💳 Saved {len(rows)} payment line(s) for receipt")
    return True


#-----------------------------------------------------------------------------------------------
# ── Save to Supabase ──

def save_to_supabase(receipt_data, image_url, user_id, image_hash=None):
    """Save extracted receipt data to Supabase (receipts + receipt_payments)."""
    row = {
        "user_id": user_id,
        "store_name": receipt_data.get("store_name", "Unknown"),
        "date": receipt_data.get("date", "Unknown"),
        "subtotal": to_money(receipt_data.get("subtotal")),
        "tax": to_money(receipt_data.get("tax")),
        "discount": to_money(receipt_data.get("discount")),
        "total_amount": to_money(receipt_data.get("total_amount")),
        "payment_method": receipt_data.get("payment_method", "Unknown"),  # legacy field kept
        "category": receipt_data.get("category", "Other"),
        "items": receipt_data.get("items", []),
        "raw_text": receipt_data.get("raw_text", ""),
        "image_url": image_url,
        "status": "completed",
        # New fields
        "document_type": receipt_data.get("document_type", "receipt"),
        "direction": receipt_data.get("direction", "outgoing"),
        "payment_status": receipt_data.get("payment_status", "paid"),
    }

    # Include image_hash if provided
    if image_hash:
        row["image_hash"] = image_hash

    response = httpx.post(
        f"{SUPABASE_URL}/rest/v1/receipts",
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
        json=row,
        timeout=HTTP_TIMEOUT,
    )

    if response.status_code in [200, 201]:
        saved_receipt = response.json()
        receipt_record = saved_receipt[0] if isinstance(saved_receipt, list) else saved_receipt
        receipt_id = receipt_record["id"]

        # Save payment details to receipt_payments table
        payment_details = receipt_data.get("payment_details", {"methods": [], "payment_total": "0.00"})
        save_receipt_payments(receipt_id, user_id, payment_details)

        return saved_receipt
    else:
        print(f"Supabase error: {response.status_code} - {response.text}")
        return None


def upload_image_to_supabase(image_bytes, filename):
    """Upload receipt image to Supabase storage."""
    response = httpx.post(
        f"{SUPABASE_URL}/storage/v1/object/receipt-images/{filename}",
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "image/jpeg",
        },
        content=image_bytes,
        timeout=20.0,  # image uploads can be slower
    )

    if response.status_code in [200, 201]:
        return f"receipt-images/{filename}"
    else:
        print(f"Upload error: {response.status_code} - {response.text}")
        return None


#-----------------------------------------------------------------------------------------------
# ── API Routes ──

@app.route("/process-receipt", methods=["POST"])
def process_receipt():
    """Main endpoint: receives image, runs OCR + GPT, saves to Supabase."""
    try:
        if "image" not in request.files:
            return jsonify({"error": "No image provided"}), 400

        user_id = request.form.get("user_id")
        if not user_id:
            return jsonify({"error": "No user_id provided"}), 400

        force_save = request.form.get("force_save", "false") == "true"

        # Get image hash from frontend (for storage)
        image_hash = request.form.get("image_hash")

        image_file = request.files["image"]
        image_bytes = image_file.read()
        image_bytes = compress_image(image_bytes)  # Compress for Azure 4MB limit
        filename = f"receipt_{int(__import__('time').time())}.jpg"

        print(f"📸 Received image: {len(image_bytes)} bytes")
        print(f"👤 User ID: {user_id}")
        if image_hash:
            print(f"🔑 Image hash: {image_hash}")

        # Step 1: Upload image to Supabase Storage
        print("☁️ Uploading image to Supabase...")
        image_path = upload_image_to_supabase(image_bytes, filename)
        if not image_path:
            return jsonify({"error": "Failed to upload image"}), 500

        # Step 2: Fetch user's categories for GPT prompt
        print("📂 Fetching user categories...")
        user_categories = fetch_user_categories(user_id)

        # Step 3: Run Azure OCR
        print("🔍 Running Azure OCR...")
        raw_text = ocr_receipt(image_bytes)
        print(f"📝 OCR extracted {len(raw_text)} characters")

        # Step 4: Extract structured data with GPT (using user's categories)
        print("🤖 Extracting data with GPT...")
        receipt_data = extract_with_gpt(raw_text, user_categories)
        receipt_data["raw_text"] = raw_text
        print(f"✅ Extracted: {receipt_data.get('store_name')} - ${receipt_data.get('total_amount')}")
        print(f"   📄 Type: {receipt_data.get('document_type')} | Direction: {receipt_data.get('direction')} | Status: {receipt_data.get('payment_status')}")

        # Log payment details
        payment_details = receipt_data.get("payment_details", {})
        methods = payment_details.get("methods", [])
        if methods:
            for m in methods:
                network = m.get('raw_network', '') or ''
                last4 = m.get('raw_last_four', 'N/A') or 'N/A'
                contactless = ' (contactless)' if m.get('is_contactless') else ''
                print(f"   💳 {m.get('raw_type')} {network} ****{last4} ${m.get('amount')}{contactless}")
        else:
            print(f"   💳 Legacy: {receipt_data.get('payment_method', 'Unknown')}")

        # Step 5: Check for duplicates (unless force_save)
        if not force_save:
            is_duplicate = check_duplicate(
                user_id,
                receipt_data.get("store_name", "Unknown"),
                receipt_data.get("date", "Unknown"),
                to_money(receipt_data.get("total_amount")),
            )

            if is_duplicate:
                print("⚠️ Duplicate receipt detected!")
                return jsonify({
                    "success": False,
                    "duplicate": True,
                    "receipt_data": receipt_data,
                    "image_path": image_path,
                    "message": "Duplicate receipt detected",
                }), 200

        # Step 6: Save to Supabase Database (receipts + receipt_payments)
        print("💾 Saving to Supabase...")
        saved = save_to_supabase(receipt_data, image_path, user_id, image_hash)

        if saved:
            print("🎉 Receipt processed successfully!")
            return jsonify({
                "success": True,
                "receipt": saved[0] if isinstance(saved, list) else saved,
            }), 200
        else:
            return jsonify({"error": "Failed to save to database"}), 500

    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route("/force-save-receipt", methods=["POST"])
def force_save_receipt():
    """Save a receipt that was flagged as duplicate (user chose Save Anyway)."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        user_id = data.get("user_id")
        receipt_data = data.get("receipt_data")
        image_path = data.get("image_path")
        image_hash = data.get("image_hash")

        if not user_id or not receipt_data:
            return jsonify({"error": "Missing required fields"}), 400

        print(f"💾 Force saving duplicate receipt for user: {user_id}")
        saved = save_to_supabase(receipt_data, image_path, user_id, image_hash)

        if saved:
            print("🎉 Duplicate receipt force-saved successfully!")
            return jsonify({
                "success": True,
                "receipt": saved[0] if isinstance(saved, list) else saved,
            }), 200
        else:
            return jsonify({"error": "Failed to save to database"}), 500

    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok", "message": "BillBrain Backend is running!"})


if __name__ == "__main__":
    print("🚀 Starting BillBrain Backend Server...")
    app.run(host="0.0.0.0", port=5000, debug=True)