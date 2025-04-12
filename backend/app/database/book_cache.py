
import os
import json
import logging
from typing import Dict, List, Optional, Any

# Configure logger
logger = logging.getLogger(__name__)

class BookCache:
    """Handles loading and saving book data to disk cache"""
    
    def __init__(self):
        """Initialize the cache handler"""
        self.cache_file = os.path.join(os.path.dirname(__file__), "books_cache.json")
    
    def load_books_cache(self) -> Optional[Dict[str, Any]]:
        """
        Load books and chunks from cache file
        
        Returns:
            Dictionary containing books and chunks or None if loading fails
        """
        try:
            if os.path.exists(self.cache_file):
                logger.info(f"Loading books cache from {self.cache_file}")
                with open(self.cache_file, 'r') as f:
                    external_data = json.load(f)
                    # Verify the structure of the loaded data
                    if not isinstance(external_data, dict):
                        logger.warning(f"Invalid cache file format: expected dictionary, got {type(external_data)}")
                        return None
                    
                    # Check that required keys exist
                    if "books" not in external_data or "chunks" not in external_data:
                        logger.warning("Invalid cache file: missing 'books' or 'chunks' keys")
                        return None
                    
                    # Check that books is a dictionary
                    if not isinstance(external_data["books"], dict):
                        logger.warning(f"Invalid cache file: 'books' is not a dictionary: {type(external_data['books'])}")
                        return None
                    
                    # Check that chunks is a list
                    if not isinstance(external_data["chunks"], list):
                        logger.warning(f"Invalid cache file: 'chunks' is not a list: {type(external_data['chunks'])}")
                        return None
                    
                    return external_data
            return None
        except Exception as e:
            logger.error(f"Error loading external books: {e}", exc_info=True)
            return None
    
    def save_books_cache(self, books: Dict[str, Dict], chunks: List[Dict]) -> bool:
        """
        Save current books and chunks to a cache file for persistence
        
        Args:
            books: Dictionary of books
            chunks: List of chunks
            
        Returns:
            Success flag
        """
        try:
            # Format data for saving - Fix the incorrect dictionary structure by properly handling book IDs
            data = {
                "books": {book_id: {
                    "title": book_data.get("title", f"Book {book_id}"),
                    "author": book_data.get("author", "Unknown"),
                    "content": book_data.get("content", ""),
                    "external_id": book_data.get("external_id", ""),  # Added external_id for Google Books
                    "status": book_data.get("status", "processed"),
                    "chunks_count": book_data.get("chunks_count", 0),
                    "summary": book_data.get("summary", ""),
                    "file_url": book_data.get("file_url", "")
                } for book_id, book_data in books.items()},
                "chunks": chunks
            }
            
            with open(self.cache_file, 'w') as f:
                json.dump(data, f, indent=2)
                
            logger.info(f"Saved {len(books)} books and {len(chunks)} chunks to cache")
            return True
        except Exception as e:
            logger.error(f"Error saving books to cache: {e}", exc_info=True)
            return False
