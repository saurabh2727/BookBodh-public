
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
                logger.info(f"Found book data: {book_data.get('title')}")
                
                # Check if this is a Google Books ID
                google_books_id = book_data.get('external_id')
                file_url = book_data.get('file_url', '')
                
                logger.info(f"Book file URL: {file_url}")
                logger.info(f"Book external_id (Google Books ID): {google_books_id}")
                
                # If we have a Google Books ID, use that for extraction
                extraction_id = google_books_id or book_id
                if extraction_id:
                    logger.info(f"This book doesn't have chunks yet, but we won't trigger extraction here.")
                    logger.info(f"The extraction should be triggered by the add-book function.")
                    logger.info(f"Book status: {book_data.get('status')}")
                    
                    # Check if the book is currently being extracted
                    if book_data.get('status') == 'extracting':
                        return [{
                            "text": "This book is currently being processed. Please check back in a moment.",
                            "title": book_data.get('title', 'Unknown'),
                            "author": book_data.get('author', 'Unknown'),
                            "score": 1.0
                        }]
                    elif book_data.get('status') == 'error':
                        return [{
                            "text": f"There was an error processing this book. {book_data.get('summary', '')}",
                            "title": book_data.get('title', 'Unknown'),
                            "author": book_data.get('author', 'Unknown'),
                            "score": 1.0
                        }]
            
            # If we've tried everything and still no chunks, return a message
            return [{
                "text": "No content has been extracted for this book yet. Please check back later.",
                "title": "Book Processing",
                "author": "System",
                "score": 1.0
            }]
    
    return chunks
