# 🛡️ AI-Powered Safety Monitoring System (SafeGuard AI)

A real-time computer vision system for **PPE compliance monitoring** (Hardhats, Safety Vests, Masks) and **restricted hazard zone enforcement** in industrial and construction worksites.

---

## ⚡ Tech Stack

* **AI / Vision**: YOLOv8 Nano (`ultralytics`), OpenCV, PyTorch
* **Backend**: FastAPI, Uvicorn, PyMongo
* **Database**: MongoDB
* **Frontend**: React 19 (Vite), Recharts, HTML5 Canvas
* **Dataset**: Roboflow Universe (`construction-site-safety`)

---

## 🚀 Quick Start

### 1. Prerequisites
* Python 3.9+ & Node.js 18+
* MongoDB running on `localhost:27017` (`brew services start mongodb-community` or MongoDB Atlas)

### 2. Run Everything (One Command)
```bash
chmod +x start.sh
./start.sh
```
* **Frontend UI**: [http://localhost:3000](http://localhost:3000)
* **Backend API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🛠️ Manual Setup

### Backend (Terminal 1)
```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # Configure MONGO_URI if needed
uvicorn app.main:app --reload --port 8000
```

### Frontend (Terminal 2)
```bash
cd frontend
npm install
npm run dev -- --port 3000
```

---

## 📦 Dataset & Training

1. **Download Dataset**:
   ```bash
   # Add ROBOFLOW_API_KEY to backend/.env if downloading fresh data
   backend/venv/bin/python scripts/download_dataset.py
   ```
2. **Train Model**:
   ```bash
   backend/venv/bin/python scripts/train_model.py
   ```
   *Trained weights automatically save to `models/best.pt`.*

---

## 📁 Project Structure

```text
AI-Powered Safety Monitoring System/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app & static file serving
│   │   ├── database.py          # MongoDB client
│   │   ├── routes/              # /detect and /violations API routes
│   │   └── services/            # YOLO detection, zone logic & cooldown
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/          # WebcamMonitor & ViolationsDashboard
│   │   ├── App.jsx & App.css    # Layout & dark security dashboard theme
│   └── package.json
├── scripts/
│   ├── download_dataset.py      # Roboflow dataset downloader
│   ├── train_model.py           # YOLOv8 fine-tuning script
│   └── cleanup_snapshots.py     # Retention management for snapshots
├── data/                        # Dataset & data.yaml
├── models/                      # Trained weights (best.pt)
├── logs/snapshots/              # Captured violation incident snapshots
├── docs/                        # Architecture diagrams, schemas & metrics
└── start.sh                     # One-click startup script
```

---

## 🛑 Stop / Kill Running Ports
```bash
lsof -ti:8000,3000 | xargs kill -9
```
