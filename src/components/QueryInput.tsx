
import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Sparkles } from 'lucide-react';
import { 
  CommandDialog, 
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';

interface QueryInputProps {
  onSubmit: (query: string) => void;
  isLoading?: boolean;
  suggestions?: string[];
  disabled?: boolean;
  placeholderText?: string;
  value?: string;
  onChange?: (value: string) => void;
}

const QueryInput: React.FC<QueryInputProps> = ({ 
  onSubmit, 
  isLoading = false,
  suggestions = [],
  disabled = false,
  placeholderText = "Ask a question...",
  value,
  onChange
}) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Use controlled input if value prop is provided
  const isControlled = value !== undefined && onChange !== undefined;
  const currentValue = isControlled ? value : query;

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentValue.trim() || isLoading || disabled) return;
    
    onSubmit(currentValue.trim());
    if (!isControlled) {
      setQuery('');
    } else if (onChange) {
      onChange('');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    if (isControlled && onChange) {
      onChange(newValue);
    } else {
      setQuery(newValue);
    }
  };

  const handleSuggestionSelect = (suggestion: string) => {
    if (disabled) return;
    
    setOpen(false);
    if (isControlled && onChange) {
      onChange(suggestion);
    }
    onSubmit(suggestion);
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <div className="relative flex-1">
        <Input
          ref={inputRef}
          value={currentValue}
          onChange={handleInputChange}
          placeholder={placeholderText}
          className="w-full pr-10"
          disabled={isLoading || disabled}
        />
        {suggestions.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-full px-3 py-2 text-muted-foreground"
            onClick={() => setOpen(true)}
            disabled={isLoading || disabled}
          >
            <Sparkles className="h-4 w-4" />
          </Button>
        )}
      </div>
      <Button 
        type="submit" 
        size="icon" 
        disabled={!currentValue.trim() || isLoading || disabled}
        className={isLoading ? 'opacity-70' : ''}
      >
        <Send className="h-4 w-4" />
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search suggestions..." />
        <CommandList>
          <CommandEmpty>No suggestions found.</CommandEmpty>
          <CommandGroup heading="Suggestions">
            {suggestions.map((suggestion, index) => (
              <CommandItem
                key={index}
                onSelect={() => handleSuggestionSelect(suggestion)}
              >
                {suggestion}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </form>
  );
};

export default QueryInput;
