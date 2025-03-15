
import { ChatRequest, ChatResponse } from '../types';

const API_BASE_URL = 'http://localhost:8000';

/**
 * Sends a chat request to the backend
 * @param request The chat request with query and optional book
 * @returns Promise with the chat response
 */
export const sendChatRequest = async (request: ChatRequest): Promise<ChatResponse> => {
  try {
    console.log('Sending chat request to:', `${API_BASE_URL}/chat`);
    console.log('Request payload:', JSON.stringify(request));
    
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      credentials: 'include', // Include cookies if needed
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Failed to parse error response' }));
      console.error('Server response error:', response.status, errorData);
      throw new Error(errorData.detail || `Server returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Server response:', data);
    return data;
  } catch (error) {
    console.error('Chat request error:', error);
    throw error;
  }
};
