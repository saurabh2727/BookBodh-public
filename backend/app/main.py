
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
import os
from .routers import books, chat, health, diagnostics, api_info
from .config.settings import Settings

# Configure logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize settings
settings = Settings()

# Create FastAPI app
app = FastAPI(title="BookBodh API")

# Add CORS middleware with more permissive settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],  # Allow all headers
    expose_headers=["Content-Type", "Content-Disposition", "X-API-Request", "X-Backend-Request"],
)

# Define paths
app_dir = os.path.dirname(__file__)
cache_dir = os.path.join(app_dir, "cache")
screenshots_dir = os.path.join(cache_dir, "screenshots")
uploads_dir = os.path.join(os.path.dirname(app_dir), "uploads")

# Create directories if they don't exist
os.makedirs(cache_dir, exist_ok=True)
os.makedirs(screenshots_dir, exist_ok=True)
os.makedirs(uploads_dir, exist_ok=True)

# Include routers at API prefix level (this should take precedence)
app.include_router(books.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(health.router, prefix="/api")
app.include_router(diagnostics.router, prefix="/api")
app.include_router(api_info.router, prefix="/api")

# Also include at root level for backward compatibility
app.include_router(books.router)
app.include_router(chat.router)
app.include_router(health.router)
app.include_router(diagnostics.router)
app.include_router(api_info.router)
