
import React from 'react';
import { ChatMessage as ChatMessageType } from '@/types';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import BookCitation from './BookCitation';
import { User, Bot } from 'lucide-react';

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
    
    // Check if content has HTML tags and remove them if present
    const hasHtmlTags = /<[a-z][\s\S]*>/i.test(content);
    
    if (hasHtmlTags) {
      // Get plain text by removing HTML tags
      const cleanText = content.replace(/<\/?[^>]+(>|$)/g, "");
      // Preserve line breaks
      return { __html: cleanText.replace(/\n/g, '<br />') };
    } else {
      // For plain text, just preserve line breaks
      return { __html: content.replace(/\n/g, '<br />') };
    }
  };

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
