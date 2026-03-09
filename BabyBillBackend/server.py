import os
import re
import json
import uuid
import httpx
import io
import base64
from datetime import datetime, timezone, timedelta
from decimal import Decimal, InvalidOperation
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from azure.ai.formrecognizer import DocumentAnalysisClient
from azure.core.credentials import AzureKeyCredential
from openai import OpenAI
from PIL import Image
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build


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
    """Normalize Supabase RPC response to a UUID string or None."""
    if not result:
        return None
    if isinstance(result, str):
        return result
    if isinstance(result, list) and len(result) > 0:
        row = result[0]
        if isinstance(row, str):
            return row
        if isinstance(row, dict):
            return row.get("id") or row.get("payment_method_id")
    if isinstance(result, dict):
        return result.get("id") or result.get("payment_method_id")
    return None


def is_valid_uuid(val):
    """Check if a string is a valid UUID."""
    try:
        uuid.UUID(str(val))
        return True
    except (ValueError, AttributeError):
        return False


def _ms_to_iso(ms):
    """Convert milliseconds timestamp to ISO 8601 string."""
    try:
        dt = datetime.fromtimestamp(int(ms) / 1000, tz=timezone.utc)
        return dt.isoformat()
    except Exception:
        return None


#-----------------------------------------------------------------------------------------------
# --- Clients ---
azure_client = DocumentAnalysisClient(
    endpoint=os.getenv("AZURE_ENDPOINT"),
    credential=AzureKeyCredential(os.getenv("AZURE_KEY"))
)

openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# RevenueCat webhook secret (set in Render env vars)
RC_WEBHOOK_SECRET = os.getenv("RC_WEBHOOK_SECRET")

# Google OAuth credentials (set in Render env vars)
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")

# HTTP timeout for all Supabase calls (seconds)
HTTP_TIMEOUT = 15.0

# Fallback categories if fetching user categories fails
DEFAULT_CATEGORIES = ["Food", "Bills", "Gas", "Shopping", "Medical", "Other"]

# RevenueCat product ID → tier and credit limit mapping
RC_PRODUCT_MAP = {
    "billbrain_essential_monthly": {"tier": "essential", "sub_limit": 100},
    "billbrain_premium_monthly": {"tier": "premium", "sub_limit": 250},
}

# RevenueCat top-up product ID → credit amount mapping
RC_TOPUP_MAP = {
    "billbrain_topup_25": 25,
    "billbrain_topup_50": 50,
    "billbrain_topup_100": 100,
}

# ── Supabase header helpers ──

def service_headers():
    """Headers for server-side DB/storage/RPC calls (full access, bypasses RLS)."""
    return {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
    }


def auth_verify_headers(user_token):
    """Headers for verifying a user's JWT via Supabase Auth API."""
    return {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {user_token}",
    }


#-----------------------------------------------------------------------------------------------
# ── Auth: Verify Supabase JWT ──

def verify_supabase_token(req):
    """Verify the Supabase JWT by calling Supabase's auth API.
    Returns (user_id, None) on success, or (None, error_message) on failure."""
    auth_header = req.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None, "Missing or invalid Authorization header"

    token = auth_header.split("Bearer ")[1]

    try:
        response = httpx.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers=auth_verify_headers(token),
            timeout=HTTP_TIMEOUT,
        )

        if response.status_code == 200:
            user_data = response.json()
            user_id = user_data.get("id")
            if user_id:
                return user_id, None
            return None, "No user ID in token response"
        else:
            print(f"⚠️ Token verification failed: {response.status_code} - {response.text}")
            return None, "Invalid or expired token"

    except Exception as e:
        print(f"⚠️ Token verification error: {str(e)}")
        return None, "Token verification failed"


#-----------------------------------------------------------------------------------------------
# ── Credits: Consume / Refund / Balance / Top-up ──

def consume_credit(user_id):
    """Call the consume_credit RPC. Returns the result dict including charged_bucket."""
    try:
        response = httpx.post(
            f"{SUPABASE_URL}/rest/v1/rpc/consume_credit",
            headers=service_headers(),
            json={"p_user_id": user_id},
            timeout=HTTP_TIMEOUT,
        )

        if response.status_code == 200:
            return response.json()
        else:
            print(f"⚠️ consume_credit RPC error: {response.status_code} - {response.text}")
            return {"success": False, "error": "CREDIT_CHECK_FAILED"}

    except Exception as e:
        print(f"⚠️ consume_credit error: {str(e)}")
        return {"success": False, "error": "CREDIT_CHECK_FAILED"}


def refund_credit(user_id, bucket):
    """Call the refund_credit RPC with the specific bucket to refund to."""
    if bucket == "unlimited":
        return {"success": True}

    try:
        response = httpx.post(
            f"{SUPABASE_URL}/rest/v1/rpc/refund_credit",
            headers=service_headers(),
            json={"p_user_id": user_id, "p_bucket": bucket},
            timeout=HTTP_TIMEOUT,
        )

        if response.status_code == 200:
            result = response.json()
            print(f"🔄 Credit refunded to '{bucket}' bucket for user {user_id}")
            return result
        else:
            print(f"⚠️ refund_credit RPC error: {response.status_code} - {response.text}")
            return None

    except Exception as e:
        print(f"⚠️ refund_credit error: {str(e)}")
        return None


