
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class ChatRequest(BaseModel):
    query: str
    book: Optional[str] = None
    bookId: Optional[str] = None
    chunks: Optional[List[Dict[str, Any]]] = None

class ChatResponse(BaseModel):
    response: str
    book: Optional[str] = None
    author: Optional[str] = None

