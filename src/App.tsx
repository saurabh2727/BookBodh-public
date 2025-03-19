
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as SonnerToaster } from '@/components/ui/sonner';
import Index from './pages/Index';
import Login from './pages/Login';
import NotFound from './pages/NotFound';
import ProtectedRoute from './components/ProtectedRoute';
import ChatInterface from './components/ChatInterface';
import Diagnostics from './pages/Diagnostics';
import './App.css';
import { useParams } from 'react-router-dom';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    }
  }
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="bookbodh-theme">
        <Router>
          <Routes>
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <Index />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/chat" 
              element={
                <ProtectedRoute>
                  <ChatInterface />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/chat/:bookId" 
              element={
                <ProtectedRoute>
                  <ChatWithBook />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/diagnostics" 
              element={
                <ProtectedRoute>
                  <Diagnostics />
                </ProtectedRoute>
              } 
            />
            <Route path="/login" element={<Login />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Router>
        <Toaster />
        <SonnerToaster position="bottom-right" />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

// Separate component to handle chat with a specific book
function ChatWithBook() {
  // Use useParams instead of directly accessing window.location
  const { bookId } = useParams();
  
  return <ChatInterface selectedBookId={bookId || null} />;
}

export default App;
