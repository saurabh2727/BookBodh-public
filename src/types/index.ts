export type MessageType = 'user' | 'bot';

export interface Citation {
  book: string;
  author: string;
  page: number;
}

export interface ChatMessage {
  id: string;
  content: string;
  type: MessageType;
  timestamp: Date;
  citations?: Citation[];
  isLoading?: boolean;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  genre: string;
  summary: string;
  coverColor: string;
  imageUrl?: string; // Added for real book covers
}

export type BookGenre = 'Philosophy' | 'Ethics' | 'Self-Help' | 'Spirituality' | 'Psychology';

// Chat mode types - unified definition
export type ChatMode = 'general' | 'specific-book' | 'saved' | 'temp';

// API Request/Response Types for Backend Integration
export interface ChatRequest {
  query: string;
  book?: string | null;
}

export interface ChatResponse {
  response: string;
  book?: string | null;
  author?: string | null;
}
