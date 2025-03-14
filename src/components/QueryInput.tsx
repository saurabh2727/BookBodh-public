
import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SendHorizontal } from 'lucide-react';
import { sampleUserQueries } from '@/utils/mockData';

interface QueryInputProps {
  onSubmit: (query: string) => void;
  isLoading: boolean;
}

const QueryInput: React.FC<QueryInputProps> = ({ onSubmit, isLoading }) => {
  const [query, setQuery] = useState<string>('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Populate with some sample queries on initial load
    if (!suggestions.length) {
      setSuggestions(sampleUserQueries);
    }
  }, [suggestions.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (query.trim() && !isLoading) {
      onSubmit(query);
      setQuery('');
      
      // Focus the input after submission
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    onSubmit(suggestion);
    setQuery('');
    setSuggestions([]);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {!isLoading && suggestions.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2 animate-fade-in">
          {suggestions.map((suggestion, index) => (
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
        <Input
          ref={inputRef}
          type="text"
          placeholder="Ask about an ethical dilemma..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pr-12 py-6 bg-background border-border/80 focus-visible:ring-primary/30 shadow-sm"
          disabled={isLoading}
        />
        <Button
          type="submit"
          size="icon"
          className={`absolute right-2 top-1/2 transform -translate-y-1/2 rounded-full w-8 h-8 ${
            !query.trim() || isLoading ? 'opacity-50 cursor-not-allowed' : 'opacity-100'
          }`}
          disabled={!query.trim() || isLoading}
        >
          <SendHorizontal className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
};

export default QueryInput;
