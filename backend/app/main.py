
from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
import logging
import os
import json
from typing import Dict, Any, List
from .routers import books, chat
from .config.settings import Settings
from pathlib import Path
from .services.book_extraction import BookExtractor
from .database.books import BookDatabase

# Configure logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize settings
settings = Settings()

# Create FastAPI app
app = FastAPI(title="BookBodh API")

# Add CORS middleware with more permissive settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],  # Allow all headers
    expose_headers=["Content-Type", "Content-Disposition", "X-API-Request", "X-Backend-Request"],
)

# Include routers
# First include at API prefix level (this should take precedence)
app.include_router(books.router, prefix="/api")
app.include_router(chat.router, prefix="/api")

# Also include at root level for backward compatibility
app.include_router(books.router)
app.include_router(chat.router)

# Define paths
app_dir = os.path.dirname(__file__)
cache_dir = os.path.join(app_dir, "cache")
screenshots_dir = os.path.join(cache_dir, "screenshots")
uploads_dir = os.path.join(os.path.dirname(app_dir), "uploads")

# Create directories if they don't exist
os.makedirs(cache_dir, exist_ok=True)
os.makedirs(screenshots_dir, exist_ok=True)
os.makedirs(uploads_dir, exist_ok=True)

# Helper to check if a request is an API request (vs. a frontend request)
def is_api_request(request: Request) -> bool:
    """Check if this request is intended for the API vs the frontend"""
    # Check for special headers that indicate an API request
    api_request = request.headers.get("X-API-Request") == "true"
    backend_request = request.headers.get("X-Backend-Request") == "true"
    accept_header = request.headers.get("Accept", "")
    
    # If any of these conditions are true, consider it an API request
    return api_request or backend_request or "application/json" in accept_header

@app.get("/")
async def root(request: Request):
    """
    Root endpoint with basic information
    """
    # Log all headers if in debug mode
    is_api = is_api_request(request)
    logger.info(f"Root endpoint called, is_api_request: {is_api}")
    
    # Get current directory info
    try:
        base_dir = os.path.dirname(os.path.dirname(__file__))
        current_dir = os.getcwd()
        app_dir = os.path.dirname(__file__)
        cache_dir = os.path.join(app_dir, "cache")
        data_dir = os.path.join(app_dir, "data")
        uploads_dir = os.path.join(os.path.dirname(app_dir), "uploads")
        
        # Check if directories exist
        cache_exists = os.path.exists(cache_dir)
        data_exists = os.path.exists(data_dir)
        uploads_exists = os.path.exists(uploads_dir)
        
        # Try to create missing directories
        if not cache_exists:
            os.makedirs(cache_dir, exist_ok=True)
            logger.info(f"Created missing cache directory: {cache_dir}")
            cache_exists = True
            
        if not data_exists:
            os.makedirs(data_dir, exist_ok=True)
            logger.info(f"Created missing data directory: {data_dir}")
            data_exists = True
            
        if not uploads_exists:
            os.makedirs(uploads_dir, exist_ok=True)
            logger.info(f"Created missing uploads directory: {uploads_dir}")
            uploads_exists = True
            
        return {
            "status": "ok",
            "message": "BookBodh API is running",
            "current_working_directory": current_dir,
            "app_directory": app_dir,
            "base_directory": base_dir,
            "directories": {
                "cache": {
                    "path": cache_dir,
                    "exists": cache_exists
                },
                "data": {
                    "path": data_dir,
                    "exists": data_exists
                },
                "uploads": {
                    "path": uploads_dir,
                    "exists": uploads_exists
                }
            }
        }
    except Exception as e:
        logger.error(f"Error in root endpoint: {str(e)}")
        return {
            "status": "error",
            "message": f"Error checking directories: {str(e)}"
        }

