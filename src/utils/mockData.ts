
import { ChatMessage, Citation } from '@/types';

export const initialMessages: ChatMessage[] = [
  {
    id: '1',
    content: "Welcome to Ethical Wisdom Bot. I can help you navigate ethical dilemmas with insights from great books. What moral question can I help you with today?",
    type: 'bot',
    timestamp: new Date(),
  }
];

export const sampleCitations: Citation[] = [
  {
    book: "Nicomachean Ethics",
    author: "Aristotle",
    page: 42
  },
  {
    book: "Beyond Good and Evil",
    author: "Friedrich Nietzsche",
    page: 108
  },
  {
    book: "Justice: What's the Right Thing to Do?",
    author: "Michael Sandel",
    page: 88
  }
];

export const sampleUserQueries = [
  "Is it ever ethical to lie to protect someone?",
  "How do I balance personal happiness with obligations to others?",
  "What's more important: following rules or considering consequences?",
  "How should I resolve conflicts between competing ethical values?"
];
