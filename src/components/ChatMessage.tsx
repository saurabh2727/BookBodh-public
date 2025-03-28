
import React from 'react';
import { ChatMessage as ChatMessageType } from '@/types';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import BookCitation from './BookCitation';
import { User, Bot, BookOpen } from 'lucide-react';

interface ChatMessageProps {
  message: ChatMessageType;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.type === 'user';
  
  // For loading animation
  if (message.isLoading) {
    return (
      <div className="flex items-start gap-3 max-w-2xl mx-auto animate-fade-in mb-6">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Bot className="h-4 w-4 text-primary" />
        </div>
        <Card className="message-card bg-card/80 border border-border/50 shadow-subtle w-full">
          <CardContent className="p-4">
            <div className="flex gap-2">
              <div className="h-2 w-2 rounded-full bg-primary/60 animate-chat-pulse"></div>
              <div className="h-2 w-2 rounded-full bg-primary/60 animate-chat-pulse delay-150"></div>
              <div className="h-2 w-2 rounded-full bg-primary/60 animate-chat-pulse delay-300"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Function to create a safe HTML representation 
  const createMarkup = (content: string) => {
    if (!content) return { __html: "" };
    
    // Check if content has an embedded book link
    const bookPreviewRegex = /https:\/\/www\.google\.com\/books\/edition\/_\/[a-zA-Z0-9_-]+\?hl=en&gbpv=1/g;
    const bookEmbedRegex = /https:\/\/books\.google\.[a-z.]+\/books\?id=[a-zA-Z0-9_-]+&lpg=.+&pg=.+&output=embed/g;
    
    // Check if content contains a Google Books URL but is not entirely a URL
    const hasBookPreview = bookPreviewRegex.test(content) || bookEmbedRegex.test(content);
    
    // Extract clean text content
    let cleanText = content;
    
    // Check for HTML tags and remove them if present
    const hasHtmlTags = /<[a-z][\s\S]*>/i.test(cleanText);
    if (hasHtmlTags) {
      cleanText = cleanText.replace(/<\/?[^>]+(>|$)/g, "");
    }
    
    // Preserve line breaks
    cleanText = cleanText.replace(/\n/g, '<br />');
    
    return { __html: cleanText };
  };

  // Check if message contains a book preview URL
  const containsBookPreview = () => {
    if (!message.content) return false;
    
    const bookPreviewRegex = /https:\/\/www\.google\.com\/books\/edition\/_\/[a-zA-Z0-9_-]+\?hl=en&gbpv=1/g;
    const bookEmbedRegex = /https:\/\/books\.google\.[a-z.]+\/books\?id=[a-zA-Z0-9_-]+&lpg=.+&pg=.+&output=embed/g;
    
    return bookPreviewRegex.test(message.content) || bookEmbedRegex.test(message.content);
  };

  // Extract book preview URL if present
  const getBookPreviewUrl = () => {
    if (!message.content) return null;
    
    // Look for Google Books preview URL patterns
    const bookPreviewRegex = /https:\/\/www\.google\.com\/books\/edition\/_\/([a-zA-Z0-9_-]+)\?hl=en&gbpv=1/;
    const bookEmbedRegex = /https:\/\/books\.google\.[a-z.]+\/books\?id=([a-zA-Z0-9_-]+)&lpg=.+&pg=.+&output=embed/;
    
    // Check for preview URL
    const previewMatch = message.content.match(bookPreviewRegex);
    if (previewMatch) {
      const bookId = previewMatch[1];
      // Create a better embed URL for the iframe
      return `https://books.google.com/books?id=${bookId}&lpg=PP1&pg=PP1&output=embed`;
    }
    
    // Check for embed URL
    const embedMatch = message.content.match(bookEmbedRegex);
    if (embedMatch) {
      return message.content.match(bookEmbedRegex)?.[0] || null;
    }
    
    return null;
  };

  const bookPreviewUrl = getBookPreviewUrl();
  const hasBookPreview = containsBookPreview();

  return (
    <div 
      className={cn(
        "flex items-start gap-3 max-w-2xl mx-auto mb-6",
        isUser ? "animate-slide-in-right justify-end" : "animate-slide-in-left"
      )}
    >
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Bot className="h-4 w-4 text-primary" />
        </div>
      )}
      
      <div className="space-y-3 flex-1">
        <Card className={cn(
          "message-card border border-border/50 shadow-subtle",
          isUser 
            ? "bg-primary text-primary-foreground" 
            : "bg-card/80"
        )}>
          <CardContent className="p-4">
            <div 
              className="text-sm prose dark:prose-invert max-w-none" 
              dangerouslySetInnerHTML={createMarkup(message.content)}
            />
            
            {/* Render Google Books Preview if available */}
            {!isUser && hasBookPreview && bookPreviewUrl && (
              <div className="mt-4 border border-border rounded-md overflow-hidden">
                <div className="bg-muted px-3 py-1 text-xs flex items-center gap-1">
                  <BookOpen className="h-3 w-3" />
                  <span>Book Preview</span>
                </div>
                <iframe 
                  src={bookPreviewUrl}
                  className="w-full aspect-[4/3] border-0"
                  allow="encrypted-media"
                  allowFullScreen
                ></iframe>
              </div>
            )}
          </CardContent>
        </Card>
        
        {message.citations && message.citations.length > 0 && (
          <div className="space-y-2">
            {message.citations.map((citation, index) => (
              <BookCitation key={index} citation={citation} />
            ))}
          </div>
        )}
      </div>
      
      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
    </div>
  );
};

export default ChatMessage;
