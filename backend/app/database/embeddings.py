
import numpy as np
from typing import List, Tuple, Optional, Dict
from sentence_transformers import SentenceTransformer
import faiss

class EmbeddingStore:
    def __init__(self, book_database):
        """
        Initialize embedding store with sentence transformer model and FAISS index
        
        Args:
            book_database: Instance of BookDatabase containing book chunks
        """
        self.book_db = book_database
        self.model = SentenceTransformer('all-MiniLM-L6-v2')
        
        # Generate embeddings for all chunks
        self.chunks = book_database.get_all_chunks()
        self.chunk_ids = [chunk["id"] for chunk in self.chunks]
        texts = [chunk["text"] for chunk in self.chunks]
        
        # Generate embeddings
        self.embeddings = self.model.encode(texts)
        
        # Create FAISS index
        self.dimension = self.embeddings.shape[1]
        self.index = faiss.IndexFlatL2(self.dimension)
        self.index.add(np.array(self.embeddings).astype('float32'))
        
        # Create book title to chunk mapping for filtering
        self.book_to_indices = {}
        for i, chunk in enumerate(self.chunks):
            title = chunk["title"]
            if title not in self.book_to_indices:
                self.book_to_indices[title] = []
            self.book_to_indices[title].append(i)
    
    def search(self, query: str, k: int = 3, filter_book: Optional[str] = None) -> List[Tuple[int, float]]:
        """
        Search for relevant chunks based on query
        
        Args:
            query: The search query
            k: Number of results to return
            filter_book: Optional book title to filter results
            
        Returns:
            List of tuples (chunk_id, similarity_score)
        """
        # Encode query
        query_embedding = self.model.encode([query])[0].reshape(1, -1).astype('float32')
        
        if filter_book and filter_book in self.book_to_indices:
            # If filtering by book, use only indices from that book
            book_indices = self.book_to_indices[filter_book]
            
            # Extract embeddings for the specific book
            book_embeddings = np.vstack([self.embeddings[i] for i in book_indices])
            
            # Create temporary index
            temp_index = faiss.IndexFlatL2(self.dimension)
            temp_index.add(np.array(book_embeddings).astype('float32'))
            
            # Search in temporary index
            D, I = temp_index.search(query_embedding, min(k, len(book_indices)))
            
            # Map back to original chunk IDs
            results = [(self.chunk_ids[book_indices[idx]], score) for idx, score in zip(I[0], D[0])]
            
        else:
            # Search across all books
            D, I = self.index.search(query_embedding, k)
            results = [(self.chunk_ids[idx], score) for idx, score in zip(I[0], D[0])]
        
        return results
