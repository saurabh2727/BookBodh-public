
from app.database.books import BookDatabase
from app.database.embeddings import EmbeddingStore
from typing import List, Dict, Optional
import logging

# Configure logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize database and embedding store
book_db = BookDatabase()
embedding_store = EmbeddingStore(book_db)

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
            # Try to reload the database cache
            try:
                logger.info("Attempting to reload book database cache")
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
            except Exception as e:
                logger.error(f"Error reloading cache: {e}")
    
    # If no book_id or no chunks found with book_id, try using book title
    if book and not chunks:
        logger.info(f"Using book title '{book}' for retrieval")
        
        # Get embeddings for the query
        results = embedding_store.search(query, k=3, filter_book=book)
        
        # Format results with metadata
        chunks = []
        for chunk_id, score in results:
            chunk_data = book_db.get_chunk(chunk_id)
            if chunk_data:
                chunks.append({
                    "text": chunk_data["text"],
                    "title": chunk_data["title"],
                    "author": chunk_data.get("author", "Unknown"),
                    "score": float(score)
                })
        
        logger.info(f"Found {len(chunks)} chunks using semantic search for book '{book}'")
    
    # If no book specified or no chunks found with book title, try general search
    if (not book and not book_id) or not chunks:
        logger.info("Using general search across all books")
        
        # Get embeddings for the query across all books
        results = embedding_store.search(query, k=3)
        
        # Format results with metadata
        chunks = []
        for chunk_id, score in results:
            chunk_data = book_db.get_chunk(chunk_id)
            if chunk_data:
                chunks.append({
                    "text": chunk_data["text"],
                    "title": chunk_data["title"],
                    "author": chunk_data.get("author", "Unknown"),
                    "score": float(score)
                })
        
        logger.info(f"Found {len(chunks)} chunks using general search")
    
    return chunks
