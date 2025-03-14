
import React, { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Book } from '@/types';
import { mockBooks } from '@/utils/mockData';
import { Search } from 'lucide-react';

interface BookSelectorProps {
  onClose: () => void;
  onSelectBook: (book: Book) => void;
}

const BookSelector: React.FC<BookSelectorProps> = ({ onClose, onSelectBook }) => {
  const [searchQuery, setSearchQuery] = useState('');
  
  const filteredBooks = mockBooks.filter(book => 
    book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    book.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
    book.genre.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group books by genre
  const booksByGenre = filteredBooks.reduce((acc, book) => {
    if (!acc[book.genre]) {
      acc[book.genre] = [];
    }
    acc[book.genre].push(book);
    return acc;
  }, {} as Record<string, Book[]>);

  return (
    <Sheet open={true} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Select a Book</SheetTitle>
        </SheetHeader>
        
        <div className="relative my-4">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by title, author or genre..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <ScrollArea className="h-[calc(100vh-12rem)] pr-4">
          <div className="space-y-6 pt-2">
            {Object.entries(booksByGenre).map(([genre, books]) => (
              <div key={genre} className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">{genre}</h3>
                <div className="space-y-2">
                  {books.map((book) => (
                    <div
                      key={book.id}
                      className="flex items-center gap-3 p-2 rounded-md hover:bg-accent/50 cursor-pointer transition-colors"
                      onClick={() => onSelectBook(book)}
                    >
                      <div 
                        className={`h-12 w-10 rounded ${book.coverColor} flex items-center justify-center flex-shrink-0`}
                      >
                        <span className="text-white/90 text-xs font-medium">
                          {book.title.substring(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-sm font-medium text-foreground truncate">{book.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{book.author}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default BookSelector;
