
import logging
import os
import time
import json
from typing import List, Dict, Optional, Tuple
from PIL import Image
import pytesseract

# Configure logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

try:
    from selenium import webdriver
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.common.by import By
    from selenium.webdriver.common.keys import Keys
    from webdriver_manager.chrome import ChromeDriverManager
    SELENIUM_AVAILABLE = True
except ImportError:
    logger.warning("Selenium or its dependencies not available. OCR extraction will be disabled.")
    SELENIUM_AVAILABLE = False

class BookExtractor:
    """
    Handles extraction of book content from Google Books using Selenium and OCR
    """
    
    def __init__(self, cache_dir: Optional[str] = None):
        """
        Initialize the book extractor
        
        Args:
            cache_dir: Directory to store screenshots and extracted text
        """
        self.cache_dir = cache_dir or os.path.join(os.path.dirname(os.path.dirname(__file__)), "cache")
        os.makedirs(self.cache_dir, exist_ok=True)
        self.selenium_available = SELENIUM_AVAILABLE
    
    def extract_from_google_books(self, book_id: str, title: str, max_pages: int = 20) -> Tuple[str, List[str]]:
        """
        Extract text from Google Books preview using Selenium and OCR
        
        Args:
            book_id: Google Books ID
            title: Book title (for naming files)
            max_pages: Maximum number of pages to extract
            
        Returns:
            Tuple of (combined text, list of screenshot paths)
        """
        if not self.selenium_available:
            logger.error("Selenium is not available. Cannot extract content.")
            return "Selenium is not available for book extraction.", []
        
        logger.info(f"Starting Google Books extraction for book ID: {book_id}, title: {title}")
        
        # Create a directory for this book's screenshots
        sanitized_title = "".join(c if c.isalnum() else "_" for c in title)
        book_screenshot_dir = os.path.join(self.cache_dir, f"book_{book_id}_{sanitized_title}")
        os.makedirs(book_screenshot_dir, exist_ok=True)
        
        extracted_text = ""
        screenshot_paths = []
        
        try:
            # Set up ChromeDriver with headless mode
            options = webdriver.ChromeOptions()
            options.add_argument("--headless")
            options.add_argument("--no-sandbox")
            options.add_argument("--disable-dev-shm-usage")
            
            logger.info("Initializing Chrome WebDriver")
            driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
            
            # Open Google Books Reader
            iframe_url = f"https://www.google.com/books/edition/_/{book_id}?hl=en&gbpv=1"
            logger.info(f"Navigating to Google Books URL: {iframe_url}")
            driver.get(iframe_url)
            
            # Wait for the page to load
            time.sleep(3)
            
            # Check for iframes and switch if found
            iframes = driver.find_elements(By.TAG_NAME, "iframe")
            if iframes:
                logger.info(f"Found {len(iframes)} iframes, switching to first iframe")
                driver.switch_to.frame(iframes[0])
                
                # Scroll multiple times to load content and take screenshots
                body = driver.find_element(By.TAG_NAME, "body")
                
                page_texts = []
                for i in range(max_pages):
                    logger.info(f"Processing page {i+1}/{max_pages}")
                    
                    # Take a screenshot
                    screenshot_path = os.path.join(book_screenshot_dir, f"book_page_{i+1}.png")
                    driver.save_screenshot(screenshot_path)
                    screenshot_paths.append(screenshot_path)
                    logger.info(f"Screenshot saved: {screenshot_path}")
                    
                    # Use OCR (Tesseract) to extract text
                    image = Image.open(screenshot_path)
                    page_text = pytesseract.image_to_string(image)
                    page_texts.append(page_text)
                    logger.info(f"Extracted {len(page_text)} characters of text from page {i+1}")
                    
                    # Scroll down for next screenshot
                    body.send_keys(Keys.PAGE_DOWN)
                    time.sleep(1)  # Wait for content to load
                
                # Combine all extracted text
                extracted_text = "\n\n".join(page_texts)
                
                # Save the combined text to a file
                text_file_path = os.path.join(book_screenshot_dir, "extracted_text.txt")
                with open(text_file_path, "w", encoding="utf-8") as f:
                    f.write(extracted_text)
                logger.info(f"Saved combined text ({len(extracted_text)} chars) to {text_file_path}")
                
                # Create a JSON cache file with metadata and text
                cache_file_path = os.path.join(self.cache_dir, f"book_{book_id}.json")
                cache_data = {
                    "id": book_id,
                    "title": title,
                    "extraction_method": "selenium_ocr",
                    "pages_extracted": len(page_texts),
                    "timestamp": time.time(),
                    "text": extracted_text,
                    "screenshot_dir": book_screenshot_dir
                }
                
                with open(cache_file_path, "w", encoding="utf-8") as f:
                    json.dump(cache_data, f, indent=2)
                logger.info(f"Saved extraction metadata to {cache_file_path}")
                
            else:
                logger.warning("No iframe found on Google Books page")
                extracted_text = "No iframe found on Google Books page. Unable to extract content."
                
        except Exception as e:
            logger.error(f"Error during Google Books extraction: {str(e)}")
            extracted_text = f"Error during extraction: {str(e)}"
        finally:
            driver.quit()
            logger.info("WebDriver closed")
        
        return extracted_text, screenshot_paths
    
    def process_book_to_chunks(self, book_id: str, text: str, title: str, author: str) -> List[Dict]:
        """
        Process extracted book text into chunks for storage
        
        Args:
            book_id: Book ID
            text: Extracted text content
            title: Book title
            author: Book author
            
        Returns:
            List of chunk dictionaries
        """
        if not text or len(text) < 100:
            logger.warning(f"Insufficient text for book {book_id}: {len(text) if text else 0} chars")
            return []
        
        # Simple chunking by paragraph or section breaks
        chunks = []
        chunk_size = 1000  # characters per chunk
        
        # Clean up the text - remove extra whitespace, normalize line breaks
        cleaned_text = " ".join(text.split())
        
        # Split into chunks of approximately chunk_size characters
        for i in range(0, len(cleaned_text), chunk_size):
            chunk_text = cleaned_text[i:i+chunk_size]
            if chunk_text:
                chunks.append({
                    "book_id": book_id,
                    "title": title,
                    "author": author,
                    "chunk_index": i // chunk_size,
                    "text": chunk_text
                })
        
        logger.info(f"Created {len(chunks)} chunks from book {book_id}")
        return chunks
