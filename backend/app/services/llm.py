
import requests
import json
import logging
import html
import re
from typing import Dict, List, Optional, Tuple
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

def extract_book_preview_url(text: str) -> Optional[str]:
    """
    Extract Google Books preview URL from text if present
    
    Args:
        text: Text that may contain a Google Books URL
        
    Returns:
        Extracted URL or None if not found
    """
    # Look for Google Books preview URL patterns
    book_preview_regex = r'https://www\.google\.com/books/edition/_/([a-zA-Z0-9_-]+)\?hl=en&gbpv=1'
    book_embed_regex = r'https://books\.google\.[a-z.]+/books\?id=([a-zA-Z0-9_-]+)&lpg=.+&pg=.+&output=embed'
    
    # Check for preview URL
    preview_match = re.search(book_preview_regex, text)
    if preview_match:
        book_id = preview_match.group(1)
        # Create a better embed URL for the iframe
        return f"https://books.google.com/books?id={book_id}&lpg=PP1&pg=PP1&output=embed"
    
    # Check for embed URL
    embed_match = re.search(book_embed_regex, text)
    if embed_match:
        return embed_match.group(0)
    
    return None

def generate_response(query: str, chunks: List[Dict]) -> Dict:
    """
    Generate a response using the Groq API based on the query and retrieved chunks
    
    Args:
        query: The user's question
        chunks: List of relevant text chunks with metadata
        
    Returns:
        Dictionary with response text and citation information
    """
    # Format chunks for context
    context = ""
    book_citations = {}
    preview_urls = []
    
    # Log input data
    logger.info(f"Generating response for query: '{query}'")
    logger.info(f"Using {len(chunks)} chunks for context")
    
    for i, chunk in enumerate(chunks):
        # Clean any HTML in the chunk text
        clean_text = sanitize_html(chunk['text']) if 'text' in chunk else ""
        context += f"\nChunk {i+1} from '{chunk.get('title', 'Unknown')}' by {chunk.get('author', 'Unknown')}:\n{clean_text}\n"
        book_citations[chunk.get('title', 'Unknown')] = chunk.get('author', 'Unknown')
        
        # Check if this chunk contains a book preview URL
        preview_url = extract_book_preview_url(clean_text)
        if preview_url and preview_url not in preview_urls:
            preview_urls.append(preview_url)
    
    # Create prompt for Groq LLM
    prompt = f"""Answer the query: '{query}' using this context: 
    
{context}

Always cite the book and author when referencing information from the texts. 
If the answer cannot be found in the provided context, indicate that clearly.
Provide a thoughtful, well-reasoned response with quotations from the book where appropriate.
DO NOT include HTML tags in your response."""
    
    # Call Groq API
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
        logger.info(f"Calling Groq API with model: {settings.DEFAULT_MODEL}")
        logger.info(f"Using Groq API key: {settings.GROK_API_KEY[:8]}... (first 8 chars)")
        logger.debug(f"Payload: {json.dumps(payload)[:500]}...")
        
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers=headers,
            data=json.dumps(payload),
            timeout=30  # Add a timeout to prevent hanging
        )
        
        logger.info(f"Groq API status code: {response.status_code}")
        
        # Handle non-successful responses
        if response.status_code != 200:
            logger.error(f"Groq API error: Status {response.status_code}, Response: {response.text}")
            return {
                "response": f"I encountered an issue processing your request. The Groq API returned status code {response.status_code}. Please try again later.",
                "book": None,
                "author": None,
                "error": f"Groq API returned status {response.status_code}"
            }
        
        # Parse successful response
        result = response.json()
        response_text = result["choices"][0]["message"]["content"]
        
        # Ensure the response is clean of HTML
        response_text = sanitize_html(response_text)
        
        # Add book preview URL to the response if available
        if preview_urls and len(preview_urls) > 0:
            response_text += f"\n\nYou can preview this book at: {preview_urls[0]}"
        
        logger.info(f"Generated response with content length: {len(response_text)}")
        
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
        
    except requests.exceptions.Timeout:
        logger.error("Timeout while calling Groq API")
        return {
            "response": "I'm sorry, the request to generate a response timed out. Please try again with a simpler query.",
            "book": None,
            "author": None,
            "error": "API timeout"
        }
    except requests.exceptions.RequestException as e:
        # Handle network errors, connection issues, etc.
        logger.error(f"Request exception while calling Groq API: {str(e)}")
        return {
            "response": f"I'm sorry, I encountered a network issue while processing your request. Error: {str(e)}",
            "book": None,
            "author": None,
            "error": f"Request error: {str(e)}"
        }
    except Exception as e:
        # General error handling
        logger.error(f"Groq API error: {str(e)}")
        logger.error(f"Error details:", exc_info=True)
        return {
            "response": f"I'm sorry, I encountered an issue while processing your request. Error: {str(e)}",
            "book": None,
            "author": None,
            "error": f"Error processing request: {str(e)}"
        }
