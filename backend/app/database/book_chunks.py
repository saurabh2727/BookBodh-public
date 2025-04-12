
import logging
from sqlalchemy.orm import Session
from typing import Optional

# Configure logger
logger = logging.getLogger(__name__)

def create_book_chunk(db: Session, book_id: str, chunk_index: int, text: str, title: str, author: str = None):
    """
    Create a new book chunk in the database
    
    Args:
        db: Database session
        book_id: ID of the book this chunk belongs to
        chunk_index: Index of the chunk within the book
        text: Text content of the chunk
        title: Book title
        author: Book author
        
    Returns:
        Created chunk or None if creation fails
    """
    from app.database.models import BookChunk
    
    try:
        # Create a summary from the first ~100 characters of the chunk
        summary = text[:100] + ("..." if len(text) > 100 else "")
        
        chunk = BookChunk(
            book_id=book_id,
            chunk_index=chunk_index,
            text=text,
            title=title,
            author=author,
            summary=summary
        )
        
        db.add(chunk)
        db.commit()
        db.refresh(chunk)
        return chunk
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating book chunk: {str(e)}")
        return None

def get_chunks_by_book_id(db: Session, book_id: str, skip: int = 0, limit: int = 100):
    """
    Get chunks for a specific book from SQLAlchemy database
    
    Args:
        db: Database session
        book_id: Book ID
        skip: Number of records to skip
        limit: Maximum number of records to return
        
    Returns:
        List of chunks
    """
    from app.database.models import BookChunk
    
    try:
        return db.query(BookChunk).filter(BookChunk.book_id == book_id) \
                .order_by(BookChunk.chunk_index) \
                .offset(skip).limit(limit).all()
    except Exception as e:
        logger.error(f"Error getting chunks for book {book_id}: {str(e)}")
        return []

def get_chunk_by_id(db: Session, chunk_id: int) -> Optional[object]:
    """
    Get a specific chunk by ID from SQLAlchemy database
    
    Args:
        db: Database session
        chunk_id: Chunk ID
        
    Returns:
        Chunk or None if not found
    """
    from app.database.models import BookChunk
    
    try:
        return db.query(BookChunk).filter(BookChunk.id == chunk_id).first()
    except Exception as e:
        logger.error(f"Error getting chunk {chunk_id}: {str(e)}")
        return None
