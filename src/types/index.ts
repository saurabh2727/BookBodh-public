
export type MessageType = 'user' | 'bot';

export interface Citation {
  book: string;
  author: string;
  page: number;
}

export interface ChatMessage {
  id: string;
  content: string;
  type: 'user' | 'bot';
  timestamp: Date;
  isLoading?: boolean;
  citations?: Citation[];
  isSystemMessage?: boolean;
  isBookWelcome?: boolean;
  isExtractionStatus?: boolean;
  isExtractionComplete?: boolean;
  isExtractionError?: boolean;
  embedUrl?: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  genre: string;
  summary: string;
  coverColor: string;
  imageUrl?: string;
  fileUrl?: string;
  embedUrl?: string;
  chunksCount?: number;
}

export type BookGenre = 'Fiction' | 'Non-Fiction' | 'Philosophy' | 'Science' | 'History';

export type ChatMode = 'general' | 'specific-book' | 'saved' | 'temp';

export interface ChatRequest {
  query: string;
  book?: string | null;
  bookId?: string | null;
  chunks?: Array<{
    title: string;
    author: string;
    text: string;
    summary?: string;
    is_preview_info?: boolean;
  }>;
}

export interface ChatResponse {
  response: string;
  book?: string | null;
  author?: string | null;
  extractionTriggered?: boolean;
  status?: string;
  bookId?: string;
  chunksCount?: number;
  embedUrl?: string;
}

export interface BookChunk {
  id: string;
  book_id: string;
  chunk_index: number;
  title: string;
  text: string;
  summary?: string;
  created_at: string;
  is_preview_info?: boolean;
}

export interface ExtractionStatus {
  status: string;
  message: string;
  book_id: string;
  screenshots_count: number;
  text_length: number;
  error?: string;
}
