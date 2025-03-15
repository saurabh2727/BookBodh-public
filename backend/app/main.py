
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import chat

app = FastAPI(title="BookBodh API", description="Backend API for BookBodh chat application")

# Enable CORS for frontend - updated with more permissive settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:8080", "https://id-preview--af882bf9-fec5-411a-9e6a-4e25c8beccfe.lovable.app"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Include routers
app.include_router(chat.router)

@app.get("/")
async def root():
    return {"message": "BookBodh Backend Running"}
