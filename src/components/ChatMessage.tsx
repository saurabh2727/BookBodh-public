
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
  
  // Extract embed URL with improved detection
  const extractEmbedUrl = () => {
    // First check if message has a direct embedUrl property
    if (hasEmbedUrl) {
      return message.embedUrl;
    }
    
    // Look for book preview URL in the content
    const content = message.content || '';
    
    // Match various formats of Google Books links
    const patterns = [
      /preview this book at: (https:\/\/[^\s]+)/i,
      /embed link: (https:\/\/[^\s]+)/i,
      /book preview: (https:\/\/[^\s]+)/i,
      /preview available at: (https:\/\/[^\s]+)/i,
      /google books: (https:\/\/[^\s]+)/i,
      /books\.google\.com\/books\?id=([a-zA-Z0-9_-]+)/i
    ];
    
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        if (pattern.toString().includes('id=')) {
          // This is the ID pattern
          const bookId = match[1];
          return `https://books.google.com/books?id=${bookId}&lpg=PP1&pg=PP1&output=embed`;
        } else {
          // This is a URL pattern
          const url = match[1].trim();
          
          // Check if this is already an embed URL
          if (url.includes('output=embed')) {
            return url;
          }
          
          // Convert standard Google Books URL to embed URL
          if (url.includes('books.google.com') || url.includes('google.com/books')) {
            const bookIdMatch = url.match(/id=([a-zA-Z0-9_-]+)/);
            if (bookIdMatch && bookIdMatch[1]) {
              return `https://books.google.com/books?id=${bookIdMatch[1]}&lpg=PP1&pg=PP1&output=embed`;
            }
          }
          
          return url;
        }
      }
    }
    
    return null;
  };
  
  // Clean the message content to remove embed links that will be displayed as iframes
  const getCleanContent = () => {
    if (!message.content) return '';
    
    let content = message.content;
    
    // Only remove URL references if we're displaying the embed
    if (extractEmbedUrl()) {
      content = content
        .replace(/\n*You can preview this book at: https:\/\/[^\n]+\n*/g, '')
        .replace(/\n*Embed link: https:\/\/[^\n]+\n*/g, '')
        .replace(/\n*A preview of this book is available at: https:\/\/[^\n]+\n*/g, '')
        .replace(/\n*Google Books: https:\/\/[^\n]+\n*/g, '')
        .replace(/\n*Book preview: https:\/\/[^\n]+\n*/g, '');
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
              
              {hasBookCitation && message.citations && message.citations[0] && (
                <div className="mt-3">
                  <BookCitation 
                    title={message.citations[0].book} 
                    author={message.citations[0].author || 'Unknown'} 
                    pageNumber={message.citations[0].page || 1} 
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
