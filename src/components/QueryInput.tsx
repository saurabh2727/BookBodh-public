
import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SendHorizontal } from 'lucide-react';
import { sampleUserQueries } from '@/utils/mockData';
import { Textarea } from '@/components/ui/textarea';

interface QueryInputProps {
  onSubmit: (query: string) => void;
  isLoading: boolean;
  suggestions?: string[];
}

const QueryInput: React.FC<QueryInputProps> = ({ 
  onSubmit, 
  isLoading, 
  suggestions = [] 
}) => {
  const [query, setQuery] = useState<string>('');
  const [activeSuggestions, setActiveSuggestions] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Use provided suggestions or fall back to sample queries
    if (suggestions.length > 0) {
      setActiveSuggestions(suggestions);
    } else if (!activeSuggestions.length) {
      setActiveSuggestions(sampleUserQueries);
    }
  }, [suggestions, activeSuggestions.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (query.trim() && !isLoading) {
      onSubmit(query);
      setQuery('');
      
      // Focus the input after submission
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    onSubmit(suggestion);
    setQuery('');
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {!isLoading && activeSuggestions.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2 animate-fade-in">
          {activeSuggestions.map((suggestion, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              className="text-xs bg-secondary/80 text-secondary-foreground hover:bg-secondary/90 transition-all border-0 shadow-sm"
              onClick={() => handleSuggestionClick(suggestion)}
            >
              {suggestion}
            </Button>
          ))}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="relative animate-fade-in">
        <div className="paper-texture rounded-lg overflow-hidden border border-border/80 shadow-md">
          <Textarea
            ref={textareaRef}
            placeholder="Ask about an ethical dilemma..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-h-[80px] resize-none py-4 px-5 bg-paper focus-visible:ring-primary/30 text-base md:text-sm"
            disabled={isLoading}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
        </div>
        <Button
          type="submit"
          size="icon"
          className={`absolute right-3 bottom-3 rounded-full w-10 h-10 ${
            !query.trim() || isLoading ? 'opacity-50 cursor-not-allowed' : 'opacity-100'
          }`}
          disabled={!query.trim() || isLoading}
        >
          <SendHorizontal className="h-5 w-5" />
        </Button>
      </form>
    </div>
  );
};

export default QueryInput;
