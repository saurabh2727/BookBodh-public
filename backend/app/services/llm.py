
import requests
import json
import logging
import html
from typing import Dict, List
from app.config.settings import settings

# Configure logger
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

def sanitize_html(text: str) -> str:
    """
    Sanitize HTML content to remove tags and convert entities to their proper characters
    
    Args:
        text: The text containing HTML to sanitize
        
    Returns:
        Cleaned text with HTML entities converted and tags removed
    """
    # First, convert HTML entities
    unescaped = html.unescape(text)
    
    # Remove HTML tags - a simple approach
    # For more complex HTML parsing, consider using a library like BeautifulSoup
    in_tag = False
    result = ""
    for char in unescaped:
        if char == "<":
            in_tag = True
        elif char == ">" and in_tag:
            in_tag = False
        elif not in_tag:
            result += char
    
    return result

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
        # Clean any HTML in the chunk text
        clean_text = sanitize_html(chunk['text']) if 'text' in chunk else ""
        context += f"\nChunk {i+1} from '{chunk['title']}' by {chunk['author']}:\n{clean_text}\n"
        book_citations[chunk['title']] = chunk['author']
    
    # Create prompt for Grok
    prompt = f"""Answer the query: '{query}' using this context: 
    
{context}

Always cite the book and author when referencing information from the texts. 
If the answer cannot be found in the provided context, indicate that clearly.
Provide a thoughtful, well-reasoned response with quotations from the book where appropriate.
DO NOT include HTML tags in your response."""
    
    # Call Grok API
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {settings.GROK_API_KEY}"
    }
    
    payload = {
        "model": settings.DEFAULT_MODEL,
        "messages": [
            {"role": "system", "content": "You are a helpful assistant that provides insights from books. Provide clear, readable text without HTML tags."},
            {"role": "user", "content": prompt}
        ],
        "temperature": settings.TEMPERATURE,
        "max_tokens": settings.MAX_TOKENS
    }
    
    try:
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers=headers,
            data=json.dumps(payload)
        )
        logger.info(f"Grok API response: {response.text}")
        response.raise_for_status()
        
        # Extract response from Grok
        result = response.json()
        response_text = result["choices"][0]["message"]["content"]
        
        # Ensure the response is clean of HTML
        response_text = sanitize_html(response_text)
        
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
        logger.error(f"Grok API error: {str(e)}")
        return {
            "response": f"I'm sorry, I encountered an issue while processing your request. Error: {str(e)}",
            "book": None,
            "author": None
        }
