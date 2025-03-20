from app.database.books import BookDatabase
from app.database.embeddings import EmbeddingStore
from typing import List, Dict, Optional
import logging
import os
import json
import time
from app.services.book_extraction import BookExtractor

# Configure logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize database, embedding store, and book extractor
book_db = BookDatabase()
embedding_store = EmbeddingStore(book_db)
book_extractor = BookExtractor()

def retrieve_chunks(query: str, book: Optional[str] = None, book_id: Optional[str] = None) -> List[Dict]:
    """
    Retrieve relevant chunks from the book database based on the query
    
    Args:
        query: The user's question or query
        book: Optional book title to filter results
        book_id: Optional book ID to filter results
        
    Returns:
        List of dictionaries containing text chunks and metadata
    """
    # Print debug information
    logger.info(f"Retrieving chunks for query: {query}, book: {book}, book_id: {book_id}")
    
    chunks = []
    
    # If book_id is provided, get all chunks for that book
    if book_id:
        # Log that we're using book_id for retrieval
        logger.info(f"Using book_id {book_id} for retrieval")
        
        # Get all books and their IDs for debugging
        all_books = book_db.get_books()
        logger.info(f"Available books in database: {len(all_books)}")
        for b in all_books:
            logger.info(f"Book: {b.get('title', 'Unknown')}, ID: {b.get('id', 'None')}")
        
        # Get all chunks for this book from the database
        book_chunks = book_db.get_chunks_by_book_id(book_id)
        
        if book_chunks:
            logger.info(f"Found {len(book_chunks)} chunks for book_id {book_id}")
            # Sample debug of first chunk
            if book_chunks and len(book_chunks) > 0:
                first_chunk = book_chunks[0]
                logger.info(f"First chunk sample: title={first_chunk.get('title', 'Unknown')}, " + 
                          f"text_length={len(first_chunk.get('text', ''))}, " +
                          f"book_id={first_chunk.get('book_id', 'None')}")
            
            for chunk_data in book_chunks:
                chunks.append({
                    "text": chunk_data["text"],
                    "title": chunk_data["title"],
                    "author": chunk_data.get("author", "Unknown"),
                    "score": 1.0  # Direct match, so highest score
                })
            
            return chunks
        else:
            logger.warning(f"No chunks found for book_id {book_id}")
            
            # Try to get the book details
            book_data = book_db.get_book(book_id)
            if book_data:
                logger.info(f"Found book data: {book_data.get('title')}, attempting extraction")
                
                # Check if this is a Google Books ID
                google_books_id = None
                file_url = book_data.get('file_url', '')
                
                logger.info(f"Book file URL: {file_url}")
                
                if 'books.google' in file_url or 'play.google' in file_url:
                    # Try to extract Google Books ID from URL
                    if 'id=' in file_url:
                        google_books_id = file_url.split('id=')[1].split('&')[0]
                    elif '/books?id=' in file_url:
                        google_books_id = file_url.split('/books?id=')[1].split('&')[0]
                    elif '/books/edition/' in file_url:
                        parts = file_url.split('/books/edition/')
                        if len(parts) > 1 and '/' in parts[1]:
                            google_books_id = parts[1].split('/')[0]
                    
                    logger.info(f"Extracted Google Books ID: {google_books_id}")
                else:
                    # For other file types (like PDF uploads), try to use the book_id directly
                    logger.info(f"Not a Google Books URL, will use book_id for extraction: {book_id}")
                
                # If we have a Google Books ID or can use the book_id directly
                extraction_id = google_books_id or book_id
                if extraction_id:
                    logger.info(f"Attempting to extract content using Selenium/OCR for book ID: {extraction_id}")
                    
                    try:
                        # Extract content using Selenium and OCR
                        extracted_text, screenshot_paths = book_extractor.extract_from_google_books(
                            extraction_id, 
                            book_data.get('title', 'Unknown Book')
                        )
                        
                        logger.info(f"Extraction completed with {len(screenshot_paths)} screenshots")
                        logger.info(f"Extracted text length: {len(extracted_text)} characters")
                        
                        if extracted_text and len(extracted_text) > 200:
                            logger.info(f"Successfully extracted {len(extracted_text)} chars of text using Selenium/OCR")
                            
                            # Process into chunks
                            ocr_chunks = book_extractor.process_book_to_chunks(
                                book_id,
                                extracted_text,
                                book_data.get('title', 'Unknown'),
                                book_data.get('author', 'Unknown')
                            )
                            
                            logger.info(f"Processing completed. Created {len(ocr_chunks)} chunks")
                            
                            # Add chunks to database
                            success_count = 0
                            for chunk in ocr_chunks:
                                try:
                                    chunk_result = book_db.add_chunk(
                                        book_id=book_id,
                                        chunk_index=chunk['chunk_index'],
                                        title=chunk['title'],
                                        text=chunk['text'],
                                        author=chunk['author']
                                    )
                                    logger.info(f"Added chunk {chunk['chunk_index']} with result: {chunk_result}")
                                    success_count += 1
                                except Exception as chunk_error:
                                    logger.error(f"Error adding chunk {chunk['chunk_index']}: {str(chunk_error)}")
                            
                            logger.info(f"Added {success_count} chunks to database for book_id {book_id}")
                            
                            # Now retrieve the chunks again
                            book_chunks = book_db.get_chunks_by_book_id(book_id)
                            
                            if book_chunks:
                                logger.info(f"Retrieved {len(book_chunks)} chunks after extraction")
                                for chunk_data in book_chunks:
                                    chunks.append({
                                        "text": chunk_data["text"],
                                        "title": chunk_data["title"],
                                        "author": chunk_data.get("author", "Unknown"),
                                        "score": 1.0
                                    })
                                return chunks
                            else:
                                logger.warning("No chunks found in database after adding them - database issue?")
                        else:
                            logger.warning(f"Failed to extract sufficient text using Selenium/OCR: {len(extracted_text) if extracted_text else 0} chars")
                    except Exception as e:
                        logger.error(f"Error during Selenium/OCR extraction: {str(e)}", exc_info=True)
            
            # Try to reload the database cache
            try:
                logger.info("Attempting to reload book database cache")
                # Force cache reload
                book_db._load_external_books()
                
                # Try again after reload
                book_chunks = book_db.get_chunks_by_book_id(book_id)
                if book_chunks:
                    logger.info(f"Found {len(book_chunks)} chunks after reloading cache")
                    for chunk_data in book_chunks:
                        chunks.append({
                            "text": chunk_data["text"],
                            "title": chunk_data["title"],
                            "author": chunk_data.get("author", "Unknown"),
                            "score": 1.0
                        })
                    return chunks
                else:
                    logger.warning(f"Still no chunks found after cache reload")
                    
                    # Direct database check for debugging
                    try:
                        # Check if the book exists in JSON cache on disk
                        cache_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "cache")
                        book_cache_path = os.path.join(cache_dir, f"book_{book_id}.json")
                        
                        if os.path.exists(book_cache_path):
                            logger.info(f"Found book cache file: {book_cache_path}")
                            with open(book_cache_path, 'r') as f:
                                book_data = json.load(f)
                                logger.info(f"Book cache contains: {book_data.keys()}")
                                
                                # Check if the cache has chunks
                                if 'chunks' in book_data and book_data['chunks']:
                                    logger.info(f"Book cache has {len(book_data['chunks'])} chunks")
                                    # Use chunks from the cache directly
                                    for chunk_data in book_data['chunks']:
                                        chunks.append({
                                            "text": chunk_data["text"],
                                            "title": chunk_data.get("title", f"Chunk {chunk_data.get('chunk_index', 0)}"),
                                            "author": chunk_data.get("author", "Unknown"),
                                            "score": 1.0
                                        })
                                    logger.info(f"Returning {len(chunks)} chunks from cache file")
                                    return chunks
                                else:
                                    logger.warning("Book cache doesn't contain chunks")
                        else:
                            logger.warning(f"No cache file found for book_id {book_id}")
                            
                    except Exception as cache_error:
                        logger.error(f"Error accessing cache file: {cache_error}")
            except Exception as e:
                logger.error(f"Error reloading cache: {e}")
                
            # If we've tried everything and still no chunks, check if we can generate
            # them dynamically from the book data
            try:
                book_data = book_db.get_book(book_id)
                if book_data and 'text' in book_data and book_data['text']:
                    logger.info("Found book data with text, generating chunks dynamically")
                    # Generate chunks from the full text
                    full_text = book_data['text']
                    chunk_size = 1000  # characters per chunk, adjust as needed
                    
                    # Simple chunking by character count
                    for i in range(0, len(full_text), chunk_size):
                        chunk_text = full_text[i:i+chunk_size]
                        chunks.append({
                            "text": chunk_text,
                            "title": f"{book_data.get('title', 'Unknown')} - Part {i//chunk_size + 1}",
                            "author": book_data.get("author", "Unknown"),
                            "score": 1.0
                        })
                    
                    logger.info(f"Generated {len(chunks)} chunks dynamically")
                    return chunks
                else:
                    logger.warning("No full text available for dynamic chunking")
            except Exception as gen_error:
                logger.error(f"Error generating chunks dynamically: {gen_error}")
    
    return chunks
