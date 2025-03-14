
import React, { useState } from 'react';
import { Book, BookGenre } from '@/types';
import BookItem from './BookItem';
import BookModal from './BookModal';
import { mockBooks } from '@/utils/mockData';

interface BooksGridProps {
  onSelectBook: (bookTitle: string) => void;
}

const BooksGrid: React.FC<BooksGridProps> = ({ onSelectBook }) => {
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [modalOpen, setModalOpen] = useState<boolean>(false);

  // Group books by genre
  const booksByGenre = mockBooks.reduce((acc, book) => {
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

  const handleChatWithBook = () => {
    if (selectedBook) {
      onSelectBook(selectedBook.title);
      setModalOpen(false);
    }
  };

  return (
    <div className="space-y-10">
      {Object.entries(booksByGenre).map(([genre, books]) => (
        <div key={genre} className="space-y-4">
          <h2 className="text-xl font-display font-medium text-foreground/90 ml-2">{genre}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {books.map((book) => (
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
          onChatWithBook={handleChatWithBook}
        />
      )}
    </div>
  );
};

export default BooksGrid;
