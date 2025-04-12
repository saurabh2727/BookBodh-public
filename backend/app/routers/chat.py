
import logging
from fastapi import APIRouter, HTTPException
from app.models.chat import ChatRequest, ChatResponse
from app.services.retrieval import retrieve_chunks
from app.services.llm import generate_response
from pydantic import BaseModel
from typing import Optional

# Set up logging for this module
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

router = APIRouter(tags=["chat"])

class ExtractionRequest(BaseModel):
    book_id: str
    force: Optional[bool] = False

@router.post("/extract-book/{book_id}", status_code=202)
async def extract_book(book_id: str, request: ExtractionRequest):
    """
    Trigger book content extraction for a specific book
    
    Args:
        book_id: ID of the book to extract content from
        request: Optional parameters for the extraction
        
    Returns:
        Dictionary with status information
    """
    logger.info(f"Book extraction endpoint called for book ID: {book_id}")
    
    try:
        # Use retrieve_chunks to trigger the extraction process
        # By passing only the book_id, it will focus on getting chunks for that book
        # If no chunks exist, it will trigger the extraction flow
        chunks = retrieve_chunks("", None, book_id)
        
        extraction_status = "success" if chunks and len(chunks) > 0 else "in_progress"
        chunks_count = len(chunks) if chunks else 0
        
        logger.info(f"Extraction triggered with status: {extraction_status}, chunks: {chunks_count}")
        
        return {
            "status": extraction_status,
            "book_id": book_id,
            "chunks_count": chunks_count,
            "message": f"Book content extraction {'completed' if chunks_count > 0 else 'initiated'}"
        }
            
    except Exception as e:
        logger.error(f"Error processing extraction request: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error processing extraction request: {str(e)}")

@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Process a chat request and return a response
    
    Args:
        request: ChatRequest with query and optional book
        
    Returns:
        ChatResponse with AI-generated answer and citation information
    """
    logger.info(f"Chat endpoint called with query: '{request.query}' for book: {request.book or request.bookId or 'None'}")
    
    try:
        # For general chat without a book selected, still use Groq with empty context
        logger.info("Processing chat request, retrieving chunks if needed")
        chunks = []
        
        # If a book is specified, retrieve relevant chunks
        if request.book or request.bookId:
            if request.chunks:
                logger.info(f"Using {len(request.chunks)} provided chunks")
                chunks = request.chunks
            else:
                # Retrieve relevant chunks based on query and optional book filter
                logger.info(f"Retrieving chunks for query: '{request.query}'")
                chunks = retrieve_chunks(request.query, request.book, request.bookId)
                logger.info(f"Retrieved {len(chunks) if chunks else 0} chunks")
        
        # Generate response using LLM - ALWAYS use Groq, even for general chats
        logger.info(f"Generating response using Groq LLM with {len(chunks)} chunks")
        llm_response = generate_response(request.query, chunks)
        logger.info(f"LLM response generated with {len(llm_response['response']) if llm_response.get('response') else 0} characters")
        
        # Return formatted response
        return ChatResponse(
            response=llm_response["response"],
            book=llm_response["book"],
            author=llm_response["author"]
        )
        
    except Exception as e:
        logger.error(f"Error processing chat request: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error processing chat request: {str(e)}")
