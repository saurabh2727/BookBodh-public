
from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks, Depends
from fastapi.responses import JSONResponse
import os
import shutil
import uuid
from typing import List, Dict
import PyPDF2
from io import BytesIO

from app.config.settings import settings
from app.database.books import BookDatabase
from app.database.embeddings import EmbeddingStore, process_book

router = APIRouter(tags=["books"])

# Ensure upload directory exists
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

def get_book_db():
    return BookDatabase()

def get_embedding_store(book_db: BookDatabase = Depends(get_book_db)):
    return EmbeddingStore(book_db)

@router.post("/upload-book")
async def upload_book(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    book_db: BookDatabase = Depends(get_book_db),
    embedding_store: EmbeddingStore = Depends(get_embedding_store)
):
    """
    Upload a PDF book, extract text, generate chunks and embeddings
    """
    # Validate file extension
    if not file.filename or not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    # Generate a unique filename to prevent overwriting
    unique_filename = f"{uuid.uuid4()}_{file.filename}"
    file_path = os.path.join(settings.UPLOAD_DIR, unique_filename)
    
    try:
        # Save uploaded file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Extract text from PDF
        text = ""
        with open(file_path, "rb") as pdf_file:
            pdf_reader = PyPDF2.PdfReader(pdf_file)
            for page_num in range(len(pdf_reader.pages)):
                page = pdf_reader.pages[page_num]
                text += page.extract_text() + " "
        
        if not text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from PDF")
            
        # Get book title from filename (remove extension)
        book_title = file.filename.rsplit('.', 1)[0]
        
        # Process book text (add to database and update embeddings) in background
        background_tasks.add_task(
            process_book,
            book_db,
            embedding_store,
            book_title,
            "Unknown Author",  # Could be improved with metadata extraction
            text
        )
        
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "message": f"Book '{book_title}' uploaded and processing started",
                "filename": unique_filename
            }
        )
            
    except Exception as e:
        # Cleanup on error
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Error processing book: {str(e)}")
