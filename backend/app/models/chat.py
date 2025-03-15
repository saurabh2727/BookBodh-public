
from pydantic import BaseModel
from typing import Optional

class ChatRequest(BaseModel):
    query: str
    book: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    book: Optional[str] = None
    author: Optional[str] = None
