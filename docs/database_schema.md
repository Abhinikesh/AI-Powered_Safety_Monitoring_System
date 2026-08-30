# MongoDB Database Schema Documentation

## 🗄️ Database & Collection Details

* **Database Name**: `safety_monitoring`
* **Collection Name**: `violations`
* **Driver**: PyMongo (`MongoClient`)

---

## 📝 Document Field Specifications

```json
{
  "_id": ObjectId("66be3f48a12b3c4d5e6f7a8b"),
  "timestamp": "2026-08-16T01:45:12.345678",
  "violation_type": "no-helmet",
  "confidence": 0.8924,
  "snapshot_path": "20260816_014512_no-helmet_a1b2c3.jpg",
  "frame_width": 640,
  "frame_height": 480
}
```

### Field Descriptions & Technical Rationale

| Field Name | Data Type | Description | Technical Rationale |
| :--- | :--- | :--- | :--- |
| `_id` | `ObjectId` | Auto-generated unique identifier | Primary key generated automatically by MongoDB for indexing and document identification. |
| `timestamp` | `DateTime` / `String` | Exact UTC timestamp of when violation occurred | Enables chronological sorting, time-range querying (e.g. today's violations), and audit logging. |
| `violation_type` | `String` | Categorical tag (e.g. `no-helmet`, `no-vest`, `restricted-zone-entry`) | Enables aggregation pipelines (`$group` by violation type) to render analytical charts on the dashboard. |
| `confidence` | `Float` | Model confidence score (0.0 to 1.0) | Provides auditability to verify model certainty when reviewing logged violations. |
| `snapshot_path` | `String` | Filename of the captured frame snapshot (e.g. `20260816_014512_no-helmet_a1b2c3.jpg`) | Stores just the filename (not the full path) so the snapshot URL is portable across machines. The frontend constructs the full URL as `http://localhost:8000/snapshots/<filename>`. |
| `frame_width` | `Integer` | Pixel width of captured video frame | Preserves spatial context and aspect ratio metadata for scaling bounding box coordinates during historical review. |
| `frame_height` | `Integer` | Pixel height of captured video frame | Preserves spatial context and aspect ratio metadata for scaling bounding box coordinates during historical review. |

---

## 📈 Aggregation Pipelines Used

### Violation Breakdown Stats (`GET /violations/stats`)

```javascript
[
  { "$group": { "_id": "$violation_type", "count": { "$sum": 1 } } },
  { "$sort": { "count": -1 } }
]
```
Used to feed the `Recharts` bar chart on the React dashboard.
