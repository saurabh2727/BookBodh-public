from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Request
from fastapi.responses import JSONResponse
from typing import List, Dict, Optional
import os
import uuid
import httpx
import logging
import traceback
import datetime

from app.config.settings import settings
from app.database.books import BookDatabase
from app.database.embeddings import EmbeddingStore

# Configure logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(tags=["books"])

def get_book_db():
    return BookDatabase()

def get_embedding_store(book_db: BookDatabase = Depends(get_book_db)):
    return EmbeddingStore(book_db)

async def trigger_extraction(book_id: str, external_id: str = None):
    """
    Background task to trigger extraction for a newly added book
    """
    try:
        logger.info(f"Starting extraction for book_id={book_id}, external_id={external_id}")
        
        # Create book database instance
        book_db = BookDatabase()
        
        # Update book status to extracting
        book_db.update_book_status(book_id, "extracting")
        
        # Create the extractor helper
        from app.services.book_extraction import BookExtractor
        extractor = BookExtractor()
        
        # Get book details from database
        book_details = book_db.get_book(book_id)
        if not book_details:
            logger.error(f"Book not found in database: {book_id}")
            book_db.update_book_status(book_id, "error", "Book not found in database")
            return
        
        title = book_details.get('title', 'Unknown Title')
        author = book_details.get('author', 'Unknown Author')
        
        # Determine which ID to use for Google Books
        # IMPORTANT: We prioritize external_id (Google Books ID) over database ID
        extraction_id = external_id or book_details.get('external_id') or book_id
        
        logger.info(f"Using ID for Google Books extraction: {extraction_id}")
        logger.info(f"Book title: {title}, Author: {author}")
        
        # Extract text from Google Books
        extracted_text, screenshot_paths = extractor.extract_from_google_books(
            book_id=extraction_id,  # Use the Google Books ID here!
            title=title,
            max_pages=30  # Increase from default 20
        )
        
        logger.info(f"Extraction completed with {len(screenshot_paths)} screenshots")
        logger.info(f"Extracted text length: {len(extracted_text)} characters")
        
        # Process the extracted text into chunks
        if extracted_text and len(extracted_text) > 200:
            chunks = extractor.process_book_to_chunks(
                book_id=book_id,  # Use the database ID for storage
                text=extracted_text,
                title=title,
                author=author
            )
            
            logger.info(f"Created {len(chunks)} chunks from extracted text")
            
            # Add chunks to database
            successful_chunks = 0
            for chunk in chunks:
                try:
                    book_db.add_chunk(
                        book_id=book_id,  # Use the database ID for storage
                        chunk_index=chunk['chunk_index'],
                        title=chunk['title'],
                        text=chunk['text'],
                        author=chunk['author']
                    )
                    successful_chunks += 1
                except Exception as e:
                    logger.error(f"Error adding chunk {chunk['chunk_index']}: {str(e)}")
            
            # Update book status
            if successful_chunks > 0:
                book_db.update_book(
                    book_id=book_id,
                    status="processed",
                    chunks_count=successful_chunks
                )
                logger.info(f"Book marked as processed with {successful_chunks} chunks")
            else:
                book_db.update_book_status(
                    book_id=book_id,
                    status="error",
                    summary=f"Failed to add any chunks. Extraction produced text but chunks couldn't be stored."
                )
                logger.error(f"No chunks could be stored for book {book_id}")
        else:
            logger.error(f"Insufficient text extracted: {len(extracted_text) if extracted_text else 0} chars")
            book_db.update_book_status(
                book_id=book_id,
                status="error", 
                summary=f"Insufficient text extracted: {len(extracted_text) if extracted_text else 0} characters"
            )
    except Exception as e:
        logger.error(f"Exception during extraction process: {str(e)}", exc_info=True)
        try:
            # Try to update the book status to error
            book_db = BookDatabase()
            book_db.update_book_status(
                book_id=book_id, 
                status="error", 
                summary=f"Extraction error: {str(e)}"
            )
        except Exception as update_error:
            logger.error(f"Failed to update book status after error: {str(update_error)}")

# The direct upload-book endpoint is no longer needed since we're using Google Books API
# We'll keep a simplified endpoint for API compatibility
@router.post("/upload-book", status_code=202)
async def upload_book_compatibility(background_tasks: BackgroundTasks):
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

