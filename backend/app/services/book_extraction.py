import os
import time
import logging
import re
import json
import traceback
from typing import List, Tuple, Dict, Any, Optional
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException, WebDriverException
from webdriver_manager.chrome import ChromeDriverManager

# Configure logger
logger = logging.getLogger(__name__)

class BookExtractor:
    def __init__(self, cache_dir: str = None):
        """
        Initialize the book extractor with cache directory
        
        Args:
            cache_dir: Directory to store cached data and screenshots
        """
        # Set up cache directories
        app_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.cache_dir = cache_dir or os.path.join(app_dir, "cache")
        self.screenshots_dir = os.path.join(self.cache_dir, "screenshots")
        
        # Create directories if they don't exist
        os.makedirs(self.cache_dir, exist_ok=True)
        os.makedirs(self.screenshots_dir, exist_ok=True)
        
        logger.info(f"BookExtractor initialized with cache_dir: {self.cache_dir}")
        logger.info(f"Screenshots will be saved to: {self.screenshots_dir}")

    def get_current_time(self):
        """Return current timestamp in ISO format"""
        return datetime.now().isoformat()

    def extract_from_google_books(self, book_id: str, title: str, max_pages: int = 10) -> Tuple[str, List[str]]:
        """
        Extract book content from Google Books preview
        
        Args:
            book_id: Google Books ID
            title: Book title for naming screenshots
            max_pages: Maximum number of pages to extract
            
        Returns:
            Tuple of (extracted text, list of screenshot paths)
        """
        logger.info(f"Starting extraction for book: {title} (ID: {book_id})")
        
        # Sanitize title for filename
        safe_title = re.sub(r'[^\w\-_\. ]', '_', title)
        safe_title = safe_title[:50]  # Limit length
        
        # Initialize variables
        extracted_text = ""
        screenshot_paths = []
        
        try:
            # Set up Chrome options
            chrome_options = Options()
            chrome_options.add_argument("--headless=new")
            chrome_options.add_argument("--no-sandbox")
            chrome_options.add_argument("--disable-dev-shm-usage")
            chrome_options.add_argument("--disable-gpu")
            chrome_options.add_argument("--window-size=1280,1696")
            
            # Try to use ChromeDriverManager, fall back to system Chrome if it fails
            try:
                logger.info("Initializing Chrome with ChromeDriverManager")
                driver = webdriver.Chrome(
                    service=Service(ChromeDriverManager().install()),
                    options=chrome_options
                )
            except Exception as e:
                logger.warning(f"ChromeDriverManager failed: {str(e)}, falling back to system Chrome")
                driver = webdriver.Chrome(options=chrome_options)
            
            # Navigate to Google Books preview
            preview_url = f"https://www.google.com/books/edition/_/{book_id}?hl=en&gbpv=1"
            logger.info(f"Navigating to Google Books preview: {preview_url}")
            
            driver.get(preview_url)
            time.sleep(3)  # Wait for page to load
            
            # Take screenshot of initial page
            initial_screenshot_path = os.path.join(
                self.screenshots_dir, 
                f"{safe_title}_initial_{int(time.time())}.png"
            )
            driver.save_screenshot(initial_screenshot_path)
            screenshot_paths.append(initial_screenshot_path)
            logger.info(f"Saved initial screenshot to {initial_screenshot_path}")
            
            # Check if preview is available
            try:
                WebDriverWait(driver, 5).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, ".gb-volume-viewer"))
                )
                logger.info("Preview viewer found")
            except TimeoutException:
                logger.warning("Preview viewer not found, may have limited content")
                
                # Try to get any available content
                try:
                    about_content = driver.find_element(By.CSS_SELECTOR, ".about-the-book").text
                    extracted_text += f"About the book: {about_content}\n\n"
                    logger.info(f"Extracted 'About the book' content: {len(about_content)} chars")
                except NoSuchElementException:
                    logger.warning("No 'About the book' section found")
                
                # Try to get description
                try:
                    description = driver.find_element(By.CSS_SELECTOR, ".description").text
                    extracted_text += f"Description: {description}\n\n"
                    logger.info(f"Extracted description: {len(description)} chars")
                except NoSuchElementException:
                    logger.warning("No description found")
                
                # Return what we have
                return extracted_text, screenshot_paths
            
            # Extract text from visible pages
            page_count = 0
            last_page_text = ""
            
            while page_count < max_pages:
                try:
                    # Wait for page content to load
                    WebDriverWait(driver, 5).until(
                        EC.presence_of_element_located((By.CSS_SELECTOR, ".gb-page-content"))
                    )
                    
                    # Get page content
                    page_elements = driver.find_elements(By.CSS_SELECTOR, ".gb-page-content")
                    
                    if not page_elements:
                        logger.warning(f"No page content found on page {page_count+1}")
                        break
                    
                    # Extract text from all page elements
                    current_page_text = ""
                    for element in page_elements:
                        current_page_text += element.text + "\n"
                    
                    # Check if we're seeing the same page (stuck)
                    if current_page_text.strip() == last_page_text.strip():
                        logger.warning(f"Same text detected on consecutive pages, may be stuck at page {page_count}")
                        break
                    
                    last_page_text = current_page_text
                    
                    # Add to extracted text
                    if current_page_text.strip():
                        extracted_text += f"--- Page {page_count+1} ---\n{current_page_text}\n\n"
                        logger.info(f"Extracted page {page_count+1}: {len(current_page_text)} chars")
                    
                    # Take screenshot
                    screenshot_path = os.path.join(
                        self.screenshots_dir, 
                        f"{safe_title}_page{page_count+1}_{int(time.time())}.png"
                    )
                    driver.save_screenshot(screenshot_path)
                    screenshot_paths.append(screenshot_path)
                    logger.info(f"Saved screenshot of page {page_count+1} to {screenshot_path}")
                    
                    # Click next page button
                    next_button = driver.find_element(By.CSS_SELECTOR, ".gb-next-button")
                    if not next_button.is_enabled():
                        logger.info("Next button is disabled, reached end of preview")
                        break
                    
                    next_button.click()
                    time.sleep(2)  # Wait for page transition
                    
                    page_count += 1
                    
                except NoSuchElementException as e:
                    logger.warning(f"Element not found on page {page_count+1}: {str(e)}")
                    break
                except Exception as e:
                    logger.error(f"Error extracting page {page_count+1}: {str(e)}")
                    break
            
            logger.info(f"Extraction completed. Processed {page_count} pages, extracted {len(extracted_text)} chars")
            
            # If we didn't get any content, try to get metadata
            if not extracted_text.strip():
                logger.warning("No page content extracted, trying to get metadata")
                
                try:
                    # Try to get book info
                    info_elements = driver.find_elements(By.CSS_SELECTOR, ".gb-volume-info")
                    for element in info_elements:
                        extracted_text += f"Book Info: {element.text}\n\n"
                except Exception as e:
                    logger.error(f"Error getting book info: {str(e)}")
            
            return extracted_text, screenshot_paths
            
        except WebDriverException as e:
            logger.error(f"WebDriver error: {str(e)}")
            return f"Error extracting content: {str(e)}", screenshot_paths
        except Exception as e:
            logger.error(f"Unexpected error in extract_from_google_books: {str(e)}")
            logger.error(traceback.format_exc())
            return f"Error: {str(e)}", screenshot_paths
        finally:
            try:
                if 'driver' in locals():
                    driver.quit()
                    logger.info("WebDriver closed")
            except Exception as e:
                logger.error(f"Error closing WebDriver: {str(e)}")

    def process_book_to_chunks(
        self, 
        book_id: str, 
        text: str, 
        title: str, 
        author: str, 
        chunk_size: int = 1000
    ) -> List[Dict[str, Any]]:
        """
        Process book text into chunks for database storage
        
        Args:
            book_id: Book ID in the database
            text: Full text to process
            title: Book title
            author: Book author
            chunk_size: Size of each chunk in characters
            
        Returns:
            List of chunk dictionaries
        """
        logger.info(f"Processing book text into chunks: {len(text)} chars, chunk size: {chunk_size}")
        
        chunks = []
        
        # If text is empty, create a placeholder chunk
        if not text.strip():
            logger.warning("Empty text provided, creating placeholder chunk")
            chunks.append({
                "book_id": book_id,
                "chunk_index": 0,
                "text": "No preview text available for this book.",
                "title": title,
                "author": author,
                "summary": "No preview available"
            })
            return chunks
        
        # Process text into chunks
        for i in range(0, len(text), chunk_size):
            chunk_text = text[i:i+chunk_size]
            chunk_index = i // chunk_size
            
            # Create summary from first part of chunk
            summary = chunk_text[:200] + "..." if len(chunk_text) > 200 else chunk_text
            
            chunks.append({
                "book_id": book_id,
                "chunk_index": chunk_index,
                "text": chunk_text,
                "title": title,
                "author": author,
                "summary": summary
            })
        
        logger.info(f"Created {len(chunks)} chunks for book {book_id}")
        return chunks