@app.get("/health")
async def health_check(request: Request):
    """
    Health check endpoint for monitoring and diagnostics
    """
    try:
        # Enhanced logging for health check
        is_api = is_api_request(request)
        logger.info(f"Health check endpoint called, is_api_request: {is_api}")
        
        # Check essential directories
        app_dir = os.path.dirname(__file__)
        cache_dir = os.path.join(app_dir, "cache")
        screenshots_dir = os.path.join(cache_dir, "screenshots")
        
        # Create directories if they don't exist
        os.makedirs(cache_dir, exist_ok=True)
        os.makedirs(screenshots_dir, exist_ok=True)
        
        # Log more info
        logger.info(f"Cache directory: {cache_dir}, exists: {os.path.exists(cache_dir)}")
        logger.info(f"Screenshots directory: {screenshots_dir}, exists: {os.path.exists(screenshots_dir)}")
        
        return {
            "status": "healthy",
            "message": "BookBodh API is running normally",
            "version": "1.0.0",
            "directories": {
                "cache": os.path.exists(cache_dir),
                "screenshots": os.path.exists(screenshots_dir)
            },
            "api_name": "BookBodh Backend API"
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return {
            "status": "unhealthy",
            "message": f"Health check failed: {str(e)}"
        }

@app.get("/api/health")
async def api_health_check(request: Request):
    """
    API-prefixed health check endpoint to test API routing
    """
    try:
        # Log whether this is an API request
        is_api = is_api_request(request)
        logger.info(f"API health check endpoint called, is_api_request: {is_api}")
        
        # Log headers in debug mode
        if settings.debug:
            logger.debug(f"Request headers: {dict(request.headers)}")
            
        return {
            "status": "healthy",
            "message": "BookBodh API endpoint is accessible",
            "version": "1.0.0",
            "api_routing": "working",
            "api_name": "BookBodh Backend API"
        }
    except Exception as e:
        logger.error(f"API health check failed: {str(e)}")
        return {
            "status": "unhealthy",
            "message": f"API health check failed: {str(e)}"
        }

@app.get("/api/test")
async def api_test(request: Request):
    """
    Simple endpoint to test API routing
    """
    # Log whether this is an API request
    is_api = is_api_request(request)
    logger.info(f"API test endpoint called, is_api_request: {is_api}")
    
    return {
        "status": "success",
        "message": "API endpoint is working correctly",
        "service": "BookBodh API"
    }

@app.get("/api-routes")
async def list_api_routes(request: Request):
    """List all available API routes for debugging"""
    is_api = is_api_request(request)
    logger.info(f"API routes endpoint called, is_api_request: {is_api}")
    
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

@app.get("/test-chat")
async def test_chat_endpoint(request: Request):
    """Test if the chat endpoint is properly registered"""
    is_api = is_api_request(request)
    logger.info(f"Test chat endpoint called, is_api_request: {is_api}")
    
    try:
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

@app.get("/diagnostic/selenium")
async def test_selenium(request: Request):
    """Test if Selenium is working properly"""
    is_api = is_api_request(request)
    logger.info(f"Selenium test endpoint called, is_api_request: {is_api}")
    
    try:
        from selenium import webdriver
        from selenium.webdriver.chrome.service import Service
        from selenium.webdriver.chrome.options import Options
        from webdriver_manager.chrome import ChromeDriverManager
        
        options = Options()
        options.add_argument("--headless=new")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        
        try:
            driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
            driver_info = "ChromeDriverManager worked"
        except Exception as e:
            driver_info = f"ChromeDriverManager failed: {str(e)}"
            driver = webdriver.Chrome(options=options)
        
        driver.get("https://www.google.com")
        title = driver.title
        screenshot_path = os.path.join(screenshots_dir, "selenium_test.png")
        driver.save_screenshot(screenshot_path)
        driver.quit()
        
        return {
            "status": "success",
            "message": "Selenium is working properly",
            "title": title,
            "driver_info": driver_info,
            "screenshot_saved": os.path.exists(screenshot_path),
            "screenshot_path": screenshot_path
        }
    except Exception as e:
        import traceback
        return {
            "status": "error",
            "message": "Selenium test failed",
            "error": str(e),
            "traceback": traceback.format_exc()
        }

@app.get("/diagnostic/book-extraction/{book_id}")
async def test_book_extraction(book_id: str, title: str = "Test Book", request: Request = None):
    """Test book extraction for a specific Google Books ID"""
    if request:
        is_api = is_api_request(request)
        logger.info(f"Book extraction test endpoint called for book_id={book_id}, is_api_request: {is_api}")
    
    if not book_id:
        raise HTTPException(status_code=400, detail="Book ID is required")
    
    try:
        # Initialize extractor
        extractor = BookExtractor(cache_dir=cache_dir)
        
        # Log the Google Books ID we're using
        logger.info(f"Testing extraction for Google Books ID: {book_id}")
        
        # Start extraction using the provided ID (which should be a Google Books ID)
        extracted_text, screenshot_paths = extractor.extract_from_google_books(book_id, title, max_pages=3)
        
        # Format results
        screenshots_info = []
        for path in screenshot_paths:
            if os.path.exists(path):
                size = os.path.getsize(path)
                screenshots_info.append({
                    "path": path,
                    "exists": True,
                    "size_bytes": size,
                    "filename": os.path.basename(path)
                })
            else:
                screenshots_info.append({
                    "path": path,
                    "exists": False
                })
        
        return {
            "status": "success",
            "book_id": book_id,
            "title": title,
            "text_length": len(extracted_text),
            "text_sample": extracted_text[:500] + "..." if len(extracted_text) > 500 else extracted_text,
            "screenshots": screenshots_info,
            "screenshots_count": len(screenshot_paths),
            "cache_dir": cache_dir,
            "screenshots_dir": screenshots_dir
        }
    except Exception as e:
        import traceback
        return {
            "status": "error",
            "message": "Book extraction test failed",
            "book_id": book_id,
            "error": str(e),
            "traceback": traceback.format_exc()
        }

@app.get("/diagnostic/directories")
async def list_directories(request: Request = None):
    """List all relevant directories and their contents"""
    if request:
        is_api = is_api_request(request)
        logger.info(f"Directories endpoint called, is_api_request: {is_api}")
    
    directories = {
        "app_dir": app_dir,
        "uploads_dir": uploads_dir,
        "cache_dir": cache_dir,
        "screenshots_dir": screenshots_dir
    }
    
    directory_contents = {}
    for name, path in directories.items():
        if os.path.exists(path) and os.path.isdir(path):
            try:
                items = os.listdir(path)
                directory_contents[name] = {
                    "exists": True,
                    "path": path,
                    "items_count": len(items),
                    "items": [{
                        "name": item,
                        "type": "Directory" if os.path.isdir(os.path.join(path, item)) else "File",
                        "size_bytes": os.path.getsize(os.path.join(path, item)) if os.path.isfile(os.path.join(path, item)) else None
                    } for item in items[:20]]  # Limit to first 20 items
                }
                if len(items) > 20:
                    directory_contents[name]["note"] = f"Showing first 20 of {len(items)} items"
            except Exception as e:
                directory_contents[name] = {
                    "exists": True,
                    "path": path,
                    "error": str(e)
                }
        else:
            directory_contents[name] = {
                "exists": False,
                "path": path
            }
    
    return {
        "directories": directories,
        "contents": directory_contents
    }

@app.get("/diagnostic/books")
async def list_books(request: Request = None):
    """List all books in the database"""
    if request:
        is_api = is_api_request(request)
        logger.info(f"Books endpoint called, is_api_request: {is_api}")
    
    try:
        book_db = BookDatabase()
        books = book_db.get_books()
        
        # Format the response
        book_info = []
        for book in books:
            chunks_count = 0
            try:
                chunks = book_db.get_chunks_by_book_id(book.get('id'))
                chunks_count = len(chunks)
            except Exception as e:
                pass
                
            book_info.append({
                "id": book.get('id'),
                "title": book.get('title'),
                "author": book.get('author'),
                "chunks_count": chunks_count,
                "has_file": bool(book.get('file_url'))
            })
        
        return {
            "status": "success",
            "books_count": len(books),
            "books": book_info
        }
    except Exception as e:
        import traceback
        return {
            "status": "error",
            "message": "Failed to list books",
            "error": str(e),
            "traceback": traceback.format_exc()
        }

@app.post("/api/debug-extract/{book_id}")
async def debug_extract_book(book_id: str, request: Request = None):
    """
    Debug endpoint for book extraction
    """
    if request:
        is_api = is_api_request(request)
        logger.info(f"Debug extraction endpoint called for book_id={book_id}, is_api_request: {is_api}")
    
    return {
        "status": "received",
        "book_id": book_id,
        "message": "Debug extraction request received"
    }
