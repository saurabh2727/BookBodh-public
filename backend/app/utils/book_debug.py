
import logging
import traceback
from typing import Dict, Any

# Configure logger
logger = logging.getLogger(__name__)

def debug_extract_book_handler(book_id: str, data: Dict[str, Any], db):
    """
    Debug endpoint for book extraction
    
    Args:
        book_id: UUID of the book in the database
        data: Optional request data
        db: Database session
        
    Returns:
        Debug information as a dictionary
    """
    try:
        # Get book info from database
        from app.database.books import get_book_by_id
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
