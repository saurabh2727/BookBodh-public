
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from fastapi.responses import JSONResponse
from typing import List, Dict
import os
import uuid
import httpx

from app.config.settings import settings
from app.database.books import BookDatabase
from app.database.embeddings import EmbeddingStore

router = APIRouter(tags=["books"])

def get_book_db():
    return BookDatabase()

def get_embedding_store(book_db: BookDatabase = Depends(get_book_db)):
    return EmbeddingStore(book_db)

async def trigger_extraction(book_id: str, external_id: str = None):
    """
    Background task to trigger extraction for a newly added book
    """
    try:
        # Determine the API URL based on environment
        api_base_url = os.environ.get("BACKEND_API_URL", "http://localhost:8000")
        extraction_url = f"{api_base_url}/extract-book/{book_id}"
        
        payload = {"book_id": book_id, "force": False}
        if external_id:
            payload["external_id"] = external_id
            
        async with httpx.AsyncClient() as client:
            response = await client.post(
                extraction_url, 
                json=payload,
                timeout=60
            )
            
            if response.status_code == 202:
                print(f"Extraction successfully triggered for book {book_id} (External ID: {external_id})")
            else:
                print(f"Failed to trigger extraction for book {book_id}: {response.text}")
    
    except Exception as e:
        print(f"Error triggering extraction for book {book_id}: {str(e)}")

# The direct upload-book endpoint is no longer needed since we're using Google Books API
# We'll keep a simplified endpoint for API compatibility
@router.post("/upload-book", status_code=202)
async def upload_book_compatibility(background_tasks: BackgroundTasks):
    """
    This endpoint is maintained for API compatibility but is deprecated.
    Book uploading is now handled through the Google Books API integration.
    """
    return JSONResponse(
        status_code=400,
        content={
            "success": False,
            "message": "Direct PDF uploads are no longer supported. Please use the Google Books search feature."
        }
    )

@router.post("/extract-book/{book_id}", status_code=202)
async def extract_book(book_id: str, background_tasks: BackgroundTasks, external_id: str = None):
    """
    Endpoint to trigger extraction for a newly added book
    """
    # Now passing both IDs to the background task
    background_tasks.add_task(trigger_extraction, book_id, external_id)
    
    return {
        "status": "initiated",
        "book_id": book_id,
        "external_id": external_id,
        "message": "Book extraction process has been initiated"
    }

@router.post("/books/{book_id}/extract", status_code=202)
async def trigger_book_extraction(book_id: str, background_tasks: BackgroundTasks, external_id: str = None):
    """
    Endpoint to manually trigger extraction for a book
    """
    # Now passing both IDs to the background task
    background_tasks.add_task(trigger_extraction, book_id, external_id)
    
    return {
        "status": "initiated",
        "book_id": book_id,
        "external_id": external_id,
        "message": "Book extraction process has been initiated"
    }
