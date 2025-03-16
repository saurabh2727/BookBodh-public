
from app.database.books import BookDatabase
from app.database.embeddings import EmbeddingStore
from typing import List, Dict, Optional

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
    print(f"Retrieving chunks for query: {query}, book: {book}, book_id: {book_id}")
    
    # If book_id is provided, get all chunks for that book
    if book_id:
        # Log that we're using book_id for retrieval
        print(f"Using book_id {book_id} for retrieval")
        
        # Get all chunks for this book from the database
        chunks = []
        book_chunks = book_db.get_chunks_by_book_id(book_id)
        
        if book_chunks:
            for chunk_data in book_chunks:
                chunks.append({
                    "text": chunk_data["text"],
                    "title": chunk_data["title"],
                    "author": chunk_data["author"],
                    "score": 1.0  # Direct match, so highest score
                })
            
            print(f"Found {len(chunks)} chunks for book_id {book_id}")
            return chunks
        else:
            print(f"No chunks found for book_id {book_id}")
    
    # If no book_id or no chunks found with book_id, try using book title
    if book and not chunks:
        print(f"Using book title '{book}' for retrieval")
        
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
                    "author": chunk_data["author"],
                    "score": float(score)
                })
        
        print(f"Found {len(chunks)} chunks using semantic search for book '{book}'")
    
    # If no book specified or no chunks found with book title, try general search
    if not book and not book_id or not chunks:
        print("Using general search across all books")
        
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
                    "author": chunk_data["author"],
                    "score": float(score)
                })
        
        print(f"Found {len(chunks)} chunks using general search")
    
    return chunks
