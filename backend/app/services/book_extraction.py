import logging
import os
import time
import json
from typing import List, Dict, Optional, Tuple
from PIL import Image
import pytesseract
import datetime

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
        # Get absolute paths for app directory
        current_file = os.path.abspath(__file__)
        services_dir = os.path.dirname(current_file)
        app_dir = os.path.dirname(services_dir)
        
        logger.info(f"Initializing BookExtractor")
        logger.info(f"Current file path: {current_file}")
        logger.info(f"Services directory: {services_dir}")
        logger.info(f"App directory: {app_dir}")
        
        # Set default cache directory if none provided
        if cache_dir is None:
            cache_dir = os.path.join(app_dir, "cache")
        
        # Create cache directory structure using absolute paths
        self.cache_dir = os.path.abspath(cache_dir)
        logger.info(f"Creating cache directory at: {self.cache_dir}")
        
        try:
            os.makedirs(self.cache_dir, exist_ok=True)
            logger.info(f"Cache directory created/exists: {os.path.exists(self.cache_dir)}")
        except Exception as e:
            logger.error(f"Error creating cache directory: {str(e)}")
        
        # Create a dedicated screenshots directory
        self.screenshots_dir = os.path.join(self.cache_dir, "screenshots")
        logger.info(f"Creating screenshots directory at: {self.screenshots_dir}")
        
        try:
            os.makedirs(self.screenshots_dir, exist_ok=True)
            logger.info(f"Screenshots directory created/exists: {os.path.exists(self.screenshots_dir)}")
        except Exception as e:
            logger.error(f"Error creating screenshots directory: {str(e)}")
        
        # List all directories and files in the app directory to help debug
        logger.info("Listing contents of app directory:")
        try:
            for item in os.listdir(app_dir):
                item_path = os.path.join(app_dir, item)
                item_type = "Directory" if os.path.isdir(item_path) else "File"
                logger.info(f"  - {item_type}: {item}")
        except Exception as e:
            logger.error(f"Error listing app directory contents: {str(e)}")
        
        # List contents of cache directory if it exists
        if os.path.exists(self.cache_dir):
            logger.info(f"Listing contents of cache directory:")
            try:
                for item in os.listdir(self.cache_dir):
                    item_path = os.path.join(self.cache_dir, item)
                    item_type = "Directory" if os.path.isdir(item_path) else "File"
                    logger.info(f"  - {item_type}: {item}")
            except Exception as e:
                logger.error(f"Error listing cache directory contents: {str(e)}")
        
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
        
        # Create a timestamped directory for this extraction run
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        sanitized_title = "".join(c if c.isalnum() else "_" for c in title)
        book_screenshot_dir = os.path.join(self.screenshots_dir, f"{timestamp}_{book_id}_{sanitized_title}")
        os.makedirs(book_screenshot_dir, exist_ok=True)
        
        # Create a log file within the screenshot directory
        log_file_path = os.path.join(book_screenshot_dir, "extraction_log.txt")
        file_handler = logging.FileHandler(log_file_path)
        file_handler.setLevel(logging.DEBUG)
        formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
        
        logger.info(f"Screenshots will be saved to: {book_screenshot_dir}")
        logger.info(f"Log file created at: {log_file_path}")
        
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
            
            # Take a screenshot of the initial page load to verify
            initial_screenshot_path = os.path.join(book_screenshot_dir, "initial_page_load.png")
            driver.save_screenshot(initial_screenshot_path)
            logger.info(f"Initial page load screenshot saved: {initial_screenshot_path}")
            
            # Wait for the page to load
            time.sleep(3)
            
            # Take a screenshot after waiting to verify page is fully loaded
            after_wait_screenshot_path = os.path.join(book_screenshot_dir, "after_wait.png")
            driver.save_screenshot(after_wait_screenshot_path)
            logger.info(f"After wait screenshot saved: {after_wait_screenshot_path}")
            
            # Check page dimensions and log them
            page_width = driver.execute_script("return document.body.scrollWidth")
            page_height = driver.execute_script("return document.body.scrollHeight")
            logger.info(f"Page dimensions: {page_width}x{page_height} pixels")
            
            # Check for iframes and switch if found
            iframes = driver.find_elements(By.TAG_NAME, "iframe")
            logger.info(f"Found {len(iframes)} iframes on the page")
            
            if iframes:
                logger.info(f"Switching to first iframe")
                driver.switch_to.frame(iframes[0])
                
                # Take a screenshot after switching to iframe
                iframe_screenshot_path = os.path.join(book_screenshot_dir, "inside_iframe.png")
                driver.save_screenshot(iframe_screenshot_path)
                logger.info(f"Inside iframe screenshot saved: {iframe_screenshot_path}")
                
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
                    
                    # Check if screenshot is not empty (completely white or black)
                    image = Image.open(screenshot_path)
                    is_blank = self._is_blank_image(image)
                    if is_blank:
                        logger.warning(f"Screenshot {i+1} appears to be blank or empty")
                    
                    # Use OCR (Tesseract) to extract text
                    try:
                        page_text = pytesseract.image_to_string(image)
                        page_text_length = len(page_text.strip())
                        logger.info(f"Extracted {page_text_length} characters of text from page {i+1}")
                        
                        # Log a sample of the extracted text
                        sample_text = page_text[:100] + "..." if len(page_text) > 100 else page_text
                        logger.info(f"Sample text from page {i+1}: {sample_text}")
                        
                        # Save the extracted text to a file for debugging
                        text_file_path = os.path.join(book_screenshot_dir, f"page_{i+1}_text.txt")
                        with open(text_file_path, "w", encoding="utf-8") as f:
                            f.write(page_text)
                        logger.info(f"Saved extracted text to: {text_file_path}")
                        
                        if page_text_length > 0:
                            page_texts.append(page_text)
                        else:
                            logger.warning(f"No text extracted from page {i+1}")
                    except Exception as ocr_error:
                        logger.error(f"OCR error on page {i+1}: {str(ocr_error)}")
                    
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
                dom_structure = driver.execute_script("return document.body.innerHTML")
                dom_file_path = os.path.join(book_screenshot_dir, "dom_structure.html")
                with open(dom_file_path, "w", encoding="utf-8") as f:
                    f.write(dom_structure)
                logger.info(f"Saved DOM structure to: {dom_file_path}")
                
                extracted_text = "No iframe found on Google Books page. Unable to extract content."
                
        except Exception as e:
            logger.error(f"Error during Google Books extraction: {str(e)}", exc_info=True)
            extracted_text = f"Error during extraction: {str(e)}"
        finally:
            try:
                driver.quit()
                logger.info("WebDriver closed")
            except Exception as close_error:
                logger.error(f"Error closing WebDriver: {str(close_error)}")
            
            logger.removeHandler(file_handler)
            file_handler.close()
        
        return extracted_text, screenshot_paths
    
    def _is_blank_image(self, image: Image.Image) -> bool:
        """Check if an image is blank (mostly white or black)"""
        # Convert to grayscale
        gray_image = image.convert('L')
        
        # Get histogram
        histogram = gray_image.histogram()
        
        # Check if most pixels are white (255) or black (0)
        total_pixels = gray_image.width * gray_image.height
        white_pixels = histogram[245:] # Near-white pixels (245-255)
        black_pixels = histogram[:10]  # Near-black pixels (0-9)
        
        white_ratio = sum(white_pixels) / total_pixels
        black_ratio = sum(black_pixels) / total_pixels
        
        # If more than 95% of pixels are white or black, consider it blank
        return white_ratio > 0.95 or black_ratio > 0.95
    
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
        
        # Save the chunks to a chunks file for debugging
        chunks_file_path = os.path.join(self.cache_dir, f"book_{book_id}_chunks.json")
        with open(chunks_file_path, "w", encoding="utf-8") as f:
            json.dump(chunks, f, indent=2)
        logger.info(f"Saved chunks data to {chunks_file_path}")
        
        return chunks
