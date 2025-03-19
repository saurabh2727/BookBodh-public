
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
import logging

from app.routers import chat, books

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Get the absolute path to the app directory
current_file = os.path.abspath(__file__)
app_dir = os.path.dirname(current_file)
base_dir = os.path.dirname(app_dir)

# Create necessary directories with absolute paths
uploads_dir = os.path.join(app_dir, "uploads")
cache_dir = os.path.join(app_dir, "cache")
screenshots_dir = os.path.join(cache_dir, "screenshots")

logger.info(f"Current file: {current_file}")
logger.info(f"App directory: {app_dir}")
logger.info(f"Base directory: {base_dir}")
logger.info(f"Creating uploads directory at: {uploads_dir}")
logger.info(f"Creating cache directory at: {cache_dir}")
logger.info(f"Creating screenshots directory at: {screenshots_dir}")

os.makedirs(uploads_dir, exist_ok=True)
os.makedirs(cache_dir, exist_ok=True)
os.makedirs(screenshots_dir, exist_ok=True)

# Verify directories were created
logger.info(f"Uploads directory exists: {os.path.exists(uploads_dir)}")
logger.info(f"Cache directory exists: {os.path.exists(cache_dir)}")
logger.info(f"Screenshots directory exists: {os.path.exists(screenshots_dir)}")

app = FastAPI(title="BookBodh API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://127.0.0.1:8080"],  # For development; restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(chat.router)
app.include_router(books.router)

@app.get("/")
async def root():
    # Return directory information along with welcome message
    return {
        "message": "BookBodh Backend API",
        "directories": {
            "app_dir": app_dir,
            "uploads_dir": uploads_dir,
            "cache_dir": cache_dir,
            "screenshots_dir": screenshots_dir,
            "uploads_exists": os.path.exists(uploads_dir),
            "cache_exists": os.path.exists(cache_dir),
            "screenshots_exists": os.path.exists(screenshots_dir)
        }
    }
