
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, AlertCircle, Check, Search } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { supabase, ensureAuthIsValid, forceSessionRefresh } from '@/lib/supabase';

interface BookUploadProps {
  onClose: () => void;
  onUploadComplete: (success: boolean, message: string, bookId?: string) => void;
}

const BookUpload: React.FC<BookUploadProps> = ({ onUploadComplete }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState<string>('Non-Fiction');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailedError, setDetailedError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [bookId, setBookId] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedBook, setSelectedBook] = useState<any | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log('BookUpload: Checking authentication status...');
        const { data } = await supabase.auth.getSession();
        
        const isValid = !!data.session;
        console.log('BookUpload: Authentication status:', isValid ? 'Authenticated' : 'Not authenticated');
        setIsAuthenticated(isValid);
        
        if (!isValid) {
          setError('Authentication required. Please log in again.');
          console.error('BookUpload: No valid session found');
        }
      } catch (error) {
        console.error('BookUpload: Error checking authentication:', error);
        setError('Error checking authentication status.');
      }
    };
    
    checkAuth();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!searchQuery.trim()) {
      setError('Please enter a search query');
      return;
    }
    
    try {
      setIsSearching(true);
      setError(null);
      setDetailedError(null);
      setUploadSuccess(false);
      setBookId(null);
      setSearchResults([]);
      setSelectedBook(null);
      
      console.log('Searching for books with query:', searchQuery);
      
      if (!isAuthenticated) {
        console.log('BookUpload: Attempting to refresh auth before search...');
        const isValid = await ensureAuthIsValid();
        
        if (!isValid) {
          throw new Error('Authentication required. Please log in again.');
        }
        setIsAuthenticated(true);
      }
      
      const { data, error } = await supabase.functions.invoke('search-books', {
        method: 'POST',
        body: { query: searchQuery },
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Error searching for books');
      }

      console.log('Search results:', data);
      
      if (data && Array.isArray(data.items) && data.items.length > 0) {
        setSearchResults(data.items);
      } else {
        setError('No books found. Try a different search term.');
      }
    } catch (error) {
      console.error('Book search error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError('Search failed. Please try again.');
      setDetailedError(errorMessage);
      
      toast({
        title: "Search error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectBook = (book: any) => {
    setSelectedBook(book);
    
    const title = book.volumeInfo.title;
    const authors = book.volumeInfo.authors || ['Unknown Author'];
    
    toast({
      title: "Book selected",
      description: `${title} by ${authors.join(', ')}`,
    });
  };

  const handleAddBook = async () => {
    if (!selectedBook) {
      setError('Please select a book first');
      return;
    }
    
    try {
      setIsSearching(true);
      setError(null);
      setDetailedError(null);
      
      console.log('Adding book to library:', selectedBook.volumeInfo.title);
      
      console.log('BookUpload: Forcing session refresh before adding book...');
      const refreshSuccess = await forceSessionRefresh();
      
      if (!refreshSuccess) {
        console.error('BookUpload: Failed to refresh authentication session');
        throw new Error('Session refresh failed. Please login again.');
      }
      
      console.log('BookUpload: Validating auth session before adding book...');
      const isValid = await ensureAuthIsValid();
      if (!isValid) {
        console.error('BookUpload: Authentication validation failed');
        throw new Error('Authentication required. Please log in again.');
      }
      
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        console.error('BookUpload: No active session found after refresh');
        throw new Error('Authentication session missing. Please log in again.');
      }
      
      console.log('BookUpload: Auth validated, token present with length:', 
        sessionData.session.access_token.length);
      
      const { data, error } = await supabase.functions.invoke('add-book', {
        method: 'POST',
        body: { 
          bookId: selectedBook.id,
          title: selectedBook.volumeInfo.title,
          authors: selectedBook.volumeInfo.authors || ['Unknown Author'],
          category: category,
          previewLink: selectedBook.volumeInfo.previewLink
        },
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Error adding book');
      }

      console.log('Book added:', data);
      
      if (data.success) {
        setUploadSuccess(true);
        setBookId(data.bookId || null);
        
        toast({
          title: "Book added successfully",
          description: `"${selectedBook.volumeInfo.title}" has been added to your library and extraction has been triggered.`,
          variant: "default",
        });
        
        onUploadComplete(true, `Book "${selectedBook.volumeInfo.title}" added successfully${data.extractionTriggered ? ' and extraction started' : ''}`, data.bookId);
      } else {
        throw new Error(data.message || 'Failed to add book');
      }
    } catch (error) {
      console.error('Book add error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError('Failed to add book. Please try again.');
      setDetailedError(errorMessage);
      
      toast({
        title: "Add book error",
        description: errorMessage || "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
      
      onUploadComplete(false, errorMessage);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="space-y-4">
        <div>
          <Label htmlFor="search">Search for a Book</Label>
          <div className="flex gap-2 mt-1">
            <Input 
              id="search" 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Enter book title or author"
              className="flex-1"
              disabled={isSearching || uploadSuccess}
            />
            <Button 
              type="submit" 
              disabled={isSearching || uploadSuccess}
              size="icon"
            >
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Search for books by title, author, or ISBN</p>
        </div>
        
        <div>
          <Label htmlFor="category">Category</Label>
          <Select 
            defaultValue="Non-Fiction" 
            value={category} 
            onValueChange={setCategory}
            disabled={isSearching || uploadSuccess}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Fiction">Fiction</SelectItem>
              <SelectItem value="Non-Fiction">Non-Fiction</SelectItem>
              <SelectItem value="Philosophy">Philosophy</SelectItem>
              <SelectItem value="Science">Science</SelectItem>
              <SelectItem value="History">History</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </form>
      
      {searchResults.length > 0 && !selectedBook && (
        <div className="mt-4">
          <h3 className="text-sm font-medium mb-2">Search Results</h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {searchResults.map((book) => (
              <div 
                key={book.id} 
                className="p-2 border rounded hover:bg-accent cursor-pointer flex items-center gap-3"
                onClick={() => handleSelectBook(book)}
              >
                {book.volumeInfo.imageLinks?.thumbnail && (
                  <img 
                    src={book.volumeInfo.imageLinks.thumbnail} 
                    alt={book.volumeInfo.title}
                    className="h-12 w-8 object-cover"
                  />
                )}
                <div>
                  <p className="font-medium">{book.volumeInfo.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {book.volumeInfo.authors ? book.volumeInfo.authors.join(', ') : 'Unknown Author'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {selectedBook && !uploadSuccess && (
        <div className="mt-4 p-3 border rounded bg-accent/20">
          <h3 className="font-medium mb-2">Selected Book</h3>
          <div className="flex gap-3">
            {selectedBook.volumeInfo.imageLinks?.thumbnail && (
              <img 
                src={selectedBook.volumeInfo.imageLinks.thumbnail} 
                alt={selectedBook.volumeInfo.title}
                className="h-20 w-14 object-cover"
              />
            )}
            <div>
              <p className="font-medium">{selectedBook.volumeInfo.title}</p>
              <p className="text-sm text-muted-foreground">
                {selectedBook.volumeInfo.authors ? selectedBook.volumeInfo.authors.join(', ') : 'Unknown Author'}
              </p>
              {selectedBook.volumeInfo.publishedDate && (
                <p className="text-xs text-muted-foreground">
                  Published: {selectedBook.volumeInfo.publishedDate}
                </p>
              )}
            </div>
          </div>
          <Button 
            onClick={handleAddBook} 
            className="w-full mt-3"
            disabled={isSearching}
          >
            {isSearching ? 
              <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Adding...</> : 
              'Add to My Library'}
          </Button>
        </div>
      )}
      
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error}
            {detailedError && (
              <details className="mt-2 text-xs">
                <summary>Technical details</summary>
                <pre className="mt-2 w-full overflow-auto text-xs whitespace-pre-wrap">
                  {detailedError}
                </pre>
              </details>
            )}
          </AlertDescription>
        </Alert>
      )}
      
      {uploadSuccess && (
        <Alert variant="default" className="bg-green-50 border-green-200">
          <Check className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">Success</AlertTitle>
          <AlertDescription className="text-green-700">
            Book "{selectedBook.volumeInfo.title}" added successfully!
            {bookId && (
              <div className="mt-1 text-xs">
                Book ID: <span className="font-mono">{bookId}</span>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default BookUpload;