@router.post("/extract-book/{book_id}", status_code=202)
async def extract_book(
    request: Request,
    book_id: str, 
    background_tasks: BackgroundTasks, 
    external_id: Optional[str] = None,
    force: bool = False
):
    """
    Endpoint to trigger extraction for a newly added book
    """
    try:
        logger.info(f"Extract book endpoint called for book_id={book_id}, external_id={external_id}, force={force}")
        
        # Log the request headers and body for debugging
        logger.info(f"Request headers: {dict(request.headers)}")
        
        try:
            body = await request.json()
            logger.info(f"Request body: {body}")
            # If external_id wasn't provided as a query param, try to get it from the body
            if not external_id and 'external_id' in body:
                external_id = body['external_id']
                logger.info(f"Using external_id from request body: {external_id}")
        except Exception as e:
            logger.warning(f"Could not parse request body as JSON: {e}")
        
        # Safe accessor for BookDatabase
        try:
            book_db = BookDatabase()
        except Exception as db_error:
            logger.error(f"Error initializing BookDatabase: {str(db_error)}", exc_info=True)
            return JSONResponse(
                status_code=500,
                content={
                    "status": "error",
                    "book_id": book_id,
                    "message": f"Database connection error: {str(db_error)}"
                }
            )
        
        # If force is False, check if the book already has chunks
        if not force:
            try:
                book = book_db.get_book(book_id)
                if not book:
                    logger.warning(f"Book {book_id} not found in database")
                    return JSONResponse(
                        status_code=404,
                        content={
                            "status": "error",
                            "book_id": book_id,
                            "message": f"Book with ID {book_id} not found"
                        }
                    )
                
                logger.info(f"Book details: {book}")
                
                chunks = book_db.get_chunks_by_book_id(book_id)
                
                if book and book.get('status') == 'processed' and chunks and len(chunks) > 0:
                    logger.info(f"Book {book_id} already has {len(chunks)} chunks and is marked as processed")
                    return JSONResponse(
                        status_code=200,
                        content={
                            "status": "already_processed",
                            "book_id": book_id,
                            "chunks_count": len(chunks),
                            "message": "Book already has extracted content. Use force=true to re-extract."
                        }
                    )
            except Exception as check_error:
                logger.error(f"Error checking book status: {str(check_error)}", exc_info=True)
                return JSONResponse(
                    status_code=500,
                    content={
                        "status": "error",
                        "book_id": book_id,
                        "message": f"Error checking book status: {str(check_error)}"
                    }
                )
        
        # Now passing both IDs to the background task
        try:
            background_tasks.add_task(trigger_extraction, book_id, external_id)
            logger.info(f"Extraction task added to background tasks for book_id={book_id}, external_id={external_id}")
        except Exception as task_error:
            logger.error(f"Error adding background task: {str(task_error)}", exc_info=True)
            return JSONResponse(
                status_code=500,
                content={
                    "status": "error",
                    "book_id": book_id,
                    "message": f"Error queuing extraction task: {str(task_error)}"
                }
            )
        
        return JSONResponse(
            status_code=202,
            content={
                "status": "initiated",
                "book_id": book_id,
                "external_id": external_id,
                "message": "Book extraction process has been initiated"
            }
        )
    except Exception as e:
        logger.error(f"Unhandled exception in extract_book: {str(e)}", exc_info=True)
        # Return JSON instead of letting FastAPI generate an HTML error
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "book_id": book_id,
                "message": f"Server error: {str(e)}",
                "traceback": traceback.format_exc()
            }
        )

@router.post("/books/{book_id}/extract", status_code=202)
async def trigger_book_extraction(
    request: Request,
    book_id: str, 
    background_tasks: BackgroundTasks, 
    external_id: Optional[str] = None,
    force: bool = False
):
    """
    Endpoint to manually trigger extraction for a book
    """
    try:
        logger.info(f"Manual extraction triggered for book_id={book_id}, external_id={external_id}, force={force}")
        
        # Log the request headers and body for debugging
        logger.info(f"Request headers: {dict(request.headers)}")
        
        try:
            body = await request.json()
            logger.info(f"Request body: {body}")
            # If external_id wasn't provided as a query param, try to get it from the body
            if not external_id and 'external_id' in body:
                external_id = body['external_id']
                logger.info(f"Using external_id from request body: {external_id}")
        except Exception as e:
            logger.warning(f"Could not parse request body as JSON: {e}")
        
        try:
            background_tasks.add_task(trigger_extraction, book_id, external_id)
            logger.info(f"Extraction task added to background tasks for book_id={book_id}, external_id={external_id}")
        except Exception as task_error:
            logger.error(f"Error adding background task: {str(task_error)}", exc_info=True)
            return JSONResponse(
                status_code=500,
                content={
                    "status": "error",
                    "book_id": book_id,
                    "message": f"Error queuing extraction task: {str(task_error)}"
                }
            )
            
        return JSONResponse(
            status_code=202,
            content={
                "status": "initiated",
                "book_id": book_id,
                "external_id": external_id,
                "message": "Book extraction process has been initiated"
            }
        )
    except Exception as e:
        logger.error(f"Unhandled exception in trigger_book_extraction: {str(e)}", exc_info=True)
        # Return JSON instead of letting FastAPI generate an HTML error
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "book_id": book_id,
                "message": f"Server error: {str(e)}",
                "traceback": traceback.format_exc()
            }
        )

# Add a special debug endpoint
@router.post("/debug-extract/{book_id}", status_code=202)
async def debug_extract_endpoint(
    request: Request,
    book_id: str, 
    background_tasks: BackgroundTasks
):
    """
    Debug endpoint to verify API routing is working
    """
    try:
        # Log request information
        logger.info(f"Debug extract endpoint called for book_id={book_id}")
        logger.info(f"Request method: {request.method}")
        logger.info(f"Request URL: {request.url}")
        logger.info(f"Request headers: {dict(request.headers)}")
        
        # Try to parse body if any
        try:
            body = await request.json()
            logger.info(f"Request body: {body}")
        except Exception as e:
            logger.info(f"No JSON body or error parsing: {e}")
        
        # Return a simple JSON response to confirm API is working
        return JSONResponse(
            status_code=202,
            content={
                "status": "success",
                "message": "Debug API endpoint is working",
                "book_id": book_id,
                "api_routing": "confirmed_working",
                "timestamp": str(datetime.datetime.now())
            }
        )
    except Exception as e:
        logger.error(f"Error in debug endpoint: {str(e)}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "status": "error", 
                "message": f"Server error in debug endpoint: {str(e)}"
            }
        )