def add_topup(user_id, amount):
    """Call the add_topup RPC to atomically add top-up credits."""
    try:
        response = httpx.post(
            f"{SUPABASE_URL}/rest/v1/rpc/add_topup",
            headers=service_headers(),
            json={"p_user_id": user_id, "p_amount": amount},
            timeout=HTTP_TIMEOUT,
        )

        if response.status_code == 200:
            return response.json()
        else:
            print(f"⚠️ add_topup RPC error: {response.status_code} - {response.text}")
            return {"success": False, "error": "TOPUP_FAILED"}

    except Exception as e:
        print(f"⚠️ add_topup error: {str(e)}")
        return {"success": False, "error": "TOPUP_FAILED"}


def get_credit_balance(user_id):
    """Call the get_credit_balance RPC."""
    try:
        response = httpx.post(
            f"{SUPABASE_URL}/rest/v1/rpc/get_credit_balance",
            headers=service_headers(),
            json={"p_user_id": user_id},
            timeout=HTTP_TIMEOUT,
        )

        if response.status_code == 200:
            return response.json()
        else:
            print(f"⚠️ get_credit_balance RPC error: {response.status_code} - {response.text}")
            return None

    except Exception as e:
        print(f"⚠️ get_credit_balance error: {str(e)}")
        return None


def build_credits_response(credit_result):
    """Build a standardized credits object for API responses."""
    return {
        "tier": credit_result.get("tier"),
        "is_active": credit_result.get("is_active"),
        "free_remaining": credit_result.get("free_remaining"),
        "sub_remaining": credit_result.get("sub_remaining"),
        "sub_limit": credit_result.get("sub_limit"),
        "topup_remaining": credit_result.get("topup_remaining"),
        "sub_period_end": credit_result.get("sub_period_end"),
    }


#-----------------------------------------------------------------------------------------------
# ── RevenueCat Webhook Helpers ──

def verify_rc_webhook(req):
    """Verify RevenueCat webhook authenticity via Authorization header."""
    auth_header = req.headers.get("Authorization")
    if not auth_header or not RC_WEBHOOK_SECRET:
        return False
    expected = f"Bearer {RC_WEBHOOK_SECRET}"
    return auth_header == expected


def try_store_webhook_event(event_id, event_type, rc_app_user_id, user_id, payload):
    """Attempt to insert webhook event BEFORE processing.
    Returns True if inserted (new event), False if already exists (duplicate)."""
    try:
        response = httpx.post(
            f"{SUPABASE_URL}/rest/v1/webhook_events",
            headers={**service_headers(), "Prefer": "return=minimal"},
            json={
                "event_id": event_id,
                "event_type": event_type,
                "rc_app_user_id": rc_app_user_id,
                "user_id": user_id,
                "payload": payload,
            },
            timeout=HTTP_TIMEOUT,
        )

        if response.status_code in [200, 201, 204]:
            return True
        elif response.status_code == 409:
            return False
        else:
            body = response.text or ""
            if "duplicate" in body.lower() or "unique" in body.lower() or "23505" in body:
                return False
            print(f"⚠️ Unexpected webhook_events insert status: {response.status_code} - {body}")
            return False

    except Exception as e:
        print(f"⚠️ Failed to store webhook event: {str(e)}")
        return False


def update_user_credits(user_id, updates):
    """Update user_credits row with the given fields."""
    try:
        response = httpx.patch(
            f"{SUPABASE_URL}/rest/v1/user_credits",
            headers={**service_headers(), "Prefer": "return=minimal"},
            params={"user_id": f"eq.{user_id}"},
            json=updates,
            timeout=HTTP_TIMEOUT,
        )
        if response.status_code not in [200, 204]:
            print(f"⚠️ update_user_credits failed: {response.status_code} - {response.text}")
            return False
        return True
    except Exception as e:
        print(f"⚠️ update_user_credits error: {str(e)}")
        return False


#-----------------------------------------------------------------------------------------------
# ── Fetch user categories ──

def fetch_user_categories(user_id):
    """Fetch the user's categories from the user_categories table."""
    try:
        response = httpx.get(
            f"{SUPABASE_URL}/rest/v1/user_categories",
            headers=service_headers(),
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
- "scheduled" = payment set up but not happened yet
- "refunded" = this is a refund/return

PAYMENT DETAILS — THIS IS CRITICAL:
Look at the BOTTOM of the receipt for payment information.
Extract EVERY payment method line separately (for split payments).

raw_type options: "credit", "debit", "cash", "gift_card", "store_credit", "loyalty_points", "upi", "e_transfer", "pad", "cheque", "paypal", "other"
raw_network options: "visa", "mastercard", "amex", "interac", "discover", "rupay", null
raw_last_four: Last 4 digits of card or null
is_contactless: true if receipt says "CONTACTLESS", "TAP", "NFC", or "CL"
auth_code: Authorization code if present or null

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

    if reply.startswith("```"):
        reply = reply.split("\n", 1)[1]
        reply = reply.rsplit("```", 1)[0]

    parsed = json.loads(reply)

    if "payment_details" not in parsed:
        parsed["payment_details"] = {"methods": [], "payment_total": "0.00"}
    if "methods" not in parsed["payment_details"]:
        parsed["payment_details"]["methods"] = []
    if "payment_total" not in parsed["payment_details"]:
        parsed["payment_details"]["payment_total"] = "0.00"

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
        headers=service_headers(),
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
    """Find a matching saved payment method for this user by last four digits."""
    if not last_four:
        return None

    try:
        response = httpx.post(
            f"{SUPABASE_URL}/rest/v1/rpc/find_payment_method",
            headers=service_headers(),
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
    """Save payment details to the receipt_payments table."""
    methods = payment_details.get("methods", [])

    if not methods:
        print("ℹ️ No payment methods detected on this document")
        return True

    rows = []
    for method in methods:
        last_four = clean_last_four(method.get("raw_last_four"))
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

    response = httpx.post(
        f"{SUPABASE_URL}/rest/v1/receipt_payments",
        headers={**service_headers(), "Prefer": "return=minimal"},
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
        "payment_method": receipt_data.get("payment_method", "Unknown"),
        "category": receipt_data.get("category", "Other"),
        "items": receipt_data.get("items", []),
        "raw_text": receipt_data.get("raw_text", ""),
        "image_url": image_url,
        "status": "completed",
        "document_type": receipt_data.get("document_type", "receipt"),
        "direction": receipt_data.get("direction", "outgoing"),
        "payment_status": receipt_data.get("payment_status", "paid"),
    }

    if image_hash:
        row["image_hash"] = image_hash

    response = httpx.post(
        f"{SUPABASE_URL}/rest/v1/receipts",
        headers={**service_headers(), "Prefer": "return=representation"},
        json=row,
        timeout=HTTP_TIMEOUT,
    )

    if response.status_code in [200, 201]:
        saved_receipt = response.json()
        receipt_record = saved_receipt[0] if isinstance(saved_receipt, list) else saved_receipt
        receipt_id = receipt_record["id"]

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
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "Content-Type": "image/jpeg",
        },
        content=image_bytes,
        timeout=20.0,
    )

    if response.status_code in [200, 201]:
        return f"receipt-images/{filename}"
    else:
        print(f"Upload error: {response.status_code} - {response.text}")
        return None


