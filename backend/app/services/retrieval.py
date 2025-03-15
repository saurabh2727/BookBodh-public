
from app.database.books import BookDatabase
from app.database.embeddings import EmbeddingStore
from typing import List, Dict, Optional

# Initialize database and embedding store
book_db = BookDatabase()
embedding_store = EmbeddingStore(book_db)

def retrieve_chunks(query: str, book: Optional[str] = None) -> List[Dict]:
    """
    Retrieve relevant chunks from the book database based on the query
    
    Args:
        query: The user's question or query
        book: Optional book title to filter results
        
    Returns:
        List of dictionaries containing text chunks and metadata
    """
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
    
    return chunks
