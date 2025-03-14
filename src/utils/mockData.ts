import { ChatMessage, Book } from '@/types';

export const initialMessages: ChatMessage[] = [
  {
    id: '1',
    content: "Hello! I'm here to help you explore ethical dilemmas and gain wisdom from great books. How can I assist you today?",
    type: 'bot',
    timestamp: new Date(),
  },
];

export const sampleUserQueries = [
  "What's the ethical perspective on telling white lies?",
  "How do I balance personal happiness with duties to others?",
  "Are rules more important than consequences?",
  "What does virtue ethics say about handling conflicts of interest?",
  "How can I apply Stoic principles to modern life?",
];

export const sampleCitations = [
  {
    book: "Nicomachean Ethics",
    author: "Aristotle",
    page: 42
  },
  {
    book: "Groundwork of the Metaphysics of Morals",
    author: "Immanuel Kant",
    page: 87
  }
];

// Update mockBooks to include imageUrl
export const mockBooks: Book[] = [
  {
    id: '1',
    title: 'Nicomachean Ethics',
    author: 'Aristotle',
    genre: 'Philosophy',
    summary: 'Aristotle\'s exploration of virtue ethics, discussing how humans should best live by cultivating virtue in the pursuit of eudaimonia (happiness or flourishing).',
    coverColor: 'bg-indigo-700',
    imageUrl: 'https://m.media-amazon.com/images/I/71Fwr0WxK6L._AC_UF1000,1000_QL80_.jpg'
  },
  {
    id: '2',
    title: 'Critique of Pure Reason',
    author: 'Immanuel Kant',
    genre: 'Philosophy',
    summary: 'Kant\'s foundational work on epistemology and metaphysics, establishing the limits of human knowledge and understanding.',
    coverColor: 'bg-emerald-700',
    imageUrl: 'https://m.media-amazon.com/images/I/71MGRGD0QuL._AC_UF1000,1000_QL80_.jpg'
  },
  {
    id: '3',
    title: 'The Republic',
    author: 'Plato',
    genre: 'Philosophy',
    summary: 'Plato\'s dialogue explores justice, the ideal state, and the role of philosophers in governance, using the allegory of the cave to explain human perception.',
    coverColor: 'bg-amber-600',
    imageUrl: 'https://m.media-amazon.com/images/I/711zB4VqXVL._AC_UF1000,1000_QL80_.jpg'
  },
  {
    id: '4',
    title: 'Meditations',
    author: 'Marcus Aurelius',
    genre: 'Philosophy',
    summary: 'Personal writings of the Roman Emperor and Stoic philosopher, offering insights on resilience, virtue, and finding peace in a chaotic world.',
    coverColor: 'bg-rose-700',
    imageUrl: 'https://m.media-amazon.com/images/I/71SXQ+RxqML._AC_UF1000,1000_QL80_.jpg'
  },
  {
    id: '5',
    title: 'Ethics',
    author: 'Baruch Spinoza',
    genre: 'Ethics',
    summary: 'Spinoza\'s systematic examination of ethics, metaphysics, and human emotions, advocating for an ethical system based on reason and self-improvement.',
    coverColor: 'bg-violet-700',
    imageUrl: 'https://m.media-amazon.com/images/I/61wvgveM0RL._AC_UF1000,1000_QL80_.jpg'
  },
  {
    id: '6',
    title: 'The Moral Landscape',
    author: 'Sam Harris',
    genre: 'Ethics',
    summary: 'Harris argues that science can determine moral values by examining how actions affect the well-being of conscious creatures.',
    coverColor: 'bg-blue-700',
    imageUrl: 'https://m.media-amazon.com/images/I/71Fxt0S7xEL._AC_UF1000,1000_QL80_.jpg'
  },
  {
    id: '7',
    title: 'Utilitarianism',
    author: 'John Stuart Mill',
    genre: 'Ethics',
    summary: 'Mill\'s classic defense of utilitarianism, proposing that actions are right if they promote happiness, and wrong if they produce suffering.',
    coverColor: 'bg-cyan-700',
    imageUrl: 'https://m.media-amazon.com/images/I/61lARFeczcL._AC_UF1000,1000_QL80_.jpg'
  },
  {
    id: '8',
    title: 'The Path to Inner Peace',
    author: 'Thich Nhat Hanh',
    genre: 'Spirituality',
    summary: 'A guide to finding peace through mindfulness, meditation, and conscious breathing practices, drawing from Buddhist teachings.',
    coverColor: 'bg-teal-700',
    imageUrl: 'https://m.media-amazon.com/images/I/71l+w7hD+aL._AC_UF1000,1000_QL80_.jpg'
  },
  {
    id: '9',
    title: 'The Power of Now',
    author: 'Eckhart Tolle',
    genre: 'Spirituality',
    summary: 'Tolle guides readers to spiritual enlightenment by living in the present moment and transcending thoughts of past and future.',
    coverColor: 'bg-fuchsia-700',
    imageUrl: 'https://m.media-amazon.com/images/I/714FbKtXS+L._AC_UF1000,1000_QL80_.jpg'
  },
  {
    id: '10',
    title: 'Atomic Habits',
    author: 'James Clear',
    genre: 'Self-Help',
    summary: 'Clear provides practical strategies for forming good habits, breaking bad ones, and mastering tiny behaviors that lead to remarkable results.',
    coverColor: 'bg-red-700',
    imageUrl: 'https://m.media-amazon.com/images/I/81wgcld4wxL._AC_UF1000,1000_QL80_.jpg'
  },
  {
    id: '11',
    title: 'Thinking, Fast and Slow',
    author: 'Daniel Kahneman',
    genre: 'Psychology',
    summary: 'Kahneman explores the two systems of thinking that drive our decisions, revealing the cognitive biases that affect our everyday judgments.',
    coverColor: 'bg-orange-700',
    imageUrl: 'https://m.media-amazon.com/images/I/61fdrEuPJwL._AC_UF1000,1000_QL80_.jpg'
  },
  {
    id: '12',
    title: 'Man\'s Search for Meaning',
    author: 'Viktor E. Frankl',
    genre: 'Psychology',
    summary: 'Based on his experiences in Nazi concentration camps, Frankl argues that we cannot avoid suffering but can choose how to cope with it, find meaning in it, and move forward.',
    coverColor: 'bg-lime-700',
    imageUrl: 'https://m.media-amazon.com/images/I/61lGw70GzHL._AC_UF1000,1000_QL80_.jpg'
  }
];
