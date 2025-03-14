
import React from 'react';
import { Book } from '@/types';
import { BookIcon } from 'lucide-react';

interface BookItemProps {
  book: Book;
  onClick: () => void;
}

const BookItem: React.FC<BookItemProps> = ({ book, onClick }) => {
  return (
    <div 
      className="flex flex-col items-center space-y-2 cursor-pointer transition-all duration-300 hover:scale-105 group"
      onClick={onClick}
    >
      <div 
        className={`h-32 w-24 rounded-md shadow-md flex items-center justify-center ${book.coverColor} group-hover:shadow-lg transition-all duration-300`}
      >
        <BookIcon className="h-10 w-10 text-white/80" />
      </div>
      <p className="text-center text-sm font-medium line-clamp-2 text-foreground/90 max-w-full px-2">
        {book.title}
      </p>
      <p className="text-center text-xs text-muted-foreground line-clamp-1">
        {book.author}
      </p>
    </div>
  );
};

export default BookItem;
