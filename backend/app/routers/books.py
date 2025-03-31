
from typing import List, Annotated, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.database.models import Book as BookModel
from app.schemas import BookCreate, Book, BookUpdate
from app.database.books import create_book, get_book_by_id, get_books, update_book, create_book_chunk
import logging
import traceback
import json

# Configure detailed logging for this module
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

router = APIRouter(
    prefix="/books",
    tags=["books"],
    responses={404: {"description": "Not found"}},
)

@router.post("/", response_model=Book)
def create_new_book(book: BookCreate, db: Annotated[Session, Depends(get_db)]):
    """
    Create a new book.
    """
    return create_book(db=db, book=book)

@router.get("/{book_id}", response_model=Book)
def read_book(book_id: str, db: Annotated[Session, Depends(get_db)]):
    """
    Get a book by ID.
    """
    db_book = get_book_by_id(db, book_id=book_id)
    if db_book is None:
        raise HTTPException(status_code=404, detail="Book not found")
    return db_book

@router.get("/", response_model=List[Book])
def read_books(skip: int = 0, limit: int = 100, db: Annotated[Session, Depends(get_db)]):
    """
    Get all books.
    """
    books = get_books(db, skip=skip, limit=limit)
    return books

@router.patch("/{book_id}", response_model=Book)
def update_existing_book(book_id: str, book: BookUpdate, db: Annotated[Session, Depends(get_db)]):
    """
    Update a book.
    """
    db_book = get_book_by_id(db, book_id=book_id)
    if db_book is None:
        raise HTTPException(status_code=404, detail="Book not found")
    return update_book(db, book_id, book.model_dump(exclude_unset=True))

# Add enhanced extraction endpoint with better debugging
@router.post("/extract-book/{book_id}")
async def extract_book_content(
    book_id: str, 
    data: Dict[str, Any] = Body(default={}),
    db: Annotated[Session, Depends(get_db)]
):
    """
    Extract book content from Google Books with enhanced debugging
    
    Args:
        book_id: UUID of the book in the database
        data: Optional request data containing external_id and force flag
        db: Database session
        
    Returns:
        JSON response with extraction status
    """
    try:
        logger.info(f"Extract book endpoint called for book ID: {book_id}")
        logger.info(f"Request data: {json.dumps(data)}")
        
        # Get book info from database
        book = get_book_by_id(db, book_id)
        if not book:
            logger.error(f"Book with ID {book_id} not found")
            raise HTTPException(status_code=404, detail=f"Book with ID {book_id} not found")
            
        # Check if external_id was provided in the request or use the one from the database
        external_id = data.get('external_id') or book.external_id
        force = data.get('force', False)
        
        if not external_id:
            logger.error(f"No external_id available for book {book_id}")
            raise HTTPException(
                status_code=400, 
                detail=f"No Google Books ID available for this book. Please provide an external_id."
            )
        
        # Log book details for debugging
        logger.info(f"Book details: ID={book_id}, External ID={external_id}, Title={book.title}, Status={book.status}")
        
        # Get an instance of the BookExtractor
        from app.services.book_extraction import BookExtractor
        extractor = BookExtractor()
        
        # Update book status to show extraction is in progress
        update_book(
            db, 
            book_id, 
            {
                "status": "extracting", 
                "summary": f"Book extraction in progress. Started at {extractor.get_current_time()}"
            }
        )
        
        # Extract content from Google Books
        logger.info(f"Starting extraction for book {book_id} (Google Books ID: {external_id})")
        extracted_text, screenshot_paths = extractor.extract_from_google_books(external_id, book.title)
        
        logger.info(f"Extraction completed. Got {len(extracted_text)} chars of text and {len(screenshot_paths)} screenshots")
        
        # Process the extracted text into chunks
        chunks = extractor.process_book_to_chunks(book_id, extracted_text, book.title, book.author)
        
        # Update the book record with the chunk count and status
        update_book(
            db, 
            book_id, 
            {
                "status": "processed", 
                "chunks_count": len(chunks),
                "summary": extracted_text[:500] + ("..." if len(extracted_text) > 500 else "")
            }
        )
        
        # Create database entries for the chunks
        chunk_records = []
        for chunk in chunks:
            chunk_record = create_book_chunk(
                db, 
                book_id, 
                chunk["chunk_index"], 
                chunk["text"], 
                book.title, 
                book.author
            )
            if chunk_record:
                chunk_records.append(chunk_record)
        
        # Return detailed success response
        return {
            "success": True,
            "book_id": book_id,
            "external_id": external_id,
            "chunk_count": len(chunks),
            "screenshots": len(screenshot_paths),
            "text_length": len(extracted_text),
            "timestamp": extractor.get_current_time(),
            "chunks_created": len(chunk_records),
            "status": "processed"
        }
    except Exception as e:
        logger.error(f"Error extracting book content: {str(e)}")
        logger.error(traceback.format_exc())
        
        # Update book status to error
        try:
            update_book(db, book_id, {
                "status": "extraction_error", 
                "summary": f"Error extracting: {str(e)[:200]}..."
            })
        except Exception as update_error:
            logger.error(f"Error updating book status: {str(update_error)}")
        
        # Return detailed error response
        return {
            "success": False,
            "book_id": book_id,
            "error": str(e),
            "status": "extraction_error",
            "timestamp": BookExtractor().get_current_time() if 'BookExtractor' in locals() else None
        }

# Add a debug-specific endpoint for troubleshooting
@router.post("/debug-extract/{book_id}")
async def debug_extract_book(
    book_id: str, 
    data: Dict[str, Any] = Body(default={}),
    db: Annotated[Session, Depends(get_db)]
):
    """
    Debug endpoint for book extraction
    """
    try:
        # Get book info from database
        book = get_book_by_id(db, book_id)
        if not book:
            logger.error(f"Book with ID {book_id} not found")
            return {
                "status": "error",
                "message": f"Book with ID {book_id} not found in database",
                "book_id": book_id
            }
            
        # Get the BookExtractor for info purposes
        from app.services.book_extraction import BookExtractor
        extractor = BookExtractor()
        
        # Return detailed diagnostic information
        return {
            "status": "debug_received",
            "book_id": book_id,
            "book_info": {
                "title": book.title,
                "author": book.author,
                "external_id": book.external_id,
                "status": book.status,
                "chunks_count": book.chunks_count if hasattr(book, 'chunks_count') else None
            },
            "extractor_info": {
                "cache_dir": extractor.cache_dir,
                "screenshots_dir": extractor.screenshots_dir,
                "extraction_timestamp": extractor.get_current_time()
            },
            "request_data": data,
            "message": "Debug extraction request received and processed"
        }
    except Exception as e:
        logger.error(f"Error in debug extraction endpoint: {str(e)}")
        logger.error(traceback.format_exc())
        
        return {
            "status": "error",
            "book_id": book_id,
            "error": str(e),
            "traceback": traceback.format_exc(),
            "message": "Error in debug extraction endpoint"
        }
