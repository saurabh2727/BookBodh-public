
import { ChatMessage, Citation, Book } from '@/types';

// Sample initial messages
export const initialMessages: ChatMessage[] = [
  {
    id: '1',
    content: 'Welcome to Ethical Wisdom. How can I help you with your ethical dilemma today?',
    type: 'bot',
    timestamp: new Date(),
  },
];

// Sample citations
export const sampleCitations: Citation[] = [
  {
    book: 'Nicomachean Ethics',
    author: 'Aristotle',
    page: 42,
  },
  {
    book: 'Critique of Pure Reason',
    author: 'Immanuel Kant',
    page: 128,
  },
  {
    book: 'Utilitarianism',
    author: 'John Stuart Mill',
    page: 75,
  },
  {
    book: 'Ethics',
    author: 'Baruch Spinoza',
    page: 163,
  },
  {
    book: 'Beyond Good and Evil',
    author: 'Friedrich Nietzsche',
    page: 89,
  },
];

// Sample user queries
export const sampleUserQueries: string[] = [
  'What does Kant say about lying?',
  'Is happiness the ultimate goal?',
  'How should I balance personal desires and obligations?',
  'What is the best way to live a good life?',
  'Are there universal moral rules?',
];

// Sample books data
export const mockBooks: Book[] = [
  {
    id: '1',
    title: 'Nicomachean Ethics',
    author: 'Aristotle',
    genre: 'Philosophy',
    summary: 'Aristotle\'s Nicomachean Ethics explores virtue ethics and the concept of eudaimonia (happiness or flourishing). It argues that the virtuous life is achieved through finding the mean between excess and deficiency in various virtues.',
    coverColor: 'bg-indigo-600',
  },
  {
    id: '2',
    title: 'Critique of Pure Reason',
    author: 'Immanuel Kant',
    genre: 'Philosophy',
    summary: 'Kant\'s groundbreaking work explores the limits of human reason and understanding. It examines how we can know things a priori (independent of experience) and establishes the foundations for his moral philosophy.',
    coverColor: 'bg-blue-700',
  },
  {
    id: '3',
    title: 'Utilitarianism',
    author: 'John Stuart Mill',
    genre: 'Ethics',
    summary: 'Mill presents and defends utilitarianism, the view that actions are right if they promote happiness or pleasure, and wrong if they produce unhappiness or pain, not just for the person performing the action but for everyone affected.',
    coverColor: 'bg-green-600',
  },
  {
    id: '4',
    title: 'Meditations',
    author: 'Marcus Aurelius',
    genre: 'Spirituality',
    summary: 'The personal reflections of Roman Emperor Marcus Aurelius on Stoic philosophy. He emphasizes virtue, duty, and living in accordance with nature, offering practical wisdom for facing life\'s challenges with equanimity.',
    coverColor: 'bg-yellow-600',
  },
  {
    id: '5',
    title: 'The Analects',
    author: 'Confucius',
    genre: 'Ethics',
    summary: 'A collection of sayings and ideas attributed to Confucius, emphasizing personal and governmental morality, correctness of social relationships, justice, and sincerity. It has been influential in shaping Chinese culture and society.',
    coverColor: 'bg-red-600',
  },
  {
    id: '6',
    title: 'The Ethics of Ambiguity',
    author: 'Simone de Beauvoir',
    genre: 'Philosophy',
    summary: 'De Beauvoir explores existentialist ethics, arguing that human existence inherently involves ambiguity that cannot be overcome but must be embraced. She discusses freedom, responsibility, and liberation in a world without absolute values.',
    coverColor: 'bg-purple-600',
  },
  {
    id: '7',
    title: 'Man\'s Search for Meaning',
    author: 'Viktor E. Frankl',
    genre: 'Psychology',
    summary: 'Based on his experiences in Nazi concentration camps, Frankl argues that we cannot avoid suffering but we can choose how to cope with it, find meaning in it, and move forward. He developed logotherapy, focusing on the search for life\'s meaning.',
    coverColor: 'bg-emerald-600',
  },
  {
    id: '8',
    title: 'The Power of Now',
    author: 'Eckhart Tolle',
    genre: 'Spirituality',
    summary: 'Tolle explores the importance of living in the present moment and transcending our ego-based state of consciousness. He argues that connecting with the present moment is the key to spiritual enlightenment and happiness.',
    coverColor: 'bg-cyan-600',
  },
  {
    id: '9',
    title: 'Justice: What\'s the Right Thing to Do?',
    author: 'Michael J. Sandel',
    genre: 'Ethics',
    summary: 'Sandel introduces readers to the major theories of justice and applies them to contemporary issues. He challenges readers to examine the moral and ethical implications of their beliefs about justice, fairness, and the common good.',
    coverColor: 'bg-pink-600',
  },
  {
    id: '10',
    title: 'After Virtue',
    author: 'Alasdair MacIntyre',
    genre: 'Philosophy',
    summary: 'MacIntyre critiques modern moral discourse and calls for a return to virtue ethics rooted in Aristotelian traditions. He argues that modern morality has lost its way by abandoning the concept of teleology or purpose in human life.',
    coverColor: 'bg-violet-700',
  },
  {
    id: '11',
    title: 'Tao Te Ching',
    author: 'Lao Tzu',
    genre: 'Spirituality',
    summary: 'A fundamental text for Taoism, this ancient Chinese work emphasizes living in harmony with the Tao (the Way), following nature, and finding balance through non-action (wu-wei) and simplicity.',
    coverColor: 'bg-amber-600',
  },
  {
    id: '12',
    title: 'Beyond Good and Evil',
    author: 'Friedrich Nietzsche',
    genre: 'Philosophy',
    summary: 'Nietzsche critiques past philosophers for their dogmatism and lack of critical sense. He challenges traditional morality, calling for a reevaluation of values and proposing a "will to power" as a key driving force in humans.',
    coverColor: 'bg-lime-600',
  },
  {
    id: '13',
    title: 'Ethics',
    author: 'Baruch Spinoza',
    genre: 'Philosophy',
    summary: 'Spinoza presents a deterministic universe where God and Nature are identical. He argues that true happiness comes from understanding the universe and our place in it, freeing ourselves from the bondage of the passions.',
    coverColor: 'bg-teal-600',
  },
  {
    id: '14',
    title: 'The Art of Happiness',
    author: 'Dalai Lama & Howard C. Cutler',
    genre: 'Self-Help',
    summary: 'The Dalai Lama shares his wisdom on achieving lasting happiness by training the mind and developing compassion. He emphasizes that happiness is determined more by one\'s state of mind than by external circumstances.',
    coverColor: 'bg-rose-600',
  },
  {
    id: '15',
    title: 'The Four Agreements',
    author: 'Don Miguel Ruiz',
    genre: 'Self-Help',
    summary: 'Ruiz offers a code of conduct based on ancient Toltec wisdom. The four agreements—be impeccable with your word, don\'t take anything personally, don\'t make assumptions, and always do your best—can transform lives and lead to freedom and happiness.',
    coverColor: 'bg-orange-600',
  },
];
