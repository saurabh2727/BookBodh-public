
import logging
import traceback
import json
from typing import Dict, Any

# Configure detailed logging for this module
logger = logging.getLogger(__name__)

def handle_extraction_error(book_id: str, error: Exception, db):
    """
    Handle errors during book extraction
    
    Args:
        book_id: ID of the book being extracted
        error: The exception that occurred
        db: Database session
    
    Returns:
        Error response dict
    """
    logger.error(f"Error extracting book content: {str(error)}")
    logger.error(traceback.format_exc())
    
    # Update book status to error
    try:
        from app.database.books import update_book
        update_book(db, book_id, {
            "status": "extraction_error", 
            "summary": f"Error extracting: {str(error)[:200]}..."
        })
    except Exception as update_error:
        logger.error(f"Error updating book status: {str(update_error)}")
    
    # Return detailed error response
    from app.services.book_extraction import BookExtractor
    return {
        "success": False,
        "book_id": book_id,
        "error": str(error),
        "status": "extraction_error",
        "timestamp": BookExtractor().get_current_time() if 'BookExtractor' in globals() else None
    }

def extract_book_content_handler(book_id: str, data: Dict[str, Any], db):
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
        from app.database.books import get_book_by_id
        book = get_book_by_id(db, book_id)
        if not book:
            logger.error(f"Book with ID {book_id} not found")
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail=f"Book with ID {book_id} not found")
            
        # Check if external_id was provided in the request or use the one from the database
        external_id = data.get('external_id') or book.external_id
        force = data.get('force', False)
        
        if not external_id:
            logger.error(f"No external_id available for book {book_id}")
            from fastapi import HTTPException
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
        from app.database.books import update_book
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
        from app.database.book_chunks import create_book_chunk
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
        return handle_extraction_error(book_id, e, db)
