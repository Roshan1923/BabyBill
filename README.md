# 🧾 BabyBill

A mobile receipt scanning app that uses AI to turn paper receipts into searchable digital data.

**Snap a photo → AI reads it → structured data saved → search it anytime.**

---

## How It Works

```
📱 Phone Camera → ☁️ Upload → 🔍 Azure OCR → 🤖 GPT Structures → 💾 Supabase → 🏠 Home Screen
```

1. You take a photo of a receipt on your phone
2. The photo gets sent to a Python backend server
3. Azure Document Intelligence reads all the text from the image (OCR)
4. OpenAI GPT turns that messy text into clean structured data (store name, items, prices, tax, etc.)
5. Everything gets saved to Supabase (database + photo storage)
6. The app displays your receipts on the home screen — tap any to see full details

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Mobile App | React Native (JavaScript) | Cross-platform iOS & Android app |
| Camera | react-native-vision-camera | High quality photo capture with HDR, flash, zoom |
| Navigation | React Navigation | Screen transitions and bottom tab bar |
| Backend Server | Python Flask | Receives photos, orchestrates processing |
| OCR | Azure Document Intelligence | Reads text from receipt images |
| AI Extraction | OpenAI GPT-4o-mini | Structures raw text into clean JSON |
| Database | Supabase (PostgreSQL) | Stores structured receipt data |
| File Storage | Supabase Storage | Stores receipt photos |

---

## Project Structure

```
BabyBill/
│
├── src/                        ← App source code
│   ├── screens/
│   │   ├── HomeScreen.jsx      ← Receipt grid, search, category filters
│   │   ├── ScanScreen.jsx      ← Camera with focus, flash, zoom
│   │   ├── PreviewScreen.jsx   ← Photo preview, sends to backend
│   │   ├── DetailScreen.jsx    ← Full receipt breakdown
│   │   └── ChatScreen.jsx      ← AI chat (coming soon)
│   ├── navigation/
│   │   └── TabNavigator.jsx    ← Bottom tab bar (Home/Scan/Chat)
│   └── config/
│       ├── supabase.js         ← Supabase connection
│       └── api.js              ← Backend server URL
│
├── BabyBillBackend/            ← Python backend
│   └── server.py               ← Flask server (OCR + GPT + Supabase)
│
├── App.jsx                     ← App entry point & navigation setup
├── android/                    ← Android build files
├── ios/                        ← iOS build files
├── package.json                ← npm dependencies
└── .gitignore                  ← Files excluded from Git
```

---

## Key Files Explained

### 📱 Frontend — The Mobile App

| File | What It Does |
|------|-------------|
| **`App.jsx`** | Entry point. Sets up Stack Navigator + Tab Navigator. All screens registered here. |
| **`src/screens/HomeScreen.jsx`** | Shows all your receipts in a 2-column grid. Has a search bar and category filter tags (Food, Bills, Gas, Shopping, Medical). Fetches data from Supabase on load. Has a floating 🤖 button to open chat. |
| **`src/screens/ScanScreen.jsx`** | Opens the phone camera. Tap to focus (yellow circle), flash toggle, zoom buttons (1x/2x/3x). Takes high quality photos with HDR and stabilization. |
| **`src/screens/PreviewScreen.jsx`** | Shows the photo you just took. Tap "Confirm" to send it to the backend for processing. Shows a loading spinner while it waits (10-15 seconds). |
| **`src/screens/DetailScreen.jsx`** | Shows everything extracted from a receipt: store name, date, subtotal, tax, discount, total, payment method, individual items, and raw OCR text. |
| **`src/screens/ChatScreen.jsx`** | Placeholder for the AI chat feature. Will let you ask questions like "How much did I spend on food this month?" |
| **`src/navigation/TabNavigator.jsx`** | Defines the 3 bottom tabs: 🏠 Home, 📷 Scan, 💬 Chat |
| **`src/config/supabase.js`** | Supabase URL and anon key. The app reads receipts directly from Supabase. |
| **`src/config/api.js`** | One line — the backend server URL. Change this when deploying to cloud. |

