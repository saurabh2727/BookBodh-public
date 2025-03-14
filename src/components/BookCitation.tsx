
import React from 'react';
import { Citation } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Book } from 'lucide-react';

interface BookCitationProps {
  citation: Citation;
}

const BookCitation: React.FC<BookCitationProps> = ({ citation }) => {
  return (
    <Card className="message-card bg-accent/80 border-accent overflow-hidden animate-fade-in">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent-foreground/10 flex items-center justify-center">
          <Book className="h-4 w-4 text-accent-foreground" />
        </div>
        <div className="space-y-0.5 flex-1">
          <p className="font-medium text-sm text-foreground/90">
            {citation.book}
          </p>
          <p className="text-xs text-muted-foreground">
            {citation.author} • Page {citation.page}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default BookCitation;
