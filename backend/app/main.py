from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.routes.detection import router as detection_router
from app.routes.violations import router as violations_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Pre-load the YOLO model at startup so the first request doesn't pay the loading penalty."""
    print("=== SafeGuard AI Backend Starting Up ===")
    try:
        from app.services.detection_service import get_model
        get_model()
        print("✓ YOLO model loaded and ready.")
    except Exception as e:
        print(f"⚠ Could not pre-load YOLO model: {e}")
        print("  The model will be loaded on the first detection request instead.")
    yield
    # Cleanup on shutdown (nothing needed currently)
    print("=== SafeGuard AI Backend Shutting Down ===")


app = FastAPI(
    title="SafeGuard AI — Safety Monitoring API",
    description="Real-time PPE compliance monitoring and restricted zone enforcement.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS: allow all origins for local dev (React on :3000 or :5173, varies by machine)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve saved violation snapshot images as static files
# Frontend accesses them at: http://localhost:8000/snapshots/<filename>
SNAPSHOT_DIR = Path(__file__).resolve().parent.parent.parent / "logs" / "snapshots"
SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/snapshots", StaticFiles(directory=str(SNAPSHOT_DIR)), name="snapshots")

# Register API routers
app.include_router(detection_router, tags=["Detection"])
app.include_router(violations_router, tags=["Violations"])


@app.get("/", tags=["Health"])
def root():
    return {"status": "SafeGuard AI backend is running", "docs": "/docs"}


@app.get("/health", tags=["Health"])
def health():
    """Simple liveness endpoint the frontend can ping to check server availability."""
    return {"status": "ok"}
