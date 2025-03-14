
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Book } from '@/types';
import { BookOpen, MessageCircle } from 'lucide-react';

interface BookModalProps {
  book: Book;
  isOpen: boolean;
  onClose: () => void;
  onChatWithBook: () => void;
}

const BookModal: React.FC<BookModalProps> = ({ book, isOpen, onClose, onChatWithBook }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-4">
            <div 
              className={`h-36 w-24 rounded-md shadow-md flex-shrink-0 flex items-center justify-center overflow-hidden ${!book.imageUrl ? book.coverColor : ''}`}
            >
              {book.imageUrl ? (
                <img 
                  src={book.imageUrl} 
                  alt={book.title} 
                  className="object-cover w-full h-full"
                />
              ) : (
                <BookOpen className="h-8 w-8 text-white/80" />
              )}
            </div>
            <div>
              <DialogTitle className="text-xl">{book.title}</DialogTitle>
              <DialogDescription className="text-sm mt-1">
                {book.author} · {book.genre}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <div className="py-4">
          <p className="text-sm text-foreground/90 leading-relaxed">
            {book.summary}
          </p>
        </div>
        
        <DialogFooter>
          <Button 
            onClick={onChatWithBook}
            className="w-full gap-2"
          >
            <MessageCircle className="h-4 w-4" />
            Chat with this Book
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BookModal;
