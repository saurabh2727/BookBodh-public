
import numpy as np
import os
from typing import List, Tuple, Optional, Dict
from sentence_transformers import SentenceTransformer
import faiss
import threading
import logging

from app.config.settings import settings

# Configure logger
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

# Thread lock for concurrent access to the FAISS index
index_lock = threading.Lock()

def process_book(book_db, embedding_store, title, author, text):
    """Process a book and add it to the database and embedding store"""
    try:
        # Add book to database
        book_id = book_db.add_book(title, author, text)
        
        # Update embeddings
        embedding_store.update_index()
        
        logger.info(f"Successfully processed book: {title}")
        return True
    except Exception as e:
        logger.error(f"Error processing book {title}: {str(e)}")
        return False

class EmbeddingStore:
    def __init__(self, book_database):
        """
        Initialize embedding store with sentence transformer model and FAISS index
        
        Args:
            book_database: Instance of BookDatabase containing book chunks
        """
        self.book_db = book_database
        self.model = SentenceTransformer(settings.EMBEDDING_MODEL)
        
        # Generate embeddings for all chunks
        self.chunks = book_database.get_all_chunks()
        self.chunk_ids = [chunk["id"] for chunk in self.chunks]
        texts = [chunk["text"] for chunk in self.chunks]
        
        # Generate embeddings
        if texts:
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
        else:
            # Create empty index if no texts
            self.dimension = 384  # Default dimension for all-MiniLM-L6-v2
            self.index = faiss.IndexFlatL2(self.dimension)
            self.embeddings = np.array([]).reshape(0, self.dimension)
            self.book_to_indices = {}
    
    def update_index(self):
        """Update the FAISS index with new books/chunks"""
        with index_lock:
            # Get all chunks including newly added ones
            new_chunks = self.book_db.get_all_chunks()
            new_chunk_ids = [chunk["id"] for chunk in new_chunks]
            
            # Find new chunks (not in current index)
            current_ids = set(self.chunk_ids)
            new_ids = set(new_chunk_ids)
            ids_to_add = new_ids - current_ids
            
            if not ids_to_add:
                logger.info("No new chunks to add to the index")
                return
                
            # Get texts for new chunks only
            new_texts = []
            new_id_list = []
            for i, chunk_id in enumerate(new_chunk_ids):
                if chunk_id in ids_to_add:
                    new_texts.append(new_chunks[i]["text"])
                    new_id_list.append(chunk_id)
            
            # Generate embeddings for new texts
            if new_texts:
                logger.info(f"Generating embeddings for {len(new_texts)} new chunks")
                new_embeddings = self.model.encode(new_texts)
                
                # Update index
                self.index.add(np.array(new_embeddings).astype('float32'))
                
                # Update instance variables
                self.chunks = new_chunks
                self.chunk_ids = new_chunk_ids
                self.embeddings = np.vstack([self.embeddings, new_embeddings]) if self.embeddings.size > 0 else new_embeddings
                
                # Update book to indices mapping
                self.book_to_indices = {}
                for i, chunk in enumerate(self.chunks):
                    title = chunk["title"]
                    if title not in self.book_to_indices:
                        self.book_to_indices[title] = []
                    self.book_to_indices[title].append(i)
                    
                logger.info(f"Index updated with {len(new_texts)} new chunks")
    
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
        
        with index_lock:
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
