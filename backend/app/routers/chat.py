
from fastapi import APIRouter, HTTPException
from app.models.chat import ChatRequest, ChatResponse
from app.services.retrieval import retrieve_chunks
from app.services.llm import generate_response

router = APIRouter(tags=["chat"])

@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Process a chat request and return a response
    
    Args:
        request: ChatRequest with query and optional book
        
    Returns:
        ChatResponse with AI-generated answer and citation information
    """
    try:
        # For general chat without a book selected
        if not request.book and not request.bookId and not request.chunks:
            return ChatResponse(
                response=f"I'm BookBodh, your AI assistant. {request.query}",
                book=None,
                author=None
            )
            
        # If a book is specified, use book-specific logic
        if request.book or request.bookId or request.chunks:
            # Use provided chunks if available, otherwise retrieve them
            if request.chunks:
                chunks = request.chunks
            else:
                # Retrieve relevant chunks based on query and optional book filter
                chunks = retrieve_chunks(request.query, request.book, request.bookId)
            
            if not chunks:
                # If no relevant chunks found, return a helpful message
                return ChatResponse(
                    response="I couldn't find any relevant information in this book. Please try a different question or book selection.",
                    book=None,
                    author=None
                )
            
            # Generate response using LLM
            llm_response = generate_response(request.query, chunks)
            
            # Return formatted response
            return ChatResponse(
                response=llm_response["response"],
                book=llm_response["book"],
                author=llm_response["author"]
            )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing chat request: {str(e)}")
