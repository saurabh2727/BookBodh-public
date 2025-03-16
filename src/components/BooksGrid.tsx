
import React, { useState, useEffect } from 'react';
import { Book, BookGenre } from '@/types';
import BookItem from './BookItem';
import BookModal from './BookModal';
import { fetchUserBooks } from '@/services/api';
import { Skeleton } from '@/components/ui/skeleton';

interface BooksGridProps {
  onSelectBook: (bookId: string) => void;
}

const BooksGrid: React.FC<BooksGridProps> = ({ onSelectBook }) => {
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadBooks = async () => {
      try {
        setLoading(true);
        const userBooks = await fetchUserBooks();
        setBooks(userBooks);
        setError(null);
      } catch (err) {
        console.error('Error loading books:', err);
        setError('Failed to load books. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    loadBooks();
  }, []);

  // Group books by genre
  const booksByGenre = books.reduce((acc, book) => {
    if (!acc[book.genre]) {
      acc[book.genre] = [];
    }
    acc[book.genre].push(book);
    return acc;
  }, {} as Record<string, Book[]>);

  const handleBookClick = (book: Book) => {
    setSelectedBook(book);
    setModalOpen(true);
  };

  if (loading) {
    return (
      <div className="space-y-10">
        <div className="space-y-4">
          <Skeleton className="h-8 w-40" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex flex-col items-center space-y-2">
                <Skeleton className="h-36 w-24 rounded-md" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (books.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">You haven't uploaded any books yet.</p>
        <p className="text-sm mt-2">Upload a book to start chatting with it!</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {Object.entries(booksByGenre).map(([genre, genreBooks]) => (
        <div key={genre} className="space-y-4">
          <h2 className="text-xl font-display font-medium text-foreground/90 ml-2">{genre}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {genreBooks.map((book) => (
              <BookItem 
                key={book.id} 
                book={book} 
                onClick={() => handleBookClick(book)} 
              />
            ))}
          </div>
        </div>
      ))}

      {selectedBook && (
        <BookModal 
          book={selectedBook} 
          isOpen={modalOpen} 
          onClose={() => setModalOpen(false)} 
        />
      )}
    </div>
  );
};

export default BooksGrid;
