
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
import logging
import json
from typing import Dict, Any, List

from app.routers import chat, books
from app.services.book_extraction import BookExtractor
from app.database.books import BookDatabase

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Get the absolute path to the app directory
current_file = os.path.abspath(__file__)
app_dir = os.path.dirname(current_file)
base_dir = os.path.dirname(app_dir)

# Create necessary directories with absolute paths
uploads_dir = os.path.join(app_dir, "uploads")
cache_dir = os.path.join(app_dir, "cache")
screenshots_dir = os.path.join(cache_dir, "screenshots")

logger.info(f"Current file: {current_file}")
logger.info(f"App directory: {app_dir}")
logger.info(f"Base directory: {base_dir}")
logger.info(f"Creating uploads directory at: {uploads_dir}")
logger.info(f"Creating cache directory at: {cache_dir}")
logger.info(f"Creating screenshots directory at: {screenshots_dir}")

os.makedirs(uploads_dir, exist_ok=True)
os.makedirs(cache_dir, exist_ok=True)
os.makedirs(screenshots_dir, exist_ok=True)

# Verify directories were created
logger.info(f"Uploads directory exists: {os.path.exists(uploads_dir)}")
logger.info(f"Cache directory exists: {os.path.exists(cache_dir)}")
logger.info(f"Screenshots directory exists: {os.path.exists(screenshots_dir)}")

app = FastAPI(title="BookBodh API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://127.0.0.1:8080"],  # For development; restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(chat.router)
app.include_router(books.router)

@app.get("/")
async def root():
    # Return directory information along with welcome message
    return {
        "message": "BookBodh Backend API",
        "directories": {
            "app_dir": app_dir,
            "uploads_dir": uploads_dir,
            "cache_dir": cache_dir,
            "screenshots_dir": screenshots_dir,
            "uploads_exists": os.path.exists(uploads_dir),
            "cache_exists": os.path.exists(cache_dir),
            "screenshots_exists": os.path.exists(screenshots_dir)
        }
    }

@app.get("/diagnostic/selenium")
async def test_selenium():
    """Test if Selenium is working properly"""
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
async def test_book_extraction(book_id: str, title: str = "Test Book"):
    """Test book extraction for a specific Google Books ID"""
    if not book_id:
        raise HTTPException(status_code=400, detail="Book ID is required")
    
    try:
        # Initialize extractor
        extractor = BookExtractor(cache_dir=cache_dir)
        
        # Start extraction
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
async def list_directories():
    """List all relevant directories and their contents"""
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
async def list_books():
    """List all books in the database"""
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
