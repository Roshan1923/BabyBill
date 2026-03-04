import os
import json
import base64
import httpx
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from azure.ai.formrecognizer import DocumentAnalysisClient
from azure.core.credentials import AzureKeyCredential
from openai import OpenAI

load_dotenv()

app = Flask(__name__)
CORS(app)

# --- Clients ---
azure_client = DocumentAnalysisClient(
    endpoint=os.getenv("AZURE_ENDPOINT"),
    credential=AzureKeyCredential(os.getenv("AZURE_KEY"))
)

openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Fallback categories if fetching user categories fails
DEFAULT_CATEGORIES = ["Food", "Bills", "Gas", "Shopping", "Medical", "Other"]


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
    """Send raw OCR text to GPT and get structured receipt data."""
    if category_names is None:
        category_names = DEFAULT_CATEGORIES

    category_list = ", ".join(category_names)

    response = openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": f"""You are a receipt parser. Extract structured data from receipt text.
Return ONLY valid JSON with this exact format:
{{
    "store_name": "Store Name",
    "date": "YYYY-MM-DD",
    "subtotal": "0.00",
    "tax": "0.00",
    "discount": "0.00",
    "total_amount": "0.00",
    "payment_method": "Cash|Credit Card|Debit Card|Unknown",
    "category": "one of the categories listed below",
    "items": [
        {{"name": "Item name", "price": "0.00", "quantity": 1}}
    ]
}}
If you can't determine a field, use "Unknown" for strings and "0.00" for amounts.
For category, pick the best match from: {category_list}. If none fit well, use "Other".
For payment_method, look for keywords like VISA, Mastercard, AMEX, Debit, Cash, etc. If found, use the appropriate type. If unclear, use "Unknown"."""
            },
            {
                "role": "user",
                "content": f"Extract receipt data from this text:\n\n{raw_text}"
            }
        ],
        temperature=0.1,
    )

    reply = response.choices[0].message.content.strip()

    # Clean markdown code blocks if present
    if reply.startswith("```"):
        reply = reply.split("\n", 1)[1]
        reply = reply.rsplit("```", 1)[0]

    return json.loads(reply)


def check_duplicate(user_id, store_name, date, total_amount):
    """Check if a duplicate receipt already exists for this user (by content)."""
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
    )

    if response.status_code == 200:
        results = response.json()
        return len(results) > 0
    return False


def save_to_supabase(receipt_data, image_url, user_id, image_hash=None):
    """Save extracted receipt data to Supabase."""
    row = {
        "user_id": user_id,
        "store_name": receipt_data.get("store_name", "Unknown"),
        "date": receipt_data.get("date", "Unknown"),
        "subtotal": receipt_data.get("subtotal", "0.00"),
        "tax": receipt_data.get("tax", "0.00"),
        "discount": receipt_data.get("discount", "0.00"),
        "total_amount": receipt_data.get("total_amount", "0.00"),
        "payment_method": receipt_data.get("payment_method", "Unknown"),
        "category": receipt_data.get("category", "Other"),
        "items": receipt_data.get("items", []),
        "raw_text": receipt_data.get("raw_text", ""),
        "image_url": image_url,
        "status": "completed",
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
    )

    if response.status_code in [200, 201]:
        return response.json()
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
    )

    if response.status_code in [200, 201]:
        return f"receipt-images/{filename}"
    else:
        print(f"Upload error: {response.status_code} - {response.text}")
        return None


@app.route("/process-receipt", methods=["POST"])
def process_receipt():
    """Main endpoint: receives image, runs OCR + GPT, saves to Supabase."""
    try:
        # Get image from request
        if "image" not in request.files:
            return jsonify({"error": "No image provided"}), 400

        # Get user_id from request
        user_id = request.form.get("user_id")
        if not user_id:
            return jsonify({"error": "No user_id provided"}), 400

        # Check if this is a forced save (bypass duplicate check)
        force_save = request.form.get("force_save", "false") == "true"

        # Get image hash from frontend (for storage)
        image_hash = request.form.get("image_hash")

        image_file = request.files["image"]
        image_bytes = image_file.read()
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
        print(f"✅ Extracted: {receipt_data.get('store_name')} - ${receipt_data.get('total_amount')} [{receipt_data.get('category')}]")

        # Step 5: Check for duplicates (unless force_save)
        if not force_save:
            is_duplicate = check_duplicate(
                user_id,
                receipt_data.get("store_name", "Unknown"),
                receipt_data.get("date", "Unknown"),
                receipt_data.get("total_amount", "0.00"),
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

        # Step 6: Save to Supabase Database (with image_hash)
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
    return jsonify({"status": "ok", "message": "BabyBill Backend is running!"})


if __name__ == "__main__":
    print("🚀 Starting BabyBill Backend Server...")
    app.run(host="0.0.0.0", port=5000, debug=True)
