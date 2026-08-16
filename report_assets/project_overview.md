# AI-Powered Safety Monitoring System — Project Overview & Report Summary

## 📌 Problem Statement
In industrial environments, construction sites, and manufacturing plants, non-compliance with Personal Protective Equipment (PPE) regulations (such as failing to wear hardhats or safety vests) and unauthorized entry into hazardous machinery zones are leading causes of workplace injuries and fatalities. Manual monitoring by safety supervisors is prone to human error, fatigue, and limited coverage.

An automated, computer-vision-based safety monitoring system provides continuous 24/7 surveillance, instantly detecting non-compliance and hazardous zone breaches to enforce safety protocols proactively.

---

## 🎯 Project Objectives
1. **Real-time PPE Compliance Detection**: Automatically identify whether workers are wearing required safety gear (helmets, vests).
2. **Restricted Zone Monitoring**: Allow operators to dynamically draw virtual boundaries and detect unauthorized human entry into dangerous areas.
3. **Automated Incident Logging**: Persist violation records with timestamped snapshot images into MongoDB for compliance auditing.
4. **Interactive Command Dashboard**: Provide safety officers with a live webcam stream overlay, visual/audio alerts, and analytical breakdown charts.

---

## 🛠️ Technology Stack & Justification

| Layer | Technology | Justification |
| :--- | :--- | :--- |
| **Object Detection AI** | **YOLOv8 Nano (`yolov8n`)** | Lightweight, high-speed inference suitable for real-time video processing on standard laptops without requiring expensive industrial GPUs. |
| **Backend API Framework** | **FastAPI (Python)** | Asynchronous, ultra-fast Python framework with automatic OpenAPI documentation and seamless integration with OpenCV and PyTorch. |
| **Database** | **MongoDB (PyMongo)** | Flexible document store ideal for unstructured violation logs and variable metadata without requiring complex SQL migrations. |
| **Frontend UI** | **React (Vite)** | Reactive component framework providing smooth 60 FPS HTML5 canvas overlays, instant state updates, and rapid development. |
| **Visualization** | **Recharts** | Lightweight charting library tailored for React to render clean analytical bar charts. |

---

## ✨ Key Features Implemented

1. **Live Camera Stream & Object Detection**: Real-time 1-second interval frame processing with bounding box overlays (green for compliant, red for PPE violation).
2. **Dynamic 4-Point Restricted Zone Editor**: Interactive canvas selection allowing users to define custom polygonal exclusion zones with Ray Casting point-in-polygon entry detection.
3. **Configurable Confidence Threshold**: Real-time slider control (10% - 95%) adjusting detection sensitivity dynamically on the backend.
4. **Rate-Limited Rate & Snapshot Logging**: Enforces a 3-second logging cooldown per violation category to prevent database flooding during continuous breaches.
5. **Real-Time Audio & Toast Notifications**: Non-intrusive sound alerts and auto-dismissing banner notifications protected by a 5-second max audio cooldown.
6. **Analytical Violations Dashboard**: Historical table log with snapshot image previews, type/date filtering, and breakdown charts.

---

## ⚙️ Key Technical Challenges & Solutions

### 1. Balancing Real-Time Detection vs. Server Load
* **Challenge**: Streaming raw 60 FPS video directly to an AI backend causes high CPU utilization and network congestion.
* **Solution**: Implemented an client-side 1-second interval frame sampling model using offscreen HTML5 canvas encoding, maintaining high responsiveness while reducing server workload by 98%.

### 2. Database Flooding During Prolonged Violations
* **Challenge**: When a worker stands in front of the camera without a helmet for 1 minute, sending 60 frames would create 60 duplicate MongoDB records and snapshot files.
* **Solution**: Developed a 3-second per-category logging cooldown (`should_log_violation()`). The UI continues updating real-time boxes, but database writes and disk snapshots are throttled.

### 3. Synchronizing Video Dimensions with Canvas Overlays
* **Challenge**: Mismatch between natural webcam video resolution (e.g. 640x480) and CSS display dimensions caused bounding boxes to drift out of alignment.
* **Solution**: Dynamically computed scale factors (`scaleX`, `scaleY`) based on `getBoundingClientRect()` to ensure 1:1 alignment between video pixels and canvas draw coordinates.

---

## 🔮 Future Scope & Planned Enhancements
- **RTSP Multi-Camera Streaming**: Support multiple IP camera video streams simultaneously via WebSockets or WebRTC.
- **Automated Snapshot Retention Cron Job**: Integrate scheduled snapshot purging (`cleanup_snapshots.py`) to maintain storage capacity.
- **ONNX Runtime Export**: Export YOLOv8 weights to ONNX format for accelerated CPU inference.
- **SMS / Email Alerts**: Integrate Twilio or SendGrid APIs to dispatch instant SMS notifications to site managers during critical zone breaches.
