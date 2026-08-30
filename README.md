# AI-Powered Safety Monitoring System

An end-to-end computer vision web application for real-time **PPE compliance monitoring** (detecting hardhats, safety vests, and masks) and dynamic **restricted hazard zone enforcement** in industrial, manufacturing, and construction settings. Built with fine-tuned YOLOv8, a high-performance FastAPI backend, an interactive React dashboard, and MongoDB for incident logging.

The system uses a live video feed to detect whether personnel are wearing required safety gear (Hardhats, Safety Vests, Masks) and enforces custom exclusion boundaries. When a non-compliance incident or unauthorized zone entry is detected, it logs the event with a timestamped snapshot image, triggers immediate visual and audio alerts, and updates a live security analytics dashboard.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Object Detection | YOLOv8 Nano (Ultralytics) |
| Dataset Source | Roboflow Universe (`construction-site-safety`) |
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

Open `backend/.env` and set your MongoDB URI and optional Roboflow API key:

```env
MONGO_URI=mongodb://localhost:27017/safety_monitoring
ROBOFLOW_API_KEY=your_key_here   # for dataset download from Roboflow Universe
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

## Dataset & Model Training

### Construction Site Safety Dataset

The model is trained on the **Construction Site Safety** dataset from Roboflow Universe (`roboflow-universe-projects/construction-site-safety`), containing **2,800+ annotated industrial images** across 10 classes:

| Class Name | Type / Role |
| :--- | :--- |
| `Hardhat` | Compliant PPE |
| `Mask` | Compliant PPE |
| `NO-Hardhat` | ⚠️ Safety Violation |
| `NO-Mask` | ⚠️ Safety Violation |
| `NO-Safety Vest` | ⚠️ Safety Violation |
| `Person` | Worker entity for restricted zone intrusion detection |
| `Safety Vest` | Compliant PPE |
| `Safety Cone` | Site marker (ignored for violations) |
| `machinery` | Heavy machinery (ignored for PPE violations) |
| `vehicle` | Construction vehicles (ignored for PPE violations) |

### Download the Dataset

1. Get a free API key from [roboflow.com](https://app.roboflow.com) (Account > Roboflow Keys)
2. Add it to `backend/.env`: `ROBOFLOW_API_KEY=your_key`
3. Run:

```bash
backend/venv/bin/python scripts/download_dataset.py
```

This exports the dataset into `data/` with `train/`, `valid/`, and `test/` splits along with `data.yaml`.

### Train the YOLOv8 Model

```bash
backend/venv/bin/python scripts/train_model.py
```

* **GPU Training**: If an NVIDIA CUDA GPU or Apple Silicon MPS is detected, training runs for 50 epochs.
* **CPU Warning**: On standard CPU, the 2,800+ image dataset will take several hours. The script automatically clamps epochs to 20 for test runs.
* **Recommended Free GPU (Google Colab)**: Upload the `data/` folder and `scripts/train_model.py` to Google Colab, select **Runtime > Change runtime type > T4 GPU**, and training will finish in ~10–15 minutes. Best weights are saved to `models/best.pt`.

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
│   │       ├── detection_service.py  ← YOLO loader, detect_ppe(), check_violations()
│   │       └── violation_service.py  ← MongoDB CRUD, 3s logging cooldown
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
│   ├── download_dataset.py          ← Roboflow Construction Site Safety downloader
│   ├── train_model.py               ← YOLOv8 fine-tuning script
│   ├── cleanup_snapshots.py         ← Deletes snapshots older than 7 days
│   └── reporting/
│       └── generate_report_metrics.py ← Generates model_metrics.md in docs/
├── data/                            ← Construction Site Safety dataset & data.yaml
├── models/
│   └── best.pt                      ← Trained weights (gitignored, generate via training)
├── logs/
│   └── snapshots/                   ← Violation snapshot images (gitignored, runtime)
├── docs/                            ← Architecture diagrams, schemas, and metrics
├── start.sh                         ← One-command demo launcher
└── README.md
```

---

## Known Limitations

These are documented architectural trade-offs and known limitations:

1. **1-second frame polling** — The frontend sends a JPEG frame every second via HTTP POST rather than streaming via WebSocket/WebRTC. This reduces server load but introduces ~1s latency. True real-time streaming would require WebSockets or a dedicated streaming server.

2. **Single camera only** — The system handles one webcam feed per browser tab. Multi-camera support (e.g., multiple RTSP streams) would require a dedicated camera management layer on the backend.

3. **Snapshot storage growth** — Snapshots accumulate in `logs/snapshots/` with no automatic cleanup by default. Run `scripts/cleanup_snapshots.py` manually or schedule it as a cron job to delete files older than 7 days.

4. **CPU training is slow** — YOLOv8 training on CPU takes significant time on large datasets. A GPU (or free Google Colab T4) reduces this to ~10–15 minutes.

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

---

## Quick Command Reference

```bash
# Start both backend and frontend together:
./start.sh

# Or start Backend individually:
cd backend
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Or start Frontend individually:
cd frontend
npm run dev -- --port 3000

# Kill running processes if ports get stuck:
lsof -ti:8000,3000 | xargs kill -9
```
