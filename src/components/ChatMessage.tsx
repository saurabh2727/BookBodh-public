
import React from 'react';
import { ChatMessage as ChatMessageType, Citation } from '@/types';
import { formatRelativeTime } from '@/lib/utils';
import BookCitation from './BookCitation';

interface ChatMessageProps {
  message: ChatMessageType;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.type === 'user';
  const hasBookCitation = message.citations && message.citations.length > 0;
  const hasEmbedUrl = message.embedUrl && message.embedUrl.length > 0;
  
  // Check for Google Books embedded viewer in the content
  const extractEmbedUrl = () => {
    if (hasEmbedUrl) {
      return message.embedUrl;
    }
    
    // Look for book preview URL in the content
    const content = message.content || '';
    const previewRegex = /preview this book at: (https:\/\/[^\s]+)/i;
    const embedRegex = /embed link: (https:\/\/[^\s]+)/i;
    
    const previewMatch = content.match(previewRegex);
    if (previewMatch && previewMatch[1]) {
      const previewUrl = previewMatch[1].trim();
      
      // Convert preview URL to an embed URL if needed
      if (previewUrl.includes('books.google.com') || previewUrl.includes('google.com/books')) {
        const bookIdMatch = previewUrl.match(/\/([a-zA-Z0-9_-]+)(\?|$)/);
        if (bookIdMatch && bookIdMatch[1]) {
          return `https://books.google.com/books?id=${bookIdMatch[1]}&lpg=PP1&pg=PP1&output=embed`;
        }
        return previewUrl;
      }
    }
    
    const embedMatch = content.match(embedRegex);
    if (embedMatch && embedMatch[1]) {
      return embedMatch[1].trim();
    }
    
    return null;
  };
  
  // Clean the message content to remove embed links that will be displayed as iframes
  const getCleanContent = () => {
    if (!message.content) return '';
    
    let content = message.content;
    
    // Remove the preview URL line if we're displaying it as an iframe
    if (extractEmbedUrl()) {
      content = content
        .replace(/\n*You can preview this book at: https:\/\/[^\n]+\n*/g, '')
        .replace(/\n*Embed link: https:\/\/[^\n]+\n*/g, '')
        .replace(/\n*A preview of this book is available at: https:\/\/[^\n]+\n*/g, '');
    }
    
    return content;
  };
  
  const embedUrl = extractEmbedUrl();
  const cleanContent = getCleanContent();

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} mb-4`}>
      <div className="flex items-start gap-2 max-w-3xl">
        <div className={`flex-1 rounded-lg px-4 py-2 shadow ${
          isUser 
            ? 'bg-primary text-primary-foreground' 
            : 'bg-muted'
        }`}>
          {message.isLoading ? (
            <div className="flex items-center space-x-2">
              <div className="h-2 w-2 animate-bounce rounded-full bg-current"></div>
              <div className="h-2 w-2 animate-bounce rounded-full bg-current" style={{ animationDelay: '0.2s' }}></div>
              <div className="h-2 w-2 animate-bounce rounded-full bg-current" style={{ animationDelay: '0.4s' }}></div>
            </div>
          ) : (
            <div className="prose dark:prose-invert max-w-none">
              {cleanContent.split('\n').map((paragraph, i) => (
                <p key={i} className={paragraph.trim() === '' ? 'my-2' : ''}>
                  {paragraph}
                </p>
              ))}
              
              {/* Render Google Books embed iframe if available */}
              {embedUrl && (
                <div className="mt-4 mb-2">
                  <p className="text-sm mb-2">Book Preview:</p>
                  <iframe 
                    src={embedUrl}
                    width="100%" 
                    height="500px" 
                    frameBorder="0" 
                    allow="fullscreen" 
                    className="rounded-md border shadow-sm"
                    title="Book Preview"
                  ></iframe>
                </div>
              )}
              
              {hasBookCitation && (
                <div className="mt-3">
                  <BookCitation 
                    book={message.citations[0].book} 
                    author={message.citations[0].author} 
                    page={message.citations[0].page} 
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <span className="text-xs text-muted-foreground mt-1">
        {formatRelativeTime(message.timestamp)}
      </span>
    </div>
  );
};

export default ChatMessage;
