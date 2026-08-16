# AI Safety Monitoring System — System Architecture

## 🏗️ End-to-End System Architecture

```mermaid
flowchart TD
    subgraph Client ["React Frontend (Port 3000)"]
        A["Webcam Feed (getUserMedia)"] -->|Frame Capture 1s| B["Canvas JPEG Encoding"]
        B -->|FormData Axios POST /detect| C["HTTP Network Gateway"]
        K["Violations Dashboard (Recharts)"] <--|GET /violations| C
        L["Canvas Overlay Renderer"] <--|Bounding Box JSON| C
    end

    subgraph Server ["FastAPI Backend (Port 8000)"]
        C --> D["POST /detect Route Handler"]
        D --> E["YOLOv8 Model Service (Inference)"]
        E --> F["Violation Checking Logic & Cooldown (3s)"]
        F -->|Violation Detected| G["Snapshot Saver (logs/snapshots/)"]
        F -->|Violation Document| H["PyMongo DB Client"]
    end

    subgraph Storage ["Database & File Storage"]
        H --> I[("MongoDB: safety_monitoring")]
        G --> J["Local Snapshot File System"]
    end
```

---

## 🔄 Data & Execution Flow Explanation

1. **Video Capture & Frame Transmission**:
   - The React client accesses the local camera using `navigator.mediaDevices.getUserMedia()`.
   - A `setInterval` timer triggers every **1 second**, capturing the current video frame onto an offscreen `<canvas>` and converting it into a JPEG blob.
   - The frame is packaged into a `multipart/form-data` payload along with optional restricted zone polygon points and user-configured confidence thresholds, then transmitted to `POST /detect`.

2. **Inference & Violation Checking**:
   - FastAPI receives the image payload and decodes it into an OpenCV BGR image matrix.
   - The pre-loaded **YOLOv8 nano** model runs inference on the image tensor.
   - Raw detections are passed to `check_violations()`, which evaluates PPE compliance (`no-helmet`, `no-vest`) and runs a **Ray Casting point-in-polygon** algorithm (`is_inside_zone`) to check for unauthorized zone entry.

3. **Rate-Limited Logging & Snapshot Persistence**:
   - When a violation is flagged, the system checks `should_log_violation(vtype)` to enforce a **3-second logging cooldown**.
   - If outside the cooldown window, the frame image is saved as a timestamped snapshot in `logs/snapshots/` and a violation document is inserted into MongoDB via `pymongo`.

4. **Real-time Visualization & Analytics**:
   - The backend responds with a JSON payload containing all bounding box coordinates and violation flags.
   - React updates the HTML5 overlay canvas, drawing green bounding boxes for compliant workers, red boxes for PPE violations, and orange boxes for restricted zone entries.
   - The **Violations Dashboard** queries `GET /violations` and `GET /violations/stats` to render analytics charts and historical violation tables with snapshot image previews.
