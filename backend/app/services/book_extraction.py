
import logging
import os
import time
import json
from typing import List, Dict, Optional, Tuple
from PIL import Image
import pytesseract
import datetime
import traceback

# Configure logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

try:
    from selenium import webdriver
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.common.by import By
    from selenium.webdriver.common.keys import Keys
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from webdriver_manager.chrome import ChromeDriverManager
    SELENIUM_AVAILABLE = True
    logger.info("Selenium and all dependencies are available")
except ImportError as e:
    logger.warning(f"Selenium or its dependencies not available: {str(e)}")
    logger.warning(traceback.format_exc())
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
            # Use an absolute path that will definitely be writable
            cache_dir = os.path.join(app_dir, "cache")
        
        # Ensure cache directory is absolute
        self.cache_dir = os.path.abspath(cache_dir)
        logger.info(f"Using cache directory at: {self.cache_dir}")
        
        # Create cache directory with verbose logging
        try:
            if not os.path.exists(self.cache_dir):
                logger.info(f"Creating cache directory: {self.cache_dir}")
                os.makedirs(self.cache_dir, exist_ok=True)
                logger.info(f"Cache directory created: {os.path.exists(self.cache_dir)}")
            else:
                logger.info(f"Cache directory already exists: {self.cache_dir}")
                
            # Check write permissions
            test_file_path = os.path.join(self.cache_dir, "test_write.txt")
            try:
                with open(test_file_path, "w") as f:
                    f.write("Test write")
                os.remove(test_file_path)
                logger.info(f"Cache directory is writable")
            except Exception as e:
                logger.error(f"Cache directory is not writable: {str(e)}")
                # Try to use a temp directory as fallback
                temp_dir = os.path.join(os.path.dirname(app_dir), "tmp")
                logger.info(f"Trying fallback temp directory: {temp_dir}")
                os.makedirs(temp_dir, exist_ok=True)
                self.cache_dir = temp_dir
        except Exception as e:
            logger.error(f"Error creating cache directory: {str(e)}")
            logger.error(traceback.format_exc())
            # Use a fallback directory in /tmp
            self.cache_dir = os.path.join("/tmp", "bookbodh_cache")
            logger.info(f"Using fallback cache directory: {self.cache_dir}")
            os.makedirs(self.cache_dir, exist_ok=True)
        
        # Create a dedicated screenshots directory
        self.screenshots_dir = os.path.join(self.cache_dir, "screenshots")
        logger.info(f"Creating screenshots directory at: {self.screenshots_dir}")
        
        try:
            if not os.path.exists(self.screenshots_dir):
                os.makedirs(self.screenshots_dir, exist_ok=True)
                logger.info(f"Screenshots directory created: {os.path.exists(self.screenshots_dir)}")
            else:
                logger.info(f"Screenshots directory already exists: {self.screenshots_dir}")
                
            # Check if screenshots directory is writable
            test_file_path = os.path.join(self.screenshots_dir, "test_screenshot.txt")
            try:
                with open(test_file_path, "w") as f:
                    f.write("Test screenshot")
                os.remove(test_file_path)
                logger.info(f"Screenshots directory is writable")
            except Exception as e:
                logger.error(f"Screenshots directory is not writable: {str(e)}")
        except Exception as e:
            logger.error(f"Error creating screenshots directory: {str(e)}")
            logger.error(traceback.format_exc())
            # Use a fallback directory in /tmp
            self.screenshots_dir = os.path.join("/tmp", "bookbodh_screenshots")
            logger.info(f"Using fallback screenshots directory: {self.screenshots_dir}")
            os.makedirs(self.screenshots_dir, exist_ok=True)
        
        # List contents of cache directory to verify setup
        logger.info(f"Listing contents of cache directory:")
        try:
            for item in os.listdir(self.cache_dir):
                item_path = os.path.join(self.cache_dir, item)
                item_type = "Directory" if os.path.isdir(item_path) else "File"
                logger.info(f"  - {item_type}: {item}")
        except Exception as e:
            logger.error(f"Error listing cache directory contents: {str(e)}")
        
        self.selenium_available = SELENIUM_AVAILABLE
        logger.info(f"Selenium available: {self.selenium_available}")
    
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
        
        logger.info(f"Starting Google Books extraction for book ID: '{book_id}', title: '{title}'")
        
        # Create a timestamped directory for this extraction run
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        sanitized_title = "".join(c if c.isalnum() else "_" for c in title)
        book_screenshot_dir = os.path.join(self.screenshots_dir, f"{timestamp}_{book_id}_{sanitized_title}")
        
        logger.info(f"Creating book screenshot directory at: {book_screenshot_dir}")
        try:
            # Make sure parent directories exist first
            os.makedirs(os.path.dirname(book_screenshot_dir), exist_ok=True)
            # Then create the book screenshot directory
            os.makedirs(book_screenshot_dir, exist_ok=True)
            logger.info(f"Book screenshot directory created: {os.path.exists(book_screenshot_dir)}")
            
            # Verify the directory is writable
            test_file_path = os.path.join(book_screenshot_dir, "test_write.txt")
            with open(test_file_path, "w") as f:
                f.write("Test write")
            os.remove(test_file_path)
            logger.info(f"Book screenshot directory is writable")
        except Exception as e:
            logger.error(f"Error creating book screenshot directory: {str(e)}")
            logger.error(traceback.format_exc())
            # Use a fallback directory in /tmp with timestamp to avoid conflicts
            fallback_dir = os.path.join("/tmp", f"bookbodh_{timestamp}_{book_id}")
            logger.info(f"Using fallback book screenshot directory: {fallback_dir}")
            os.makedirs(fallback_dir, exist_ok=True)
            book_screenshot_dir = fallback_dir
        
        # Create a log file within the screenshot directory
        log_file_path = os.path.join(book_screenshot_dir, "extraction_log.txt")
        try:
            file_handler = logging.FileHandler(log_file_path)
            file_handler.setLevel(logging.DEBUG)
            formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
            file_handler.setFormatter(formatter)
            logger.addHandler(file_handler)
            logger.info(f"Log file created at: {log_file_path}")
        except Exception as e:
            logger.error(f"Failed to create log file: {str(e)}")
            file_handler = None
        
        logger.info(f"Screenshots will be saved to: {book_screenshot_dir}")
        
        extracted_text = ""
        screenshot_paths = []
        driver = None
        
        try:
            # Set up ChromeDriver with headless mode
            options = webdriver.ChromeOptions()
            options.add_argument("--headless=new")  # Updated headless mode syntax
            options.add_argument("--no-sandbox")
            options.add_argument("--disable-dev-shm-usage")
            options.add_argument("--window-size=1280,1696")  # Set explicit window size for better rendering
            options.add_argument("--disable-gpu")  # Helpful for some Linux systems
            options.add_argument("--disable-extensions")
            
            # Add user agent to avoid detection as a bot
            options.add_argument("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36")
            
            logger.info("Initializing Chrome WebDriver with options:")
            for option in options.arguments:
                logger.info(f"  - {option}")
                
            # Try to use the installed ChromeDriver
            try:
                logger.info("Attempting to initialize Chrome WebDriver with ChromeDriverManager")
                driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
                logger.info("Chrome WebDriver initialized successfully with ChromeDriverManager")
            except Exception as driver_error:
                logger.error(f"Error initializing Chrome WebDriver with ChromeDriverManager: {str(driver_error)}")
                logger.error(traceback.format_exc())
                
                # Fallback to default Chrome WebDriver without specifying the path
                try:
                    logger.info("Falling back to default Chrome WebDriver")
                    driver = webdriver.Chrome(options=options)
                    logger.info("Chrome WebDriver initialized successfully with default configuration")
                except Exception as default_driver_error:
                    logger.error(f"Error initializing default Chrome WebDriver: {str(default_driver_error)}")
                    logger.error(traceback.format_exc())
                    return "Failed to initialize Chrome WebDriver.", []
            
            # Debug the WebDriver version
            capabilities = driver.capabilities
            browser_name = capabilities.get('browserName', 'unknown')
            browser_version = capabilities.get('browserVersion', 'unknown')
            driver_info = capabilities.get('chrome', {}).get('chromedriverVersion', 'unknown')
            logger.info(f"WebDriver info - Browser: {browser_name} {browser_version}, Driver: {driver_info}")
            
            # Extract external ID from the book record if available
            external_id = ""
            try:
                # Try to get external_id from database
                from ..database.books import get_book_by_id
                book_data = get_book_by_id(book_id)
                if book_data and book_data.get('external_id'):
                    external_id = book_data['external_id']
                    logger.info(f"Found external_id in database: {external_id}")
                    
                    # If we have an external_id, use it to construct a reliable URL
                    if external_id:
                        iframe_url = f"https://www.google.com/books/edition/_/{external_id}?hl=en&gbpv=1"
                        logger.info(f"Using external_id to construct URL: {iframe_url}")
                    else:
                        # Fallback to using the book_id directly (might be the external ID)
                        iframe_url = f"https://www.google.com/books/edition/_/{book_id}?hl=en&gbpv=1"
                        logger.info(f"Using book_id as external_id in URL: {iframe_url}")
                else:
                    # Fallback to using the book_id directly (might be the external ID)
                    iframe_url = f"https://www.google.com/books/edition/_/{book_id}?hl=en&gbpv=1"
                    logger.info(f"No external_id found, using book_id in URL: {iframe_url}")
            except Exception as db_error:
                logger.error(f"Error retrieving external_id from database: {str(db_error)}")
                logger.error(traceback.format_exc())
                # Fallback to using the book_id directly
                iframe_url = f"https://www.google.com/books/edition/_/{book_id}?hl=en&gbpv=1"
                logger.info(f"Using book_id as fallback due to database error: {iframe_url}")
            
            # Open Google Books Reader with a more reliable URL format
            # Adding book_id check for debugging
            if not book_id or len(book_id) < 4:
                logger.error(f"Invalid book ID: '{book_id}' - Too short or empty")
                return f"Invalid book ID: '{book_id}'", []
                
            logger.info(f"Navigating to Google Books URL: {iframe_url}")
            
            try:
                driver.get(iframe_url)
                logger.info("Navigation to URL completed")
            except Exception as nav_error:
                logger.error(f"Error navigating to URL: {str(nav_error)}")
                logger.error(traceback.format_exc())
                
                # Try an alternative URL format
                if external_id:
                    alt_url = f"https://books.google.com/books?id={external_id}&printsec=frontcover"
                else:
                    alt_url = f"https://books.google.com/books?id={book_id}&printsec=frontcover"
                    
                logger.info(f"Trying alternative URL: {alt_url}")
                driver.get(alt_url)
            
            # Take a screenshot of the initial page load to verify
            initial_screenshot_path = os.path.join(book_screenshot_dir, "initial_page_load.png")
            logger.info(f"Taking initial screenshot: {initial_screenshot_path}")
            try:
                driver.save_screenshot(initial_screenshot_path)
                if os.path.exists(initial_screenshot_path):
                    file_size = os.path.getsize(initial_screenshot_path)
                    logger.info(f"Initial page load screenshot saved: {initial_screenshot_path}, size: {file_size} bytes")
                    screenshot_paths.append(initial_screenshot_path)
                else:
                    logger.error(f"Failed to save initial screenshot: file doesn't exist")
                    
                    # Try a fallback location
                    fallback_path = os.path.join("/tmp", f"initial_page_load_{timestamp}.png")
                    logger.info(f"Trying fallback screenshot location: {fallback_path}")
                    driver.save_screenshot(fallback_path)
                    if os.path.exists(fallback_path):
                        logger.info(f"Screenshot saved to fallback location: {fallback_path}")
                        screenshot_paths.append(fallback_path)
            except Exception as ss_error:
                logger.error(f"Error taking initial screenshot: {str(ss_error)}")
                logger.error(traceback.format_exc())
            
            # Wait for the page to load
            logger.info("Waiting for page to load (3 seconds)")
            time.sleep(3)
            
            # Take a screenshot after waiting to verify page is fully loaded
            after_wait_screenshot_path = os.path.join(book_screenshot_dir, "after_wait.png")
            logger.info(f"Taking after-wait screenshot: {after_wait_screenshot_path}")
            try:
                driver.save_screenshot(after_wait_screenshot_path)
                if os.path.exists(after_wait_screenshot_path):
                    file_size = os.path.getsize(after_wait_screenshot_path)
                    logger.info(f"After wait screenshot saved: {after_wait_screenshot_path}, size: {file_size} bytes")
                    screenshot_paths.append(after_wait_screenshot_path)
                else:
                    logger.error(f"Failed to save after-wait screenshot: file doesn't exist")
            except Exception as ss_error:
                logger.error(f"Error taking after-wait screenshot: {str(ss_error)}")
            
            # Check page dimensions and log them
            try:
                page_width = driver.execute_script("return document.body.scrollWidth")
                page_height = driver.execute_script("return document.body.scrollHeight")
                logger.info(f"Page dimensions: {page_width}x{page_height} pixels")
            except Exception as dim_error:
                logger.error(f"Error getting page dimensions: {str(dim_error)}")
            
            # Check for iframes and switch if found
            try:
                iframes = driver.find_elements(By.TAG_NAME, "iframe")
                logger.info(f"Found {len(iframes)} iframes on the page")
                
                # Log iframe details for debugging
                for i, iframe in enumerate(iframes):
                    try:
                        iframe_id = iframe.get_attribute("id")
                        iframe_class = iframe.get_attribute("class")
                        iframe_src = iframe.get_attribute("src")
                        logger.info(f"Iframe {i}: id='{iframe_id}', class='{iframe_class}', src='{iframe_src}'")
                    except Exception as attr_error:
                        logger.error(f"Error getting iframe {i} attributes: {str(attr_error)}")
                
                # Check for the specific Google Books iframe
                book_iframe = None
                for iframe in iframes:
                    try:
                        src = iframe.get_attribute("src")
                        if src and ("books.google" in src or "googleusercontent" in src):
                            book_iframe = iframe
                            logger.info(f"Found Google Books iframe with src: {src}")
                            break
                    except Exception as iframe_error:
                        logger.error(f"Error checking iframe source: {str(iframe_error)}")
                
                # If we found a specific book iframe, use that; otherwise use the first iframe
                if book_iframe:
                    logger.info(f"Switching to Google Books iframe")
                    driver.switch_to.frame(book_iframe)
                elif iframes:
                    logger.info(f"Switching to first iframe")
                    driver.switch_to.frame(iframes[0])
                else:
                    logger.warning("No iframes found on the page")
                    
                    # Take a screenshot of the main page for debugging
                    main_page_ss_path = os.path.join(book_screenshot_dir, "main_page.png")
                    try:
                        driver.save_screenshot(main_page_ss_path)
                        if os.path.exists(main_page_ss_path):
                            logger.info(f"Main page screenshot saved: {main_page_ss_path}")
                            screenshot_paths.append(main_page_ss_path)
                        else:
                            logger.error(f"Failed to save main page screenshot: file doesn't exist")
                    except Exception as ss_error:
                        logger.error(f"Error taking main page screenshot: {str(ss_error)}")
                    
                    # Try to capture DOM structure
                    try:
                        dom_structure = driver.execute_script("return document.body.innerHTML")
                        dom_file_path = os.path.join(book_screenshot_dir, "dom_structure.html")
                        with open(dom_file_path, "w", encoding="utf-8") as f:
                            f.write(dom_structure)
                        logger.info(f"Saved DOM structure to: {dom_file_path}")
                    except Exception as dom_error:
                        logger.error(f"Error capturing DOM structure: {str(dom_error)}")
                    
                    # Check if we're on a "not found" or error page
                    if "not available for preview" in driver.page_source.lower() or "sorry" in driver.page_source.lower():
                        logger.warning("Book preview not available - detected 'not available' message")
                        return "This book doesn't have a preview available on Google Books.", screenshot_paths
                
                # Take a screenshot after switching to iframe
                iframe_screenshot_path = os.path.join(book_screenshot_dir, "inside_iframe.png")
                try:
                    driver.save_screenshot(iframe_screenshot_path)
                    if os.path.exists(iframe_screenshot_path):
                        logger.info(f"Inside iframe screenshot saved: {iframe_screenshot_path}")
                        screenshot_paths.append(iframe_screenshot_path)
                    else:
                        logger.error(f"Failed to save iframe screenshot: file doesn't exist")
                except Exception as ss_error:
                    logger.error(f"Error taking iframe screenshot: {str(ss_error)}")
                
                # Try to find a better scrollable element
                scroll_element = None
                try:
                    # Try different selectors that might identify the book content area
                    selectors = [
                        "body", 
                        "#viewport", 
                        ".bodyContainer", 
                        "#book-content",
                        ".gb-reader-container",
                        ".gb-reader-view"
                    ]
                    
                    for selector in selectors:
                        elements = driver.find_elements(By.CSS_SELECTOR, selector)
                        if elements:
                            scroll_element = elements[0]
                            logger.info(f"Found scroll element using selector: {selector}")
                            break
                    
                    if not scroll_element:
                        logger.warning("Could not find a specific scroll element, defaulting to body")
                        scroll_element = driver.find_element(By.TAG_NAME, "body")
                except Exception as scroll_error:
                    logger.error(f"Error finding scroll element: {str(scroll_error)}")
                    scroll_element = driver.find_element(By.TAG_NAME, "body")
                
                # Scroll multiple times to load content and take screenshots
                page_texts = []
                for i in range(max_pages):
                    logger.info(f"Processing page {i+1}/{max_pages}")
                    
                    # Wait briefly for any dynamic content to load
                    time.sleep(1)
                    
                    # Take a screenshot
                    screenshot_path = os.path.join(book_screenshot_dir, f"book_page_{i+1}.png")
                    try:
                        driver.save_screenshot(screenshot_path)
                        if os.path.exists(screenshot_path):
                            file_size = os.path.getsize(screenshot_path)
                            logger.info(f"Screenshot {i+1} saved: {screenshot_path}, size: {file_size} bytes")
                            screenshot_paths.append(screenshot_path)
                            
                            # Check if screenshot file exists and report size
                            if os.path.exists(screenshot_path):
                                file_size = os.path.getsize(screenshot_path)
                                logger.info(f"Screenshot file {i+1} exists, size: {file_size} bytes")
                            else:
                                logger.error(f"Screenshot file {i+1} doesn't exist: {screenshot_path}")
                                
                                # Try a fallback location
                                fallback_path = os.path.join("/tmp", f"book_page_{i+1}_{timestamp}.png")
                                logger.info(f"Trying fallback screenshot location: {fallback_path}")
                                driver.save_screenshot(fallback_path)
                                if os.path.exists(fallback_path):
                                    logger.info(f"Screenshot saved to fallback location: {fallback_path}")
                                    screenshot_paths.append(fallback_path)
                                    screenshot_path = fallback_path
                        else:
                            logger.error(f"Screenshot file {i+1} doesn't exist: {screenshot_path}")
                    except Exception as ss_error:
                        logger.error(f"Error taking screenshot {i+1}: {str(ss_error)}")
                    
                    # Check if screenshot is not empty (completely white or black)
                    try:
                        if os.path.exists(screenshot_path):
                            image = Image.open(screenshot_path)
                            is_blank = self._is_blank_image(image)
                            if is_blank:
                                logger.warning(f"Screenshot {i+1} appears to be blank or empty")
                        else:
                            logger.error(f"Cannot check if image is blank - screenshot file {i+1} doesn't exist")
                    except Exception as img_error:
                        logger.error(f"Error checking if image {i+1} is blank: {str(img_error)}")
                    
                    # Use OCR (Tesseract) to extract text
                    try:
                        if os.path.exists(screenshot_path):
                            page_text = pytesseract.image_to_string(screenshot_path)
                            page_text_length = len(page_text.strip())
                            logger.info(f"Extracted {page_text_length} characters of text from page {i+1}")
                            
                            # Log a sample of the extracted text
                            sample_text = page_text[:100] + "..." if len(page_text) > 100 else page_text
                            logger.info(f"Sample text from page {i+1}: {sample_text}")
                            
                            # Save the extracted text to a file for debugging
                            text_file_path = os.path.join(book_screenshot_dir, f"page_{i+1}_text.txt")
                            try:
                                with open(text_file_path, "w", encoding="utf-8") as f:
                                    f.write(page_text)
                                logger.info(f"Saved extracted text to: {text_file_path}")
                            except Exception as txt_write_error:
                                logger.error(f"Error writing text file: {str(txt_write_error)}")
                                
                                # Try fallback location
                                fallback_txt_path = os.path.join("/tmp", f"page_{i+1}_{timestamp}_text.txt")
                                with open(fallback_txt_path, "w", encoding="utf-8") as f:
                                    f.write(page_text)
                                logger.info(f"Saved extracted text to fallback location: {fallback_txt_path}")
                            
                            if page_text_length > 0:
                                page_texts.append(page_text)
                            else:
                                logger.warning(f"No text extracted from page {i+1}")
                        else:
                            logger.error(f"Cannot perform OCR - screenshot file {i+1} doesn't exist")
                    except Exception as ocr_error:
                        logger.error(f"OCR error on page {i+1}: {str(ocr_error)}")
                    
                    # Check if we've reached the end of the preview
                    if "end of this preview" in driver.page_source.lower() or "end of preview" in driver.page_source.lower():
                        logger.info(f"Reached end of preview after page {i+1}")
                        break
                    
                    # Scroll down for next screenshot
                    try:
                        if scroll_element:
                            # First try scrolling the specific element
                            driver.execute_script("arguments[0].scrollBy(0, 500);", scroll_element)
                        else:
                            # Fall back to sending PAGE_DOWN
                            scroll_element = driver.find_element(By.TAG_NAME, "body")
                            scroll_element.send_keys(Keys.PAGE_DOWN)
                        
                        logger.info(f"Scrolled down for next page")
                    except Exception as scroll_error:
                        logger.error(f"Error scrolling: {str(scroll_error)}")
                        # Try an alternative scrolling method
                        try:
                            driver.execute_script("window.scrollBy(0, 500);")
                            logger.info("Used window.scrollBy as fallback")
                        except Exception as alt_scroll_error:
                            logger.error(f"Alternative scrolling also failed: {str(alt_scroll_error)}")
                    
                    time.sleep(1)  # Wait for content to load
                
                # Combine all extracted text
                extracted_text = "\n\n".join(page_texts)
                
                # Save the combined text to a file
                text_file_path = os.path.join(book_screenshot_dir, "extracted_text.txt")
                try:
                    with open(text_file_path, "w", encoding="utf-8") as f:
                        f.write(extracted_text)
                    logger.info(f"Saved combined text ({len(extracted_text)} chars) to {text_file_path}")
                except Exception as txt_write_error:
                    logger.error(f"Error writing combined text file: {str(txt_write_error)}")
                    
                    # Try fallback location
                    fallback_txt_path = os.path.join("/tmp", f"extracted_text_{timestamp}.txt")
                    with open(fallback_txt_path, "w", encoding="utf-8") as f:
                        f.write(extracted_text)
                    logger.info(f"Saved combined text to fallback location: {fallback_txt_path}")
                
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
                
                try:
                    with open(cache_file_path, "w", encoding="utf-8") as f:
                        json.dump(cache_data, f, indent=2)
                    logger.info(f"Saved extraction metadata to {cache_file_path}")
                except Exception as json_write_error:
                    logger.error(f"Error writing cache JSON: {str(json_write_error)}")
                    
                    # Try fallback location
                    fallback_json_path = os.path.join("/tmp", f"book_{book_id}_{timestamp}.json")
                    with open(fallback_json_path, "w", encoding="utf-8") as f:
                        json.dump(cache_data, f, indent=2)
                    logger.info(f"Saved extraction metadata to fallback location: {fallback_json_path}")
                
            except Exception as iframe_error:
                logger.error(f"Error processing iframe: {str(iframe_error)}")
                logger.error(traceback.format_exc())
                
                # Try to take a screenshot of the current state for debugging
                error_screenshot_path = os.path.join(book_screenshot_dir, "error_state.png")
                try:
                    driver.save_screenshot(error_screenshot_path)
                    logger.info(f"Error state screenshot saved: {error_screenshot_path}")
                    screenshot_paths.append(error_screenshot_path)
                except Exception as ss_error:
                    logger.error(f"Error taking error state screenshot: {str(ss_error)}")
                
                dom_structure = driver.execute_script("return document.body.innerHTML")
                dom_file_path = os.path.join(book_screenshot_dir, "dom_structure.html")
                try:
                    with open(dom_file_path, "w", encoding="utf-8") as f:
                        f.write(dom_structure)
                    logger.info(f"Saved DOM structure to: {dom_file_path}")
                except Exception as dom_write_error:
                    logger.error(f"Error writing DOM structure: {str(dom_write_error)}")
                    
                    # Try fallback location
                    fallback_dom_path = os.path.join("/tmp", f"dom_structure_{timestamp}.html")
                    with open(fallback_dom_path, "w", encoding="utf-8") as f:
                        f.write(dom_structure)
                    logger.info(f"Saved DOM structure to fallback location: {fallback_dom_path}")
                
                extracted_text = "Error processing Google Books page. See logs for details."
                
        except Exception as e:
            logger.error(f"Error during Google Books extraction: {str(e)}")
            logger.error(traceback.format_exc())
            extracted_text = f"Error during extraction: {str(e)}"
        finally:
            try:
                if driver:
                    driver.quit()
                    logger.info("WebDriver closed")
            except Exception as close_error:
                logger.error(f"Error closing WebDriver: {str(close_error)}")
            
            if file_handler:
                logger.removeHandler(file_handler)
                file_handler.close()
        
        # Save final status
        status_file_path = os.path.join(book_screenshot_dir, "extraction_status.json")
        status_data = {
            "completed": True,
            "timestamp": time.time(),
            "screenshot_count": len(screenshot_paths),
            "extracted_text_length": len(extracted_text),
            "book_id": book_id,
            "title": title
        }
        try:
            with open(status_file_path, "w", encoding="utf-8") as f:
                json.dump(status_data, f, indent=2)
            logger.info(f"Saved extraction status to {status_file_path}")
        except Exception as status_error:
            logger.error(f"Error saving status file: {str(status_error)}")
            
            # Try fallback location
            fallback_status_path = os.path.join("/tmp", f"extraction_status_{timestamp}.json")
            with open(fallback_status_path, "w", encoding="utf-8") as f:
                json.dump(status_data, f, indent=2)
            logger.info(f"Saved extraction status to fallback location: {fallback_status_path}")
        
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
        try:
            with open(chunks_file_path, "w", encoding="utf-8") as f:
                json.dump(chunks, f, indent=2)
            logger.info(f"Saved chunks data to {chunks_file_path}")
        except Exception as chunks_write_error:
            logger.error(f"Error writing chunks file: {str(chunks_write_error)}")
            
            # Try fallback location
            fallback_chunks_path = os.path.join("/tmp", f"book_{book_id}_chunks.json")
            with open(fallback_chunks_path, "w", encoding="utf-8") as f:
                json.dump(chunks, f, indent=2)
            logger.info(f"Saved chunks data to fallback location: {fallback_chunks_path}")
        
        return chunks
