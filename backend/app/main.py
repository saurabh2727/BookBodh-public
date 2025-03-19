
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from app.routers import chat, books

# Create necessary directories
os.makedirs("app/uploads", exist_ok=True)
os.makedirs("app/cache", exist_ok=True)
os.makedirs("app/cache/screenshots", exist_ok=True)

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
    return {"message": "BookBodh Backend API"}