### 🐍 Backend — The Processing Server

| File | What It Does |
|------|-------------|
| **`BabyBillBackend/server.py`** | The entire backend in one file. Has 4 functions and 2 endpoints: |

**4 Functions in server.py:**

| Function | Purpose |
|----------|---------|
| `ocr_receipt(image_bytes)` | Sends image to Azure → returns raw text |
| `extract_with_gpt(raw_text)` | Sends text to GPT → returns structured JSON |
| `upload_image_to_supabase(bytes, name)` | Uploads photo to Supabase Storage → returns file path |
| `save_to_supabase(data, image_path)` | Saves structured data to Supabase Database → returns saved row |

**2 API Endpoints:**

| Endpoint | Method | What It Does |
|----------|--------|-------------|
| `/process-receipt` | POST | Main pipeline — receives photo, runs OCR + GPT, saves everything |
| `/health` | GET | Returns `{"status": "ok"}` for testing |

---

## Setup Instructions

### Prerequisites

- Node.js installed
- Python 3 installed
- Android Studio with SDK (API 34+)
- An Android phone with USB debugging enabled
- Accounts: Supabase, Azure, OpenAI

### 1. Clone the repo

```bash
git clone https://github.com/Roshan1923/BabyBill.git
cd BabyBill
```

### 2. Setup Frontend

```bash
npm install
```

Update `src/config/api.js` with your computer's local IP:
```js
export const API_URL = 'http://YOUR_COMPUTER_IP:5000';
```

Find your IP by running `ipconfig` (Windows) or `ifconfig` (Mac/Linux) — look for your WiFi adapter's IPv4 address.

### 3. Setup Backend

```bash
cd BabyBillBackend
python -m venv venv
```

Activate the virtual environment:
```bash
# Windows
.\venv\Scripts\Activate

# Mac/Linux
source venv/bin/activate
```

Install packages:
```bash
pip install flask flask-cors azure-ai-formrecognizer openai httpx python-dotenv
```

Create a `.env` file inside `BabyBillBackend/`:
```
AZURE_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
AZURE_KEY=your_azure_key
OPENAI_API_KEY=sk-your_openai_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_key
```

### 4. Run Everything

**Terminal 1 — Backend:**
```bash
cd BabyBillBackend
.\venv\Scripts\Activate
python server.py
```

**Terminal 2 — Metro (JS bundler):**
```bash
cd BabyBill
npx react-native start
```

**Terminal 3 — Build app on phone:**
```bash
cd BabyBill
npx react-native run-android
```

> ⚠️ Your phone and computer must be on the **same WiFi network** for the app to reach the backend.

---

## Database Schema

The `receipts` table in Supabase:

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Auto-generated unique ID |
| `store_name` | text | Store/merchant name |
| `date` | date | Receipt date |
| `total_amount` | numeric | Final amount paid |
| `subtotal` | numeric | Amount before tax |
| `tax` | numeric | Tax amount |
| `tax_type` | text | Tax type (e.g. "HST 13%") |
| `discount` | numeric | Discounts applied |
| `payment_method` | text | How it was paid |
| `category` | text | Food, Bills, Gas, Shopping, Medical, Other |
| `items` | jsonb | Array of items with name, price, quantity |
| `raw_text` | text | Full OCR-extracted text |
| `image_url` | text | Path to photo in Supabase Storage |
| `created_at` | timestamp | When it was processed |

---

## What's Coming Next

- [ ] Deploy backend to cloud (so app works without a local computer)
- [ ] Build release APK for Android
- [ ] Edge detection & auto-crop before sending to OCR
- [ ] User authentication (each user sees only their receipts)
- [ ] LLM Chat — ask questions about your receipts
- [ ] Semantic search with pgvector
- [ ] iOS support

---

## Team

- **Roshan** — Frontend (React Native mobile app)
- **Teammate** — Backend pipeline (ReceiptBrain)
