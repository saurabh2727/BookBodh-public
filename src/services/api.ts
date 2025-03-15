
import { ChatRequest, ChatResponse } from '../types';

const API_BASE_URL = 'http://localhost:8000';

/**
 * Sends a chat request to the backend
 * @param request The chat request with query and optional book
 * @returns Promise with the chat response
 */
export const sendChatRequest = async (request: ChatRequest): Promise<ChatResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to get response from the server');
    }

    return await response.json();
  } catch (error) {
    console.error('Chat request error:', error);
    throw error;
  }
};