#-----------------------------------------------------------------------------------------------
# ── Gmail Helpers ──

def get_gmail_credentials(conn_data):
    """Build Google OAuth Credentials from stored token data and refresh if expired."""
    creds = Credentials(
        token=conn_data['access_token'],
        refresh_token=conn_data.get('refresh_token'),
        token_uri='https://oauth2.googleapis.com/token',
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
    )

    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        # Save refreshed token back to Supabase
        httpx.patch(
            f"{SUPABASE_URL}/rest/v1/gmail_connections",
            headers={**service_headers(), "Prefer": "return=minimal"},
            params={"user_id": f"eq.{conn_data['user_id']}"},
            json={
                "access_token": creds.token,
                "token_expiry": creds.expiry.isoformat() if creds.expiry else None,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
            timeout=HTTP_TIMEOUT,
        )

    return creds


def extract_email_text(full_msg):
    """Extract plain text or HTML body from a Gmail message."""
    try:
        payload = full_msg.get('payload', {})
        parts = payload.get('parts', [])

        if not parts:
            body_data = payload.get('body', {}).get('data', '')
            if body_data:
                return base64.urlsafe_b64decode(body_data).decode('utf-8', errors='ignore')

        # Prefer plain text
        for part in parts:
            if part.get('mimeType') == 'text/plain':
                body_data = part.get('body', {}).get('data', '')
                if body_data:
                    return base64.urlsafe_b64decode(body_data).decode('utf-8', errors='ignore')

        # Recurse into multipart
        for part in parts:
            if part.get('mimeType', '').startswith('multipart/'):
                sub_parts = part.get('parts', [])
                for sp in sub_parts:
                    if sp.get('mimeType') == 'text/plain':
                        body_data = sp.get('body', {}).get('data', '')
                        if body_data:
                            return base64.urlsafe_b64decode(body_data).decode('utf-8', errors='ignore')

        # Fallback to HTML
        for part in parts:
            if part.get('mimeType') == 'text/html':
                body_data = part.get('body', {}).get('data', '')
                if body_data:
                    return base64.urlsafe_b64decode(body_data).decode('utf-8', errors='ignore')

        return None
    except Exception as e:
        print(f"⚠️ Email text extraction error: {e}")
        return None


def get_email_header(full_msg, header_name):
    """Get a specific header value from a Gmail message."""
    headers = full_msg.get('payload', {}).get('headers', [])
    for h in headers:
        if h.get('name', '').lower() == header_name.lower():
            return h.get('value', '')
    return ''


def extract_receipt_from_email(email_text, subject, from_addr):
    """Use GPT to determine if email is a receipt and extract structured data.
    Returns dict if receipt found, None if not a receipt."""
    try:
        truncated = email_text[:3000]

        prompt = f"""You are analyzing an email to determine if it contains a receipt, order confirmation, invoice, or any record of a financial transaction.

Email Subject: {subject}
From: {from_addr}
Email Content:
{truncated}

If this email contains a receipt, order confirmation, invoice, or financial transaction, extract the data and respond with ONLY a JSON object:
{{
  "is_receipt": true,
  "store_name": "Store name",
  "total_amount": 49.99,
  "date": "2024-01-15",
  "currency": "CAD",
  "category": "Shopping",
  "items": [
    {{"name": "Item name", "price": 49.99, "quantity": 1}}
  ]
}}

If this is NOT a receipt or financial transaction (newsletter, promotion, marketing, general email), respond with ONLY:
{{"is_receipt": false}}

Rules:
- Only return true for actual transactions where money was spent or will be spent
- Promotional emails showing prices are NOT receipts
- Shipping notifications without totals are NOT receipts
- Respond with JSON only. No explanation."""

        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=500,
        )

        raw = response.choices[0].message.content.strip()
        raw = raw.replace('```json', '').replace('```', '').strip()
        data = json.loads(raw)

        if not data.get('is_receipt'):
            return None

        return data

    except Exception as e:
        print(f"⚠️ GPT email extraction error: {e}")
        return None


