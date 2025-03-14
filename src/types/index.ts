
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
