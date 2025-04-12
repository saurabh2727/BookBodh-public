
from typing import List, Annotated, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.database.models import Book as BookModel
from app.schemas import BookCreate, Book, BookUpdate
from app.database.books import create_book, get_book_by_id, get_books, update_book
from app.utils.book_extraction import extract_book_content_handler
from app.utils.book_debug import debug_extract_book_handler
import logging

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
    """
    return extract_book_content_handler(book_id, data, db)

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
    return debug_extract_book_handler(book_id, data, db)