def get_gmail_connection(user_id):
    """Fetch stored Gmail connection for a user from Supabase."""
    try:
        response = httpx.get(
            f"{SUPABASE_URL}/rest/v1/gmail_connections",
            headers=service_headers(),
            params={
                "user_id": f"eq.{user_id}",
                "limit": "1",
            },
            timeout=HTTP_TIMEOUT,
        )
        if response.status_code == 200:
            data = response.json()
            return data[0] if data else None
        return None
    except Exception as e:
        print(f"⚠️ get_gmail_connection error: {e}")
        return None


#-----------------------------------------------------------------------------------------------
# ── API Routes ──

@app.route("/process-receipt", methods=["POST"])
def process_receipt():
    """Main endpoint: receives image, runs OCR + GPT, saves to Supabase."""
    credit_consumed = False
    charged_bucket = None
    user_id = None

    try:
        if "image" not in request.files:
            return jsonify({"error": "No image provided"}), 400

        user_id, auth_error = verify_supabase_token(request)
        if not user_id:
            return jsonify({"error": auth_error or "Authentication required"}), 401

        force_save = request.form.get("force_save", "false") == "true"
        image_hash = request.form.get("image_hash")

        image_file = request.files["image"]
        image_bytes = image_file.read()
        image_bytes = compress_image(image_bytes)
        filename = f"receipt_{int(__import__('time').time())}.jpg"

        print(f"📸 Received image: {len(image_bytes)} bytes")
        print(f"👤 User ID: {user_id}")
        if image_hash:
            print(f"🔑 Image hash: {image_hash}")

        print("💳 Checking credits...")
        credit_result = consume_credit(user_id)

        if not credit_result.get("success"):
            error_code = credit_result.get("error", "CREDIT_CHECK_FAILED")
            print(f"🚫 Credit check failed: {error_code}")
            return jsonify({
                "error": error_code,
                "credits": build_credits_response(credit_result),
            }), 403

        credit_consumed = True
        charged_bucket = credit_result.get("charged_bucket", "unknown")
        print(f"✅ Credit consumed from '{charged_bucket}' bucket")

        print("☁️ Uploading image to Supabase...")
        image_path = upload_image_to_supabase(image_bytes, filename)
        if not image_path:
            raise SystemError("Failed to upload image to storage")

        print("📂 Fetching user categories...")
        user_categories = fetch_user_categories(user_id)

        print("🔍 Running Azure OCR...")
        raw_text = ocr_receipt(image_bytes)
        print(f"📝 OCR extracted {len(raw_text)} characters")

        print("🤖 Extracting data with GPT...")
        receipt_data = extract_with_gpt(raw_text, user_categories)
        receipt_data["raw_text"] = raw_text
        print(f"✅ Extracted: {receipt_data.get('store_name')} - ${receipt_data.get('total_amount')}")
        print(f"   📄 Type: {receipt_data.get('document_type')} | Direction: {receipt_data.get('direction')} | Status: {receipt_data.get('payment_status')}")

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

        if not force_save:
            is_duplicate = check_duplicate(
                user_id,
                receipt_data.get("store_name", "Unknown"),
                receipt_data.get("date", "Unknown"),
                to_money(receipt_data.get("total_amount")),
            )

            if is_duplicate:
                print("⚠️ Duplicate receipt detected! (credit still charged)")
                return jsonify({
                    "success": False,
                    "duplicate": True,
                    "receipt_data": receipt_data,
                    "image_path": image_path,
                    "message": "Duplicate receipt detected",
                    "credits": build_credits_response(credit_result),
                }), 200

        print("💾 Saving to Supabase...")
        saved = save_to_supabase(receipt_data, image_path, user_id, image_hash)

        if saved:
            print("🎉 Receipt processed successfully!")
            return jsonify({
                "success": True,
                "receipt": saved[0] if isinstance(saved, list) else saved,
                "credits": build_credits_response(credit_result),
            }), 200
        else:
            raise SystemError("Failed to save receipt to database")

    except SystemError as e:
        print(f"❌ System error (refunding credit): {str(e)}")
        if credit_consumed and user_id and charged_bucket:
            refund_credit(user_id, charged_bucket)
        return jsonify({"error": str(e)}), 500

    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")
        if credit_consumed and user_id and charged_bucket:
            refund_credit(user_id, charged_bucket)
            print(f"🔄 Credit refunded to '{charged_bucket}' due to unexpected error")
        return jsonify({"error": str(e)}), 500


@app.route("/force-save-receipt", methods=["POST"])
def force_save_receipt():
    """Save a receipt that was flagged as duplicate (user chose Save Anyway).
    Does NOT consume a credit — the original /process-receipt already charged one."""
    try:
        user_id, auth_error = verify_supabase_token(request)
        if not user_id:
            return jsonify({"error": auth_error or "Authentication required"}), 401

        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        receipt_data = data.get("receipt_data")
        image_path = data.get("image_path")
        image_hash = data.get("image_hash")

        if not receipt_data:
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


@app.route("/credits/balance", methods=["GET"])
def credits_balance():
    """Return the current credit balance for the authenticated user."""
    user_id, auth_error = verify_supabase_token(request)
    if not user_id:
        return jsonify({"error": auth_error or "Authentication required"}), 401

    balance = get_credit_balance(user_id)
    if balance and balance.get("success"):
        return jsonify(balance), 200
    else:
        return jsonify({"error": "Could not fetch credit balance"}), 500


#-----------------------------------------------------------------------------------------------
# ── Gmail Routes ──

