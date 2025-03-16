
from typing import Dict, List, Optional
import re
import uuid

class BookDatabase:
    def __init__(self):
        """Initialize the book database with sample books"""
        self.books = {
            "The Alchemist": {
                "author": "Paulo Coelho",
                "content": """
Personal Legend is a term coined by Paulo Coelho in his novel "The Alchemist". It refers to what you have always wanted to accomplish. According to Coelho, everyone has a Personal Legend, and discovering this Personal Legend is the primary purpose of one's life.

In the novel, an old king named Melchizedek tells the protagonist Santiago: "When you want something, all the universe conspires in helping you to achieve it." This idea of the universe helping people achieve their Personal Legend is a central theme in the book.

The concept suggests that each person has a unique path or destiny that will fulfill them completely. Finding and pursuing this path leads to true happiness and fulfillment. The book teaches that the journey to achieve one's Personal Legend often involves overcoming obstacles, learning from failures, and listening to one's heart.

Coelho writes: "And, when you want something, all the universe conspires in helping you to achieve it." This suggests that when a person is truly committed to their Personal Legend, forces beyond their control will help them succeed.

Another important quote is: "Everyone seems to have a clear idea of how other people should lead their lives, but none about his or her own." This highlights the importance of following one's own path rather than conforming to others' expectations.

The novel emphasizes that fear is the biggest obstacle to achieving one's Personal Legend. The fear of failure, the unknown, or of disappointing loved ones can prevent people from pursuing their dreams. As the alchemist in the story tells Santiago: "Tell your heart that the fear of suffering is worse than the suffering itself."

Ultimately, "The Alchemist" teaches that pursuing one's Personal Legend leads to self-discovery and a deeper understanding of the world. The journey itself becomes as important as the destination, as it transforms the individual and connects them to the "Soul of the World."
                """
            },
            "Man's Search for Meaning": {
                "author": "Viktor E. Frankl",
                "content": """
Viktor Frankl's "Man's Search for Meaning" is divided into two parts. The first describes his experiences in Nazi concentration camps during World War II, and the second outlines his psychotherapeutic method called logotherapy.

Frankl writes about his observations of himself and others in extreme suffering and how they found meaning despite their circumstances. He observes: "Those who have a 'why' to live can bear almost any 'how'." This quote, originally from Nietzsche, became fundamental to his understanding of human motivation.

In the concentration camps, Frankl noticed that prisoners who could find meaning in their suffering were more likely to survive. He writes: "Everything can be taken from a man but one thing: the last of the human freedoms—to choose one's attitude in any given set of circumstances, to choose one's own way."

Frankl identifies three primary sources of meaning: work (doing something significant), love (caring for another person), and courage during difficult times. He states: "What is to give light must endure burning." This suggests that suffering can be meaningful if it leads to personal growth.

Logotherapy, the therapeutic approach Frankl developed, focuses on helping people find meaning in their lives. Unlike traditional psychoanalysis, which asks "why" something occurred, logotherapy asks "for what purpose" and looks toward the future.

Frankl writes: "Between stimulus and response there is a space. In that space is our power to choose our response. In our response lies our growth and our freedom." This emphasizes personal responsibility in finding meaning regardless of circumstances.

He also discusses the "existential vacuum" - a feeling of emptiness and meaninglessness that many people experience. He believes this vacuum is the root cause of many modern psychological problems, including depression, aggression, and addiction.

Frankl concludes that meaning can be found in every moment of living, even in suffering and death. He writes: "At any moment, man must decide, for better or for worse, what will be the monument of his existence."
                """
            },
            "Meditations": {
                "author": "Marcus Aurelius",
                "content": """
"Meditations" by Marcus Aurelius is a series of personal writings by the Roman Emperor Marcus Aurelius, in which he recorded private notes to himself and ideas on Stoic philosophy. These writings were never meant for publication but have since become one of the most significant works in Stoic philosophy.

Marcus Aurelius begins his meditations by expressing gratitude to those who influenced him. He acknowledges various family members, teachers, and friends who helped shape his character and philosophical outlook. This practice of gratitude is foundational to his Stoic approach to life.

A central theme in "Meditations" is the importance of focusing on what is within our control. Aurelius writes: "You have power over your mind - not outside events. Realize this, and you will find strength." This emphasizes the Stoic belief that we should not worry about external circumstances but rather focus on our responses to them.

Aurelius frequently contemplates the transience of life and the insignificance of human concerns in the grand cosmic scheme. He notes: "Time is a sort of river of passing events, and strong is its current; no sooner is a thing brought to sight than it is swept by and another takes its place, and this too will be swept away." This perspective helps maintain equanimity in the face of both success and failure.

The philosopher-emperor emphasizes the importance of living in the present moment: "Never let the future disturb you. You will meet it, if you have to, with the same weapons of reason which today arm you against the present." This mindfulness approach encourages focus on current actions rather than anxiety about the future.

Aurelius also reflects on human relationships and social responsibility. He writes: "We were born to work together like feet, hands, and eyes, like the two rows of teeth, upper and lower. To obstruct each other is unnatural." This highlights the Stoic view that humans are naturally social beings with obligations to contribute to the common good.

Throughout "Meditations," Aurelius reminds himself to maintain virtue regardless of how others act. He states: "The best revenge is to be unlike him who performed the injury." This reflects the Stoic commitment to ethical behavior independent of external consequences or others' actions.

Aurelius consistently returns to the importance of accepting what cannot be changed: "Accept the things to which fate binds you, and love the people with whom fate brings you together, but do so with all your heart." This radical acceptance forms the foundation of Stoic tranquility.
                """
            }
        }
        
        # Process books into chunks
        self.chunks = []
        self._process_books()
    
    def _process_books(self, chunk_size: int = 300):
        """
        Process books into chunks of text with metadata
        
        Args:
            chunk_size: Approximate word count for each chunk
        """
        chunk_id = 0
        
        for title, book_data in self.books.items():
            author = book_data["author"]
            content = book_data["content"]
            
            # Clean text
            content = re.sub(r'\s+', ' ', content).strip()
            
            # Split into words
            words = content.split()
            
            # Create chunks of approximately chunk_size words
            for i in range(0, len(words), chunk_size):
                chunk_words = words[i:i+chunk_size]
                if chunk_words:
                    chunk_text = ' '.join(chunk_words)
                    self.chunks.append({
                        "id": chunk_id,
                        "title": title,
                        "author": author,
                        "text": chunk_text
                    })
                    chunk_id += 1
    
    def add_book(self, title: str, author: str, content: str) -> str:
        """
        Add a new book to the database
        
        Args:
            title: Book title
            author: Book author
            content: Book text content
            
        Returns:
            Book ID
        """
        # Generate a book ID
        book_id = str(uuid.uuid4())
        
        # Check if book already exists
        if title in self.books:
            title = f"{title} ({uuid.uuid4().hex[:8]})"
        
        # Add book to database
        self.books[title] = {
            "id": book_id,
            "author": author,
            "content": content
        }
        
        # Process new book into chunks
        chunk_size = 300  # Same as in _process_books
        
        # Clean text
        content = re.sub(r'\s+', ' ', content).strip()
        
        # Split into words
        words = content.split()
        
        # Get next chunk ID
        chunk_id = len(self.chunks)
        
        # Create chunks with overlap
        overlap = 50  # Words overlap between chunks
        for i in range(0, len(words), chunk_size - overlap):
            chunk_words = words[i:i+chunk_size]
            if chunk_words:
                chunk_text = ' '.join(chunk_words)
                self.chunks.append({
                    "id": chunk_id,
                    "book_id": book_id,
                    "title": title,
                    "author": author,
                    "text": chunk_text
                })
                chunk_id += 1
        
        return book_id
    
    def get_all_chunks(self) -> List[Dict]:
        """Return all text chunks with metadata"""
        return self.chunks
    
    def get_chunk(self, chunk_id: int) -> Optional[Dict]:
        """Get a specific chunk by ID"""
        for chunk in self.chunks:
            if chunk["id"] == chunk_id:
                return chunk
        return None
    
    def get_chunks_by_book(self, book_title: str) -> List[Dict]:
        """Get all chunks for a specific book title"""
        return [chunk for chunk in self.chunks if chunk["title"] == book_title]
    
    def get_chunks_by_book_id(self, book_id: str) -> List[Dict]:
        """Get all chunks for a specific book ID"""
        # Add debug print
        print(f"Looking for chunks with book_id: {book_id}")
        
        # Find chunks with this book_id
        chunks = [chunk for chunk in self.chunks if chunk.get("book_id") == book_id]
        
        # If no chunks found, try to fetch from Supabase
        if not chunks:
            print(f"No chunks found in memory for book_id: {book_id}")
            try:
                # This is where we would add Supabase integration if needed
                # For now, just log a message
                print("Would fetch chunks from database here if integrated")
            except Exception as e:
                print(f"Error fetching chunks from database: {e}")
        
        print(f"Found {len(chunks)} chunks for book_id: {book_id}")
        return chunks
    
    def get_books(self) -> List[Dict]:
        """Get list of all books with metadata"""
        return [{"title": title, "author": data["author"], "id": data.get("id", str(uuid.uuid4()))} 
                for title, data in self.books.items()]
