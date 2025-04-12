
import logging
from fastapi import APIRouter, Request
from app.utils.request_helpers import is_api_request

# Configure logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(tags=["api-info"])

@router.get("/api-routes")
async def list_api_routes(request: Request):
    """List all available API routes for debugging"""
    is_api = is_api_request(request)
    logger.info(f"API routes endpoint called, is_api_request: {is_api}")
    
    from app.main import app
    from app.routers import chat
    
    routes = []
    for route in app.routes:
        routes.append({
            "path": route.path,
            "name": route.name,
            "methods": route.methods if hasattr(route, "methods") else None,
        })
    
    # Add chat router info
    chat_router_info = {
        "prefix": chat.router.prefix,
        "tags": chat.router.tags,
        "routes": [
            {"path": r.path, "name": r.name, "methods": r.methods} 
            for r in chat.router.routes
        ]
    }
    
    return {
        "app_routes": routes,
        "chat_router_info": chat_router_info
    }

@router.get("/test-chat")
async def test_chat_endpoint(request: Request):
    """Test if the chat endpoint is properly registered"""
    is_api = is_api_request(request)
    logger.info(f"Test chat endpoint called, is_api_request: {is_api}")
    
    try:
        from app.main import app
        from app.routers import chat
        
        # Check if the chat router is properly included
        is_chat_router_included = False
        for route in app.routes:
            if '/chat' in route.path and 'POST' in route.methods:
                is_chat_router_included = True
                break
        
        return {
            "status": "ok",
            "message": "Chat endpoint test",
            "is_chat_router_included": is_chat_router_included,
            "chat_router_tags": chat.router.tags,
            "chat_router_routes": [
                {"path": r.path, "name": r.name, "methods": r.methods} 
                for r in chat.router.routes
            ]
        }
    except Exception as e:
        logger.error(f"Error testing chat endpoint: {str(e)}")
        return {
            "status": "error",
            "message": f"Error testing chat endpoint: {str(e)}"
        }
