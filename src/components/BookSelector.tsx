
import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Book } from '@/types';
import { BookOpen, Search } from 'lucide-react';
import { fetchUserBooks } from '@/services/api';
import { Skeleton } from '@/components/ui/skeleton';

interface BookSelectorProps {
  onClose: () => void;
  onSelectBook: (book: Book) => void;
}

const BookSelector: React.FC<BookSelectorProps> = ({ onClose, onSelectBook }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch books on component mount
  useEffect(() => {
    const loadBooks = async () => {
      try {
        setLoading(true);
        const userBooks = await fetchUserBooks();
        setBooks(userBooks);
      } catch (err) {
        console.error('Error loading books:', err);
        setError('Failed to load books. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    loadBooks();
  }, []);
  
  const filteredBooks = books.filter(book => 
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
          {loading ? (
            <div className="space-y-6 pt-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="h-4 w-24" />
                  <div className="space-y-2">
                    {[...Array(3)].map((_, j) => (
                      <div key={j} className="flex items-center gap-3 p-2">
                        <Skeleton className="h-16 w-12 rounded" />
                        <div className="space-y-2 flex-1">
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-3 w-2/3" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="p-4 text-center">
              <p className="text-destructive">{error}</p>
            </div>
          ) : books.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-muted-foreground">You haven't uploaded any books yet.</p>
            </div>
          ) : Object.keys(booksByGenre).length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-muted-foreground">No books match your search.</p>
            </div>
          ) : (
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
                          className={`h-16 w-12 rounded overflow-hidden ${!book.imageUrl ? book.coverColor : ''} flex items-center justify-center flex-shrink-0`}
                        >
                          {book.imageUrl ? (
                            <img 
                              src={book.imageUrl} 
                              alt={book.title} 
                              className="object-cover w-full h-full"
                            />
                          ) : (
                            <BookOpen className="h-5 w-5 text-white/90" />
                          )}
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
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default BookSelector;
