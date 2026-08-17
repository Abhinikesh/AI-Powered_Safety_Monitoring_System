# AI-Powered Safety Monitoring System

An end-to-end computer vision web application for real-time **PPE compliance monitoring** and **restricted zone enforcement** in industrial settings. Built as a college internship project using YOLOv8, FastAPI, React, and MongoDB.

The system uses a webcam feed to detect whether workers are wearing helmets and safety vests. When a violation is detected, it logs it with a snapshot image, plays an audio alert, and shows it on a live analytics dashboard — all without any manual intervention.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Object Detection | YOLOv8 Nano (Ultralytics) |
| Backend API | Python 3.9+, FastAPI, Uvicorn |
| Database | MongoDB (PyMongo — no ORM) |
| Frontend UI | React 19 (Vite), Recharts, HTML5 Canvas |
| Computer Vision | OpenCV, NumPy |
| Zone Detection | Ray Casting (point-in-polygon) |

---

## Prerequisites

Make sure these are installed and running before setup:

1. **Python 3.9+** — `python3 --version`
2. **Node.js 18+** — `node -v`
3. **MongoDB** — running on `localhost:27017`
   - macOS: `brew services start mongodb-community`
   - Linux: `sudo systemctl start mongod`
   - Or use a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster

---

## Setup Guide

### Step 1 — Clone the repo and navigate to it

```bash
git clone <your-repo-url>
cd "AI-Powered Safety Monitoring System"
```

### Step 2 — Configure environment variables

```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and set your MongoDB URI:

```env
MONGO_URI=mongodb://localhost:27017/safety_monitoring
ROBOFLOW_API_KEY=your_key_here   # only needed for dataset download
```

### Step 3 — Set up the Python backend

```bash
cd backend

# Create virtual environment (first time only)
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the server
uvicorn app.main:app --reload --port 8000
```

Backend runs at **http://localhost:8000**  
Interactive API docs: **http://localhost:8000/docs**

### Step 4 — Set up the React frontend

Open a second terminal:

```bash
cd frontend
npm install          # first time only
npm run dev -- --port 3000
```

Frontend runs at **http://localhost:3000**

Open that URL in Chrome or Edge, grant webcam permissions, and the app will start.

---

## One-Command Demo Launch

To start everything at once (MongoDB must already be running):

```bash
chmod +x start.sh
./start.sh
```

This starts both the backend and frontend in the background. Press `Ctrl+C` to stop both.

---

## Dataset Download & Model Training

### Download the PPE dataset

The model was trained on a Roboflow PPE dataset. To download it:

1. Get a free API key from [roboflow.com](https://app.roboflow.com)
2. Add it to `backend/.env`: `ROBOFLOW_API_KEY=your_key`
3. Run:

```bash
# From the project root, using the backend venv Python
backend/venv/bin/python scripts/download_dataset.py
```

This saves the dataset into `data/` with `train/`, `valid/`, `test/` splits.

### Train the YOLOv8 model

```bash
backend/venv/bin/python scripts/train_model.py
```

The script automatically detects if you have a GPU. On CPU, it reduces to 20 epochs and warns you this will be slow (30–90 minutes). The trained weights are saved to `models/best.pt` automatically.

**Tip:** If training locally is too slow, upload your `data/` folder to Google Colab and run the same script with a free T4 GPU — it'll finish in under 10 minutes.

---

## Project Structure

```
AI-Powered Safety Monitoring System/
├── backend/
│   ├── app/
│   │   ├── main.py              ← FastAPI app, CORS, static file serving
│   │   ├── database.py          ← MongoDB connection (PyMongo, no ORM)
│   │   ├── models/
│   │   │   └── violation.py     ← Violation document schema (plain dict)
│   │   ├── routes/
│   │   │   ├── detection.py     ← POST /detect — runs inference, logs violations
│   │   │   └── violations.py    ← GET /violations, /stats, /today
│   │   └── services/
│   │       ├── detection_service.py  ← YOLO model loader, detect_ppe(), check_violations()
│   │       └── violation_service.py  ← MongoDB CRUD, logging cooldown
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── WebcamMonitor.jsx     ← Live camera feed, canvas overlay, alerts
│   │   │   └── ViolationsDashboard.jsx ← Analytics table, charts, filters
│   │   ├── App.jsx                  ← Tab navigation, layout
│   │   └── App.css                  ← Dark security dashboard theme
│   ├── public/
│   │   └── alert.wav               ← Audio alert sound
│   └── package.json
├── scripts/
│   ├── download_dataset.py          ← Roboflow dataset downloader
│   ├── train_model.py               ← YOLOv8 fine-tuning script
│   ├── generate_report_metrics.py   ← Generates model_metrics.md
│   └── cleanup_snapshots.py         ← Deletes snapshots older than 7 days
├── data/                            ← PPE dataset (gitignored, download locally)
├── models/
│   └── best.pt                      ← Trained weights (gitignored, generate via training)
├── logs/
│   └── snapshots/                   ← Violation snapshot images (gitignored, runtime)
├── report_assets/                   ← Documentation for internship report
├── start.sh                         ← One-command demo launcher
└── README.md
```

---

## Known Limitations

These are honest limitations documented for the internship report:

1. **1-second frame polling** — The frontend sends a JPEG frame every second via HTTP POST rather than streaming via WebSocket/WebRTC. This reduces server load but introduces ~1s latency. True real-time streaming would require WebSockets or a dedicated streaming server.

2. **Single camera only** — The system handles one webcam feed per browser tab. Multi-camera support (e.g., multiple RTSP streams) would require a dedicated camera management layer on the backend.

3. **Snapshot storage growth** — Snapshots accumulate in `logs/snapshots/` with no automatic cleanup by default. Run `scripts/cleanup_snapshots.py` manually or schedule it as a cron job to delete files older than 7 days.

4. **CPU training is slow** — YOLOv8 training on CPU takes 30–90 minutes even at 20 epochs. A GPU (or free Google Colab T4) reduces this to under 10 minutes.

5. **No user authentication** — The API has no auth layer; anyone who can reach port 8000 can access it. For production use, add an API key or JWT auth middleware.

---

## Snapshot Cleanup

To delete snapshots older than 7 days:

```bash
backend/venv/bin/python scripts/cleanup_snapshots.py
```

You can schedule this with cron:

```bash
# Add to crontab: run cleanup every day at 3am
0 3 * * * /path/to/backend/venv/bin/python /path/to/scripts/cleanup_snapshots.py
```
# AI-Powered_Safety_Monitoring_System



------------------------------------------------------------------------------------------------------------------------------------------------------------------
./start.sh


cd "backend"
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload




cd "frontend"
npm run dev -- --port 3000



lsof -ti:8000,3000 | xargs kill -9
