
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse
from typing import List, Dict
import os
import uuid

from app.config.settings import settings
from app.database.books import BookDatabase
from app.database.embeddings import EmbeddingStore

router = APIRouter(tags=["books"])

def get_book_db():
    return BookDatabase()

def get_embedding_store(book_db: BookDatabase = Depends(get_book_db)):
    return EmbeddingStore(book_db)

# The direct upload-book endpoint is no longer needed since we're using Google Books API
# We'll keep a simplified endpoint for API compatibility
@router.post("/upload-book")
async def upload_book_compatibility():
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
