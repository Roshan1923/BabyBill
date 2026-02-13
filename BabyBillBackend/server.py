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


def extract_with_gpt(raw_text):
    """Send raw OCR text to GPT and get structured receipt data."""
    response = openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": """You are a receipt parser. Extract structured data from receipt text.
Return ONLY valid JSON with this exact format:
{
    "store_name": "Store Name",
    "date": "YYYY-MM-DD",
    "total_amount": "0.00",
    "category": "Food|Bills|Gas|Shopping|Medical|Other",
    "items": [
        {"name": "Item name", "price": "0.00", "quantity": 1}
    ]
}
If you can't determine a field, use "Unknown" for strings and "0.00" for amounts.
For category, pick the best match from: Food, Bills, Gas, Shopping, Medical, Other."""
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


def save_to_supabase(receipt_data, image_url):
    """Save extracted receipt data to Supabase."""
    row = {
        "store_name": receipt_data.get("store_name", "Unknown"),
        "date": receipt_data.get("date", "Unknown"),
        "total_amount": receipt_data.get("total_amount", "0.00"),
        "category": receipt_data.get("category", "Other"),
        "items": receipt_data.get("items", []),
        "raw_text": receipt_data.get("raw_text", ""),
        "image_url": image_url,
        "status": "completed",
    }

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
        # Return the path (not full URL since bucket is private)
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

        image_file = request.files["image"]
        image_bytes = image_file.read()
        filename = f"receipt_{int(__import__('time').time())}.jpg"

        print(f"📸 Received image: {len(image_bytes)} bytes")

        # Step 1: Upload image to Supabase Storage
        print("☁️ Uploading image to Supabase...")
        image_path = upload_image_to_supabase(image_bytes, filename)
        if not image_path:
            return jsonify({"error": "Failed to upload image"}), 500

        # Step 2: Run Azure OCR
        print("🔍 Running Azure OCR...")
        raw_text = ocr_receipt(image_bytes)
        print(f"📝 OCR extracted {len(raw_text)} characters")

        # Step 3: Extract structured data with GPT
        print("🤖 Extracting data with GPT...")
        receipt_data = extract_with_gpt(raw_text)
        receipt_data["raw_text"] = raw_text
        print(f"✅ Extracted: {receipt_data.get('store_name')} - ${receipt_data.get('total_amount')}")

        # Step 4: Save to Supabase Database
        print("💾 Saving to Supabase...")
        saved = save_to_supabase(receipt_data, image_path)

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


@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok", "message": "BabyBill Backend is running!"})


if __name__ == "__main__":
    print("🚀 Starting BabyBill Backend Server...")
    app.run(host="0.0.0.0", port=5000, debug=True)
