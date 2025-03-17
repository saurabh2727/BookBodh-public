
from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks, Depends
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import os
import shutil
import uuid
from typing import List, Dict
import pdfplumber
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

def extract_text_from_pdf(file_path: str) -> str:
    """
    Extract text from a PDF file using pdfplumber
    
    Args:
        file_path: Path to the PDF file
        
    Returns:
        Extracted text string
        
    Raises:
        ValueError: If text extraction fails
    """
    print(f"Extracting text from PDF: {file_path}")
    extracted_text = ""
    pages_with_content = 0
    total_pages = 0
    
    try:
        with pdfplumber.open(file_path) as pdf:
            total_pages = len(pdf.pages)
            print(f"PDF has {total_pages} pages")
            
            if total_pages == 0:
                raise ValueError("PDF appears to be empty (0 pages)")
            
            for page_num, page in enumerate(pdf.pages):
                try:
                    page_text = page.extract_text() or ""
                    if page_text.strip():
                        pages_with_content += 1
                    else:
                        print(f"Warning: Page {page_num + 1} yielded no text")
                    
                    extracted_text += page_text + " "
                except Exception as e:
                    print(f"Error extracting text from page {page_num + 1}: {str(e)}")
    except Exception as e:
        raise ValueError(f"Failed to extract text from PDF: {str(e)}")
    
    # Clean and validate the extracted text
    extracted_text = extracted_text.strip()
    
    if not extracted_text:
        print(f"No text extracted from {total_pages} pages. Pages with content: {pages_with_content}")
        raise ValueError(f"Could not extract any text from the PDF. Pages with content: {pages_with_content}/{total_pages}")
    
    print(f"Successfully extracted {len(extracted_text)} characters from {pages_with_content}/{total_pages} pages")
    return extracted_text

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
        
        print(f"File saved to {file_path}, now extracting text")
        
        # Extract text from PDF using improved function
        try:
            text = extract_text_from_pdf(file_path)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
            
        # Get book title from filename (remove extension)
        book_title = file.filename.rsplit('.', 1)[0]
        
        # Process book text in background
        print(f"Starting background processing for book '{book_title}'")
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
                "filename": unique_filename,
                "text": text  # Return the extracted text for Edge Function to use
            },
            headers={
                "Access-Control-Allow-Origin": "https://ethical-wisdom-bot.lovable.app",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "*"
            }
        )
            
    except Exception as e:
        # Cleanup on error
        if os.path.exists(file_path):
            os.remove(file_path)
        print(f"Error processing book: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing book: {str(e)}")
