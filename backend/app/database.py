from pymongo import MongoClient, DESCENDING
from dotenv import load_dotenv
import os
from pathlib import Path

# Load from backend/.env first, then fall back to project root .env
load_dotenv(Path(__file__).parent.parent / ".env")
load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/safety_monitoring")

client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)

# Extract database name from URI or default to "safety_monitoring"
db_name = MONGO_URI.rstrip("/").split("/")[-1].split("?")[0] or "safety_monitoring"
db = client[db_name]

# Collections
violations_col = db["violations"]

# Create index on timestamp for faster date-range queries
try:
    violations_col.create_index([("timestamp", DESCENDING)])
except Exception:
    pass  # Index creation is non-critical, skip silently if it fails
