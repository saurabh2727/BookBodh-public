
import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    // Function to check and initialize auth
    const initAuth = async () => {
      try {
        console.log('Initializing auth in ProtectedRoute...');
        
        // Get the current session
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error checking session:', error);
          setAuthenticated(false);
          setLoading(false);
          return;
        }
        
        if (data.session) {
          console.log('Session found during init, expires at:', new Date(data.session.expires_at * 1000).toLocaleString());
          setAuthenticated(true);
        } else {
          console.log('No session found during init');
          
          // Try to refresh the session as a fallback
          try {
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
            
            if (refreshError) {
              console.error('Error refreshing session:', refreshError);
              setAuthenticated(false);
            } else if (refreshData.session) {
              console.log('Session refreshed successfully');
              setAuthenticated(true);
            } else {
              console.log('No session after refresh attempt');
              setAuthenticated(false);
            }
          } catch (refreshError) {
            console.error('Exception during session refresh:', refreshError);
            setAuthenticated(false);
          }
        }
      } catch (err) {
        console.error('Unexpected error in initAuth:', err);
        setAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    // Set up the auth state change listener
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event, 'Session exists:', !!session);
        
        // Update state based on the session
        if (session) {
          setAuthenticated(true);
        } else if (event === 'SIGNED_OUT') {
          setAuthenticated(false);
        }
        
        setLoading(false);
      }
    );

    // Initialize auth
    initAuth();

    // Clean up the listener on unmount
    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-primary/30 border-t-primary rounded-full"></div>
      </div>
    );
  }

  if (!authenticated) {
    console.log('User not authenticated, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  console.log('User authenticated, rendering protected content');
  return <>{children}</>;
};

export default ProtectedRoute;
