
import requests
import json
from typing import Dict, List
from app.config.settings import GROK_API_KEY

def generate_response(query: str, chunks: List[Dict]) -> Dict:
    """
    Generate a response using the Grok API based on the query and retrieved chunks
    
    Args:
        query: The user's question
        chunks: List of relevant text chunks with metadata
        
    Returns:
        Dictionary with response text and citation information
    """
    # Format chunks for context
    context = ""
    book_citations = {}
    
    for i, chunk in enumerate(chunks):
        context += f"\nChunk {i+1} from '{chunk['title']}' by {chunk['author']}:\n{chunk['text']}\n"
        book_citations[chunk['title']] = chunk['author']
    
    # Create prompt for Grok
    prompt = f"""Answer the query: '{query}' using this context: 
    
{context}

Always cite the book and author when referencing information from the texts. 
If the answer cannot be found in the provided context, indicate that clearly.
Provide a thoughtful, well-reasoned response with quotations from the book where appropriate."""
    
    # Call Grok API
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {GROK_API_KEY}"
    }
    
    payload = {
        "model": "grok-1",
        "messages": [
            {"role": "system", "content": "You are a helpful assistant that provides insights from books."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.7,
        "max_tokens": 500
    }
    
    try:
        response = requests.post(
            "https://api.xai.com/v1/chat/completions",
            headers=headers,
            data=json.dumps(payload)
        )
        response.raise_for_status()
        
        # Extract response from Grok
        result = response.json()
        response_text = result["choices"][0]["message"]["content"]
        
        # Determine which book was cited (this is a simple approach)
        cited_book = None
        cited_author = None
        
        for book, author in book_citations.items():
            if book.lower() in response_text.lower():
                cited_book = book
                cited_author = author
                break
        
        return {
            "response": response_text,
            "book": cited_book,
            "author": cited_author
        }
        
    except Exception as e:
        # In case of API failure, return a graceful error message
        return {
            "response": f"I'm sorry, I encountered an issue while processing your request. Error: {str(e)}",
            "book": None,
            "author": None
        }
