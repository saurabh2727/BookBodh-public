
from fastapi import Request

def is_api_request(request: Request) -> bool:
    """Check if this request is intended for the API vs the frontend"""
    # Check for special headers that indicate an API request
    api_request = request.headers.get("X-API-Request") == "true"
    backend_request = request.headers.get("X-Backend-Request") == "true"
    accept_header = request.headers.get("Accept", "")
    
    # If any of these conditions are true, consider it an API request
    return api_request or backend_request or "application/json" in accept_header