@app.route("/gmail/connect", methods=["POST"])
def gmail_connect():
    """Exchange server_auth_code for Gmail OAuth tokens and save them."""
    try:
        user_id, auth_error = verify_supabase_token(request)
        if not user_id:
            return jsonify({"error": auth_error or "Authentication required"}), 401

        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        server_auth_code = data.get('server_auth_code')
        gmail_email = data.get('email')

        if not server_auth_code:
            return jsonify({"error": "server_auth_code is required"}), 400

        # Exchange auth code for access + refresh tokens
        token_response = httpx.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": server_auth_code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": "",  # empty string for mobile serverAuthCode flow
                "grant_type": "authorization_code",
            },
            timeout=HTTP_TIMEOUT,
        )

        if token_response.status_code != 200:
            print(f"❌ Token exchange failed: {token_response.status_code} - {token_response.text}")
            return jsonify({"error": "Failed to exchange auth code with Google"}), 400

        tokens = token_response.json()
        access_token = tokens.get("access_token")
        refresh_token = tokens.get("refresh_token")
        expires_in = tokens.get("expires_in", 3600)
        token_expiry = (datetime.now(timezone.utc) + timedelta(seconds=expires_in)).isoformat()

        if not access_token:
            return jsonify({"error": "No access token returned from Google"}), 400

        # Fetch email from Google if not provided
        if not gmail_email:
            try:
                userinfo_res = httpx.get(
                    "https://www.googleapis.com/oauth2/v2/userinfo",
                    headers={"Authorization": f"Bearer {access_token}"},
                    timeout=HTTP_TIMEOUT,
                )
                if userinfo_res.status_code == 200:
                    gmail_email = userinfo_res.json().get("email")
            except Exception:
                pass

        # Upsert into Supabase
        response = httpx.post(
            f"{SUPABASE_URL}/rest/v1/gmail_connections",
            headers={**service_headers(), "Prefer": "resolution=merge-duplicates,return=minimal"},
            json={
                "user_id": user_id,
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_expiry": token_expiry,
                "email": gmail_email,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
            timeout=HTTP_TIMEOUT,
        )

        if response.status_code in [200, 201, 204]:
            print(f"✅ Gmail connected for user {user_id} ({gmail_email})")
            return jsonify({"success": True, "email": gmail_email})
        else:
            print(f"⚠️ Gmail connect save error: {response.status_code} - {response.text}")
            return jsonify({"error": "Failed to save Gmail connection"}), 500

    except Exception as e:
        print(f"❌ gmail_connect error: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route("/gmail/status", methods=["GET"])
def gmail_status():
    """Check if Gmail is connected for the authenticated user."""
    try:
        user_id, auth_error = verify_supabase_token(request)
        if not user_id:
            return jsonify({"error": auth_error or "Authentication required"}), 401

        conn = get_gmail_connection(user_id)
        if conn:
            return jsonify({
                "connected": True,
                "email": conn.get("email"),
            })
        return jsonify({"connected": False})

    except Exception as e:
        print(f"❌ gmail_status error: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route("/gmail/disconnect", methods=["POST"])
def gmail_disconnect():
    """Remove Gmail connection for the authenticated user."""
    try:
        user_id, auth_error = verify_supabase_token(request)
        if not user_id:
            return jsonify({"error": auth_error or "Authentication required"}), 401

        response = httpx.delete(
            f"{SUPABASE_URL}/rest/v1/gmail_connections",
            headers={**service_headers(), "Prefer": "return=minimal"},
            params={"user_id": f"eq.{user_id}"},
            timeout=HTTP_TIMEOUT,
        )

        print(f"🔌 Gmail disconnected for user {user_id}")
        return jsonify({"success": True})

    except Exception as e:
        print(f"❌ gmail_disconnect error: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route("/gmail/scan-range", methods=["POST"])
def gmail_scan_range():
    """Scan Gmail for receipt emails within a date range."""
    try:
        user_id, auth_error = verify_supabase_token(request)
        if not user_id:
            return jsonify({"error": auth_error or "Authentication required"}), 401

        data = request.get_json()
        start_date = data.get('start_date')  # format: "2024/01/01"
        end_date = data.get('end_date')      # format: "2024/12/31"

        if not start_date or not end_date:
            return jsonify({"error": "start_date and end_date are required"}), 400

        # Get stored Gmail connection
        conn = get_gmail_connection(user_id)
        if not conn:
            return jsonify({"error": "Gmail not connected"}), 400

        # Build credentials and refresh if needed
        creds = get_gmail_credentials(conn)
        service = build('gmail', 'v1', credentials=creds)

        # Search query — spending-related emails only
        query = (
            f"after:{start_date} before:{end_date} "
            f"(subject:receipt OR subject:order OR subject:invoice OR "
            f"subject:confirmation OR subject:payment OR subject:\"order confirmation\" "
            f"OR subject:\"your receipt\" OR subject:\"purchase confirmation\")"
        )

        print(f"📧 Scanning Gmail for user {user_id} from {start_date} to {end_date}")

        results = service.users().messages().list(
            userId='me',
            q=query,
            maxResults=100
        ).execute()

        messages = results.get('messages', [])
        print(f"📬 Found {len(messages)} candidate emails")

        detected = []
        skipped_duplicate = 0
        skipped_not_receipt = 0

        for msg in messages:
            msg_id = msg['id']

            # Skip already processed emails
            existing_response = httpx.get(
                f"{SUPABASE_URL}/rest/v1/email_receipts",
                headers=service_headers(),
                params={
                    "user_id": f"eq.{user_id}",
                    "gmail_message_id": f"eq.{msg_id}",
                    "limit": "1",
                },
                timeout=HTTP_TIMEOUT,
            )

            if existing_response.status_code == 200 and existing_response.json():
                skipped_duplicate += 1
                continue

            # Fetch full email content
            try:
                full_msg = service.users().messages().get(
                    userId='me',
                    id=msg_id,
                    format='full'
                ).execute()
            except Exception as e:
                print(f"⚠️ Failed to fetch message {msg_id}: {e}")
                continue

            email_text = extract_email_text(full_msg)
            subject = get_email_header(full_msg, 'Subject')
            from_addr = get_email_header(full_msg, 'From')

            if not email_text:
                skipped_not_receipt += 1
                continue

            # Ask GPT: is this a receipt?
            receipt_data = extract_receipt_from_email(email_text, subject, from_addr)

            if not receipt_data:
                skipped_not_receipt += 1
                continue

            # Save to email_receipts table as pending
            save_response = httpx.post(
                f"{SUPABASE_URL}/rest/v1/email_receipts",
                headers={**service_headers(), "Prefer": "return=representation"},
                json={
                    "user_id": user_id,
                    "gmail_message_id": msg_id,
                    "store_name": receipt_data.get('store_name'),
                    "total_amount": float(receipt_data.get('total_amount', 0)),
                    "date": receipt_data.get('date'),
                    "currency": receipt_data.get('currency', 'CAD'),
                    "category": receipt_data.get('category'),
                    "items": receipt_data.get('items', []),
                    "raw_subject": subject,
                    "raw_from": from_addr,
                    "status": "pending",
                },
                timeout=HTTP_TIMEOUT,
            )

            if save_response.status_code in [200, 201]:
                saved = save_response.json()
                detected.append(saved[0] if isinstance(saved, list) else saved)
                print(f"  ✅ Receipt found: {receipt_data.get('store_name')} ${receipt_data.get('total_amount')}")
            else:
                print(f"  ⚠️ Failed to save email receipt: {save_response.status_code}")

        print(f"📊 Scan complete: {len(detected)} receipts found, {skipped_not_receipt} not receipts, {skipped_duplicate} already processed")

        return jsonify({
            "success": True,
            "detected": detected,
            "count": len(detected),
            "scanned": len(messages),
        })

    except Exception as e:
        print(f"❌ gmail_scan_range error: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route("/gmail/pending", methods=["GET"])
def gmail_pending():
    """Get all pending email receipts waiting for user approval."""
    try:
        user_id, auth_error = verify_supabase_token(request)
        if not user_id:
            return jsonify({"error": auth_error or "Authentication required"}), 401

        response = httpx.get(
            f"{SUPABASE_URL}/rest/v1/email_receipts",
            headers=service_headers(),
            params={
                "user_id": f"eq.{user_id}",
                "status": "eq.pending",
                "order": "created_at.desc",
            },
            timeout=HTTP_TIMEOUT,
        )

        if response.status_code == 200:
            return jsonify({"success": True, "receipts": response.json()})
        return jsonify({"error": "Failed to fetch pending receipts"}), 500

    except Exception as e:
        print(f"❌ gmail_pending error: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route("/gmail/approve", methods=["POST"])
def gmail_approve():
    """User approved an email receipt — save it to the main receipts table."""
    try:
        user_id, auth_error = verify_supabase_token(request)
        if not user_id:
            return jsonify({"error": auth_error or "Authentication required"}), 401

        data = request.get_json()
        email_receipt_id = data.get('email_receipt_id')

        if not email_receipt_id:
            return jsonify({"error": "email_receipt_id is required"}), 400

        # Fetch the pending email receipt
        fetch_response = httpx.get(
            f"{SUPABASE_URL}/rest/v1/email_receipts",
            headers=service_headers(),
            params={
                "id": f"eq.{email_receipt_id}",
                "user_id": f"eq.{user_id}",
                "limit": "1",
            },
            timeout=HTTP_TIMEOUT,
        )

        if fetch_response.status_code != 200 or not fetch_response.json():
            return jsonify({"error": "Email receipt not found"}), 404

        er = fetch_response.json()[0]

        # Insert into main receipts table
        receipt_response = httpx.post(
            f"{SUPABASE_URL}/rest/v1/receipts",
            headers={**service_headers(), "Prefer": "return=representation"},
            json={
                "user_id": user_id,
                "store_name": er.get('store_name', 'Unknown'),
                "date": er.get('date'),
                "total_amount": str(er.get('total_amount', '0.00')),
                "subtotal": "0.00",
                "tax": "0.00",
                "discount": "0.00",
                "payment_method": "Unknown",
                "category": er.get('category', 'Other'),
                "items": er.get('items', []),
                "raw_text": "",
                "image_url": None,
                "status": "completed",
                "document_type": "receipt",
                "direction": "outgoing",
                "payment_status": "paid",
                "source": "email",
            },
            timeout=HTTP_TIMEOUT,
        )

        if receipt_response.status_code not in [200, 201]:
            return jsonify({"error": "Failed to save receipt"}), 500

        saved_receipt = receipt_response.json()
        receipt = saved_receipt[0] if isinstance(saved_receipt, list) else saved_receipt

        # Mark email receipt as approved
        httpx.patch(
            f"{SUPABASE_URL}/rest/v1/email_receipts",
            headers={**service_headers(), "Prefer": "return=minimal"},
            params={"id": f"eq.{email_receipt_id}"},
            json={"status": "approved"},
            timeout=HTTP_TIMEOUT,
        )

        print(f"✅ Email receipt approved: {er.get('store_name')} ${er.get('total_amount')}")
        return jsonify({"success": True, "receipt": receipt})

    except Exception as e:
        print(f"❌ gmail_approve error: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route("/gmail/dismiss", methods=["POST"])
def gmail_dismiss():
    """User dismissed an email receipt — mark it as rejected."""
    try:
        user_id, auth_error = verify_supabase_token(request)
        if not user_id:
            return jsonify({"error": auth_error or "Authentication required"}), 401

        data = request.get_json()
        email_receipt_id = data.get('email_receipt_id')

        if not email_receipt_id:
            return jsonify({"error": "email_receipt_id is required"}), 400

        httpx.patch(
            f"{SUPABASE_URL}/rest/v1/email_receipts",
            headers={**service_headers(), "Prefer": "return=minimal"},
            params={
                "id": f"eq.{email_receipt_id}",
                "user_id": f"eq.{user_id}",
            },
            json={"status": "rejected"},
            timeout=HTTP_TIMEOUT,
        )

        return jsonify({"success": True})

    except Exception as e:
        print(f"❌ gmail_dismiss error: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route("/gmail/webhook", methods=["POST"])
def gmail_webhook():
    """Receive Google Pub/Sub push notifications for new emails."""
    try:
        envelope = request.get_json()
        if not envelope:
            return 'OK', 200

        pubsub_message = envelope.get('message', {})
        data = pubsub_message.get('data', '')

        if not data:
            return 'OK', 200

        decoded = base64.b64decode(data).decode('utf-8')
        notification = json.loads(decoded)
        email_address = notification.get('emailAddress')
        history_id = notification.get('historyId')

        print(f"📨 Gmail webhook: new email for {email_address} (historyId: {history_id})")

        # Find the user by their Gmail address
        conn_response = httpx.get(
            f"{SUPABASE_URL}/rest/v1/gmail_connections",
            headers=service_headers(),
            params={
                "email": f"eq.{email_address}",
                "limit": "1",
            },
            timeout=HTTP_TIMEOUT,
        )

        if conn_response.status_code != 200 or not conn_response.json():
            print(f"⚠️ No user found for Gmail {email_address}")
            return 'OK', 200

        conn = conn_response.json()[0]
        user_id = conn['user_id']

        # Get credentials
        creds = get_gmail_credentials(conn)
        service = build('gmail', 'v1', credentials=creds)

        # Get history since last known historyId
        last_history_id = conn.get('watch_history_id')

        if not last_history_id:
            # First webhook — just save historyId and wait for next one
            httpx.patch(
                f"{SUPABASE_URL}/rest/v1/gmail_connections",
                headers={**service_headers(), "Prefer": "return=minimal"},
                params={"user_id": f"eq.{user_id}"},
                json={"watch_history_id": str(history_id)},
                timeout=HTTP_TIMEOUT,
            )
            return 'OK', 200

        # Fetch new messages since last historyId
        try:
            history_response = service.users().history().list(
                userId='me',
                startHistoryId=last_history_id,
                historyTypes=['messageAdded'],
            ).execute()
        except Exception as e:
            print(f"⚠️ History fetch error: {e}")
            return 'OK', 200

        history_records = history_response.get('history', [])
        new_message_ids = []

        for record in history_records:
            for msg_added in record.get('messagesAdded', []):
                new_message_ids.append(msg_added['message']['id'])

        print(f"📬 {len(new_message_ids)} new message(s) to check")

        for msg_id in new_message_ids:
            # Skip already processed
            existing = httpx.get(
                f"{SUPABASE_URL}/rest/v1/email_receipts",
                headers=service_headers(),
                params={
                    "user_id": f"eq.{user_id}",
                    "gmail_message_id": f"eq.{msg_id}",
                    "limit": "1",
                },
                timeout=HTTP_TIMEOUT,
            )

            if existing.status_code == 200 and existing.json():
                continue

            # Fetch full message
            try:
                full_msg = service.users().messages().get(
                    userId='me',
                    id=msg_id,
                    format='full'
                ).execute()
            except Exception as e:
                print(f"⚠️ Failed to fetch message {msg_id}: {e}")
                continue

            email_text = extract_email_text(full_msg)
            subject = get_email_header(full_msg, 'Subject')
            from_addr = get_email_header(full_msg, 'From')

            if not email_text:
                continue

            receipt_data = extract_receipt_from_email(email_text, subject, from_addr)

            if not receipt_data:
                print(f"  ⏭️ Not a receipt: {subject}")
                continue

            # Save as pending
            httpx.post(
                f"{SUPABASE_URL}/rest/v1/email_receipts",
                headers={**service_headers(), "Prefer": "return=minimal"},
                json={
                    "user_id": user_id,
                    "gmail_message_id": msg_id,
                    "store_name": receipt_data.get('store_name'),
                    "total_amount": float(receipt_data.get('total_amount', 0)),
                    "date": receipt_data.get('date'),
                    "currency": receipt_data.get('currency', 'CAD'),
                    "category": receipt_data.get('category'),
                    "items": receipt_data.get('items', []),
                    "raw_subject": subject,
                    "raw_from": from_addr,
                    "status": "pending",
                },
                timeout=HTTP_TIMEOUT,
            )

            print(f"  ✅ New receipt detected: {receipt_data.get('store_name')} ${receipt_data.get('total_amount')}")
            # TODO: Send push notification to user via FCM here

        # Update watch_history_id to latest
        httpx.patch(
            f"{SUPABASE_URL}/rest/v1/gmail_connections",
            headers={**service_headers(), "Prefer": "return=minimal"},
            params={"user_id": f"eq.{user_id}"},
            json={"watch_history_id": str(history_id)},
            timeout=HTTP_TIMEOUT,
        )

        return 'OK', 200

    except Exception as e:
        print(f"❌ gmail_webhook error: {str(e)}")
        return 'OK', 200  # Always return 200 to Google


#-----------------------------------------------------------------------------------------------
# ── RevenueCat Webhook ──

@app.route("/billing/revenuecat/webhook", methods=["POST"])
def revenuecat_webhook():
    """Handle RevenueCat webhook events for subscriptions and top-ups."""

    if not verify_rc_webhook(request):
        print("🚫 Webhook auth failed — rejected")
        return jsonify({"error": "Unauthorized"}), 401

    payload = request.get_json()
    if not payload or "event" not in payload:
        return jsonify({"error": "Invalid payload"}), 400

    event = payload["event"]
    event_type = event.get("type", "UNKNOWN")
    event_id = event.get("id")
    rc_app_user_id = event.get("app_user_id")

    print(f"📨 RevenueCat webhook: {event_type} | rc_user: {rc_app_user_id} | event_id: {event_id}")

    if not rc_app_user_id or not is_valid_uuid(rc_app_user_id):
        print(f"⚠️ Ignoring event — app_user_id is not a valid UUID: {rc_app_user_id}")
        return jsonify({"status": "ignored_anonymous_user"}), 200

    user_id = rc_app_user_id

    if not event_id:
        print(f"⚠️ No event_id in webhook — cannot guarantee idempotency, skipping")
        return jsonify({"status": "skipped_no_event_id"}), 200

    is_new = try_store_webhook_event(event_id, event_type, rc_app_user_id, user_id, payload)
    if not is_new:
        print(f"⏭️ Event {event_id} already processed or storage failed — skipping")
        return jsonify({"status": "already_processed"}), 200

    product_id = event.get("product_id", "")
    sub_period_start = _ms_to_iso(event.get("purchased_at_ms"))
    sub_period_end = _ms_to_iso(event.get("expiration_at_ms"))

    try:
        if event_type in ("INITIAL_PURCHASE", "RENEWAL"):
            product_info = RC_PRODUCT_MAP.get(product_id)
            if product_info:
                tier = product_info["tier"]
                sub_limit = product_info["sub_limit"]
                updates = {
                    "tier": tier,
                    "is_active": True,
                    "sub_limit": sub_limit,
                    "sub_remaining": sub_limit,
                    "cancel_at_period_end": False,
                    "rc_customer_id": rc_app_user_id,
                }
                if sub_period_start:
                    updates["sub_period_start"] = sub_period_start
                if sub_period_end:
                    updates["sub_period_end"] = sub_period_end
                update_user_credits(user_id, updates)
                print(f"✅ {event_type}: user {user_id} → {tier} ({sub_limit} credits)")
            else:
                print(f"⚠️ Unknown product_id: {product_id}")

        elif event_type == "PRODUCT_CHANGE":
            product_info = RC_PRODUCT_MAP.get(product_id)
            if product_info:
                tier = product_info["tier"]
                sub_limit = product_info["sub_limit"]
                updates = {
                    "tier": tier,
                    "is_active": True,
                    "sub_limit": sub_limit,
                    "sub_remaining": sub_limit,
                    "cancel_at_period_end": False,
                }
                if sub_period_start:
                    updates["sub_period_start"] = sub_period_start
                if sub_period_end:
                    updates["sub_period_end"] = sub_period_end
                update_user_credits(user_id, updates)
                print(f"✅ PRODUCT_CHANGE: user {user_id} → {tier} ({sub_limit} credits)")
            else:
                print(f"⚠️ Unknown product_id for change: {product_id}")

        elif event_type == "CANCELLATION":
            update_user_credits(user_id, {"cancel_at_period_end": True})
            print(f"⚠️ CANCELLATION: user {user_id} will not renew")

        elif event_type == "UNCANCELLATION":
            update_user_credits(user_id, {"cancel_at_period_end": False})
            print(f"✅ UNCANCELLATION: user {user_id} re-enabled auto-renew")

        elif event_type == "EXPIRATION":
            update_user_credits(user_id, {
                "tier": "free",
                "is_active": False,
                "sub_remaining": 0,
                "sub_limit": 0,
                "sub_period_start": None,
                "sub_period_end": None,
                "cancel_at_period_end": False,
            })
            print(f"⚠️ EXPIRATION: user {user_id} → free tier")

        elif event_type == "NON_RENEWING_PURCHASE":
            topup_amount = RC_TOPUP_MAP.get(product_id, 0)
            if topup_amount > 0:
                result = add_topup(user_id, topup_amount)
                if result.get("success"):
                    print(f"✅ TOP-UP: user {user_id} +{topup_amount} credits")
                else:
                    print(f"⚠️ Top-up RPC failed for user {user_id}: {result.get('error')}")
            else:
                print(f"⚠️ Unknown top-up product_id: {product_id}")

        elif event_type == "BILLING_ISSUE":
            print(f"ℹ️ BILLING_ISSUE: user {user_id} — payment retry in progress")

        elif event_type == "SUBSCRIPTION_PAUSED":
            print(f"ℹ️ SUBSCRIPTION_PAUSED: user {user_id}")

        else:
            print(f"ℹ️ Unhandled event type: {event_type}")

    except Exception as e:
        print(f"❌ Webhook processing error for {event_type}: {str(e)}")
        return jsonify({"status": "error_logged"}), 200

    return jsonify({"status": "ok"}), 200


@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok", "message": "BillBrain Backend is running!"})


if __name__ == "__main__":
    print("🚀 Starting BillBrain Backend Server...")
    app.run(host="0.0.0.0", port=5000, debug=True)
