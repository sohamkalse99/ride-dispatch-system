from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.endpoints import router
from fastapi.staticfiles import StaticFiles
# Create FastAPI application
app = FastAPI(
    title="Ride Dispatch System",
    description="A simplified ride-hailing backend system with grid-based city simulation",
    version="0.1.0"
)

# Configure CORS to allow requests from the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development; restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include our router
app.include_router(router)

# 1️⃣ Serve all static files (and index.html for SPA) at the root
app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")

# 2️⃣ Then include your API **under** /api so it doesn’t clash with “/”
app.include_router(api_router, prefix="/api")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
