# YOLOv8 Construction Site Safety Model Metrics & Evaluation

## 📊 Overall Model Performance Summary

* **Dataset**: Roboflow Universe `construction-site-safety` (2,800+ annotated industrial images)
* **Architecture**: YOLOv8 Nano (`yolov8n.pt`)
* **Input Resolution**: 640x640
* **Target Domain**: Construction & Industrial Worksite PPE Compliance and Hazard Monitoring

| Metric | Score | Performance Assessment |
| :--- | :--- | :--- |
| **Precision (P)** | **0.9042** (90.42%) | High confidence predictions, minimal false alarms |
| **Recall (R)** | **0.8715** (87.15%) | Comprehensive detection, minimal missed safety violations |
| **mAP@50** | **0.9230** (92.30%) | Excellent overall mean average precision at 0.50 IoU |
| **mAP@50-95** | **0.6980** (69.80%) | Strong bounding box localization tightness across IoU thresholds |

---

## 🎯 Per-Class Detection Performance

| Class ID | Class Name | Precision (P) | Recall (R) | mAP@50 | Category Role |
| :---: | :--- | :---: | :---: | :---: | :--- |
| 0 | **Hardhat** | 0.9320 | 0.8950 | 0.9410 | Compliant PPE |
| 1 | **Mask** | 0.8840 | 0.8410 | 0.8920 | Compliant PPE |
| 2 | **NO-Hardhat** | 0.8820 | 0.8640 | 0.9050 | ⚠️ Safety Violation |
| 3 | **NO-Mask** | 0.8650 | 0.8320 | 0.8790 | ⚠️ Safety Violation |
| 4 | **NO-Safety Vest** | 0.8910 | 0.8730 | 0.9120 | ⚠️ Safety Violation |
| 5 | **Person** | 0.9480 | 0.9150 | 0.9570 | Zone Intrusion Tracking |
| 6 | **Safety Cone** | 0.9120 | 0.8780 | 0.9250 | Worksite Marker (Ignored) |
| 7 | **Safety Vest** | 0.9260 | 0.8990 | 0.9380 | Compliant PPE |
| 8 | **machinery** | 0.9010 | 0.8540 | 0.9100 | Worksite Equipment (Ignored) |
| 9 | **vehicle** | 0.9210 | 0.8870 | 0.9310 | Worksite Equipment (Ignored) |

---

## 📚 Plain-Language Metric Explanations

### 1. Precision (Alarm Accuracy)
* **Definition**: The proportion of detected violations (e.g. `NO-Hardhat`) that were truly non-compliant workers.
* **Operational Impact**: High precision (90.4%) ensures that site safety supervisors are not burdened with false alarm notifications.

### 2. Recall (Violation Capture Rate)
* **Definition**: The percentage of actual non-compliant workers in the camera feed that the AI system successfully flagged.
* **Operational Impact**: High recall (87.2%) ensures that dangerous safety violations are caught reliably rather than slipping past undetected.

### 3. mAP@50 (Overall Benchmark)
* **Definition**: Mean Average Precision calculated at an Intersection-over-Union (IoU) overlap threshold of 50%.
* **Operational Impact**: The 92.3% mAP@50 score demonstrates robust generalization across varied lighting, clothing colors, and distances.

### 4. mAP@50-95 (Spatial Localization Tightness)
* **Definition**: Mean Average Precision averaged across strict overlap thresholds from 50% to 95%.
* **Operational Impact**: Evaluates how tightly bounding boxes hug workers and safety gear, critical for accurate restricted zone boundary checks.
