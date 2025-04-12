
import logging
from typing import List, Dict, Optional, Any
from sqlalchemy.orm import Session

from app.database.book_database import BookDatabase
from app.database.book_chunks import create_book_chunk
from app.database.models import Book as BookModel

# Configure logger
logger = logging.getLogger(__name__)

# Initialize the book database (singleton)
_book_db = BookDatabase()

def create_book(db: Session, book: Any) -> BookModel:
    """
    Create a new book in the database
    
    Args:
        db: Database session
        book: Book data
        
    Returns:
        Created book model
    """
    try:
        # Extract book data
        title = book.title
        author = book.author
        content = book.content if hasattr(book, 'content') else ""
        external_id = book.external_id if hasattr(book, 'external_id') else None
        
        # Add to BookDatabase
        book_id = _book_db.add_book(title, author, content)
        
        # Create SQLAlchemy model
        db_book = BookModel(
            id=book_id,
            title=title,
            author=author,
            external_id=external_id
        )
        
        db.add(db_book)
        db.commit()
        db.refresh(db_book)
        
        logger.info(f"Created book: {title} with ID {book_id}")
        return db_book
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating book: {str(e)}")
        raise

def get_book_by_id(db: Session, book_id: str) -> Optional[BookModel]:
    """
    Get a book by ID
    
    Args:
        db: Database session
        book_id: Book ID
        
    Returns:
        Book model or None if not found
    """
    try:
        # Try to get from SQLAlchemy
        db_book = db.query(BookModel).filter(BookModel._id == book_id).first()
        
        if db_book:
            return db_book
            
        # If not found in SQLAlchemy, try BookDatabase
        book_data = _book_db.get_book(book_id)
        if book_data:
            # Create SQLAlchemy model from BookDatabase data
            return BookModel(
                id=book_id,
                title=book_data.get("title", "Unknown"),
                author=book_data.get("author", "Unknown"),
                external_id=book_data.get("external_id"),
                status=book_data.get("status")
            )
        
        return None
    except Exception as e:
        logger.error(f"Error getting book {book_id}: {str(e)}")
        return None

def get_books(db: Session, skip: int = 0, limit: int = 100) -> List[BookModel]:
    """
    Get all books
    
    Args:
        db: Database session
        skip: Number of records to skip
        limit: Maximum number of records to return
        
    Returns:
        List of book models
    """
    try:
        # Get from SQLAlchemy first
        db_books = db.query(BookModel).offset(skip).limit(limit).all()
        
        # Get from BookDatabase
        memory_books = _book_db.get_books()
        
        # Convert BookDatabase books to SQLAlchemy models
        db_book_ids = {book.id for book in db_books}
        for book in memory_books:
            if book.get("id") not in db_book_ids:
                db_books.append(BookModel(
                    id=book.get("id"),
                    title=book.get("title", "Unknown"),
                    author=book.get("author", "Unknown")
                ))
        
        return db_books[:limit]
    except Exception as e:
        logger.error(f"Error getting books: {str(e)}")
        return []

def update_book(db: Session, book_id: str, book_data: Dict[str, Any]) -> Optional[BookModel]:
    """
    Update a book
    
    Args:
        db: Database session
        book_id: Book ID
        book_data: Book data to update
        
    Returns:
        Updated book model or None if not found
    """
    try:
        # Try to update in BookDatabase
        book_updated = _book_db.update_book(book_id, **book_data)
        
        # Try to update in SQLAlchemy
        db_book = db.query(BookModel).filter(BookModel._id == book_id).first()
        if db_book:
            for key, value in book_data.items():
                if hasattr(db_book, key):
                    setattr(db_book, key, value)
            
            db.commit()
            db.refresh(db_book)
            return db_book
        
        # If not in SQLAlchemy but in BookDatabase, return book from BookDatabase
        if book_updated:
            book_data = _book_db.get_book(book_id)
            if book_data:
                return BookModel(
                    id=book_id,
                    title=book_data.get("title", "Unknown"),
                    author=book_data.get("author", "Unknown"),
                    external_id=book_data.get("external_id"),
                    status=book_data.get("status")
                )
        
        return None
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating book {book_id}: {str(e)}")
        return None

# Expose BookDatabase instance for direct access if needed
def get_book_database():
    """Get the BookDatabase instance"""
    return _book_db
