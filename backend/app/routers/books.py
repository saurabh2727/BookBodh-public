
from typing import List, Annotated
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.database.models import Book as BookModel
from app.schemas import BookCreate, Book, BookUpdate
from app.database.books import create_book, get_book_by_id, get_books, update_book
import logging
import traceback

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

# Add this new endpoint to trigger Google Books extraction
@router.post("/extract-book/{book_id}", response_model=dict)
async def extract_book_content(book_id: str, db: Annotated[Session, Depends(get_db)]):
    """Extract book content from Google Books"""
    try:
        # Get book info from database
        book = get_book_by_id(db, book_id)
        if not book:
            raise HTTPException(status_code=404, detail=f"Book with ID {book_id} not found")
            
        # If the book has an external_id (Google Books ID), use it for extraction
        source_id = book.external_id or book_id
        title = book.title or "Unknown Title"
        author = book.author or "Unknown Author"
        
        # Get an instance of the BookExtractor
        from app.services.book_extraction import BookExtractor
        extractor = BookExtractor()
        
        # Extract content from Google Books
        logging.info(f"Starting extraction for book {book_id} (Google Books ID: {source_id})")
        extracted_text, screenshot_paths = extractor.extract_from_google_books(source_id, title)
        
        logging.info(f"Extraction completed. Got {len(extracted_text)} chars of text and {len(screenshot_paths)} screenshots")
        
        # Process the extracted text into chunks
        chunks = extractor.process_book_to_chunks(book_id, extracted_text, title, author)
        
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
        for chunk in chunks:
            create_book_chunk(db, book_id, chunk["chunk_index"], chunk["text"], title, author)
        
        return {
            "success": True,
            "book_id": book_id,
            "chunk_count": len(chunks),
            "screenshots": len(screenshot_paths),
            "text_length": len(extracted_text)
        }
    except Exception as e:
        logging.error(f"Error extracting book content: {str(e)}")
        logging.error(traceback.format_exc())
        # Update book status to error
        try:
            update_book(db, book_id, {"status": "extraction_error", "summary": f"Error extracting: {str(e)}"})
        except:
            pass
        
        raise HTTPException(status_code=500, detail=f"Error extracting book content: {str(e)}")

from app.database.books import create_book_chunk
