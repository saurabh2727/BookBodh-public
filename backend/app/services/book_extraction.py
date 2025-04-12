
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
from selenium.common.exceptions import TimeoutException, NoSuchElementException, WebDriverException, ElementClickInterceptedException
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

    def extract_from_google_books(self, book_id: str, title: str, max_pages: int = 20) -> Tuple[str, List[str]]:
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
            # Set up Chrome options with improved settings for better extraction
            chrome_options = Options()
            chrome_options.add_argument("--headless=new")
            chrome_options.add_argument("--no-sandbox")
            chrome_options.add_argument("--disable-dev-shm-usage")
            chrome_options.add_argument("--disable-gpu")
            chrome_options.add_argument("--window-size=1280,1696")
            chrome_options.add_argument("--disable-web-security")  # Allow cross-origin frames
            chrome_options.add_argument("--disable-features=IsolateOrigins,site-per-process")  # Disable site isolation
            
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
            
            # Navigate to Google Books preview with improved URL
            # Use a URL that maximizes chances of getting a good preview
            preview_url = f"https://www.google.com/books/edition/_/{book_id}?hl=en&gbpv=1&printsec=frontcover"
            logger.info(f"Navigating to improved Google Books preview URL: {preview_url}")
            
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
            
            # Try to maximize the preview size by clicking on expand buttons if available
            try:
                expand_buttons = driver.find_elements(By.CSS_SELECTOR, ".expand-btn, .gb-expand-button")
                if expand_buttons:
                    logger.info(f"Found {len(expand_buttons)} expand buttons, trying to maximize preview")
                    for btn in expand_buttons:
                        if btn.is_displayed() and btn.is_enabled():
                            try:
                                btn.click()
                                time.sleep(1)
                                logger.info("Clicked expand button to maximize preview")
                            except Exception as click_err:
                                logger.warning(f"Error clicking expand button: {click_err}")
                
                # Also try to dismiss any popups or overlays
                dismiss_buttons = driver.find_elements(By.CSS_SELECTOR, ".dismiss-button, .close-button, .gb-dialog-close")
                for btn in dismiss_buttons:
                    if btn.is_displayed():
                        try:
                            btn.click()
                            time.sleep(0.5)
                            logger.info("Dismissed popup/overlay")
                        except Exception as dismiss_err:
                            logger.warning(f"Error dismissing popup: {dismiss_err}")
            except Exception as expand_err:
                logger.warning(f"Error trying to expand preview: {expand_err}")
            
            # Check if preview is available
            try:
                WebDriverWait(driver, 5).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, ".gb-volume-viewer, .gb-book-content"))
                )
                logger.info("Preview viewer found")
                
                # Attempt to handle any intro pages or tutorial overlays
                try:
                    skip_buttons = driver.find_elements(By.CSS_SELECTOR, ".skip-tutorial, .skip-intro, .gb-next-button")
                    for btn in skip_buttons:
                        if btn.is_displayed() and "skip" in btn.text.lower():
                            btn.click()
                            time.sleep(1)
                            logger.info("Skipped tutorial/intro")
                except Exception as skip_err:
                    logger.warning(f"Error skipping tutorial/intro: {skip_err}")
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
                
                # Try to look for the preview in iframes
                try:
                    iframe_elements = driver.find_elements(By.TAG_NAME, "iframe")
                    if iframe_elements:
                        logger.info(f"Found {len(iframe_elements)} iframes, trying to switch context")
                        for idx, iframe in enumerate(iframe_elements):
                            try:
                                iframe_src = iframe.get_attribute("src")
                                logger.info(f"Iframe {idx} source: {iframe_src}")
                                driver.switch_to.frame(iframe)
                                
                                # Take screenshot of iframe content
                                iframe_screenshot = os.path.join(
                                    self.screenshots_dir, 
                                    f"{safe_title}_iframe{idx}_{int(time.time())}.png"
                                )
                                driver.save_screenshot(iframe_screenshot)
                                screenshot_paths.append(iframe_screenshot)
                                
                                # Try to extract text from iframe
                                iframe_content = driver.find_element(By.CSS_SELECTOR, "body").text
                                if iframe_content:
                                    extracted_text += f"Preview content from iframe {idx}:\n{iframe_content}\n\n"
                                    logger.info(f"Extracted {len(iframe_content)} chars from iframe {idx}")
                                
                                # Switch back to main content
                                driver.switch_to.default_content()
                            except Exception as iframe_err:
                                logger.warning(f"Error accessing iframe {idx}: {iframe_err}")
                                driver.switch_to.default_content()
                except Exception as iframe_search_err:
                    logger.warning(f"Error searching for iframes: {iframe_search_err}")
                
                # If still nothing, try other ways to extract content
                if not extracted_text.strip():
                    logger.warning("No content found in standard locations, trying alternative methods")
                    page_source = driver.page_source
                    
                    # Try to extract book data from JSON-LD or other structured data
                    try:
                        json_ld_matches = re.findall(r'<script type="application/ld\+json">(.*?)</script>', page_source, re.DOTALL)
                        for json_data in json_ld_matches:
                            try:
                                data = json.loads(json_data)
                                if isinstance(data, dict):
                                    if "description" in data:
                                        extracted_text += f"Book description: {data['description']}\n\n"
                                    if "author" in data:
                                        author_info = data["author"]
                                        if isinstance(author_info, list):
                                            author_info = author_info[0]
                                        if isinstance(author_info, dict) and "name" in author_info:
                                            extracted_text += f"Author: {author_info['name']}\n\n"
                            except json.JSONDecodeError:
                                pass
                    except Exception as json_err:
                        logger.warning(f"Error extracting JSON-LD data: {json_err}")
                
                # Return what we have
                if extracted_text.strip():
                    return extracted_text, screenshot_paths
                else:
                    # Try an alternative URL format as a last resort
                    alternative_url = f"https://books.google.com/books?id={book_id}&lpg=PP1&dq=preview&pg=PP1&output=embed"
                    logger.info(f"Trying alternative URL: {alternative_url}")
                    driver.get(alternative_url)
                    time.sleep(3)
                    
                    # Take screenshot of alternative page
                    alt_screenshot = os.path.join(
                        self.screenshots_dir, 
                        f"{safe_title}_alternative_{int(time.time())}.png"
                    )
                    driver.save_screenshot(alt_screenshot)
                    screenshot_paths.append(alt_screenshot)
                    
                    # Try to extract any visible text
                    alt_text = driver.find_element(By.CSS_SELECTOR, "body").text
                    if alt_text:
                        extracted_text += f"Alternative preview content:\n{alt_text}\n\n"
                        logger.info(f"Extracted {len(alt_text)} chars from alternative URL")
                    
                    return extracted_text, screenshot_paths
            
            # Extract text from visible pages - Improved page navigation
            page_count = 0
            last_page_text = ""
            consecutive_same_page_count = 0
            page_extraction_success = False
            
            while page_count < max_pages and consecutive_same_page_count < 3:
                try:
                    # Wait for page content to load with increased timeout
                    WebDriverWait(driver, 10).until(
                        EC.presence_of_element_located((By.CSS_SELECTOR, ".gb-page-content, .page-content, .text-layer"))
                    )
                    
                    # Get page content with improved selectors
                    page_elements = driver.find_elements(By.CSS_SELECTOR, ".gb-page-content, .page-content, .text-layer, .pdf-text-layer")
                    
                    if not page_elements:
                        logger.warning(f"No page content found using standard selectors, trying alternative selectors")
                        # Try alternative selection methods
                        page_elements = driver.find_elements(By.CSS_SELECTOR, "[role='document'], .page, .gb-page")
                        
                        # If still no elements, try generic paragraph elements
                        if not page_elements:
                            logger.warning("No page container elements found, trying to capture all text")
                            page_elements = driver.find_elements(By.CSS_SELECTOR, "p, div.text, .content")
                    
                    # Extract text from all page elements
                    current_page_text = ""
                    
                    for element in page_elements:
                        try:
                            element_text = element.text.strip()
                            if element_text:
                                current_page_text += element_text + "\n"
                        except Exception as element_err:
                            logger.warning(f"Error extracting text from element: {element_err}")
                    
                    # If we still have no text, try to extract text from the entire visible area
                    if not current_page_text.strip():
                        logger.warning("No text extracted from page elements, trying body")
                        try:
                            body_text = driver.find_element(By.TAG_NAME, "body").text
                            
                            # Filter out UI elements and menus
                            ui_patterns = ["search", "upload", "sign in", "sign out", "menu", "page", "of", "next", "previous", "loading"]
                            lines = body_text.split("\n")
                            filtered_lines = [line for line in lines if all(pattern not in line.lower() for pattern in ui_patterns) and len(line) > 10]
                            
                            current_page_text = "\n".join(filtered_lines)
                            logger.info(f"Extracted {len(current_page_text)} chars from body after filtering")
                        except Exception as body_err:
                            logger.warning(f"Error extracting text from body: {body_err}")
                    
                    # Check if we're seeing the same page (stuck)
                    if current_page_text.strip() == last_page_text.strip():
                        consecutive_same_page_count += 1
                        logger.warning(f"Same text detected on consecutive pages: {consecutive_same_page_count} times")
                        
                        if consecutive_same_page_count >= 3:
                            logger.warning(f"Stuck at page {page_count}, may have reached end of preview")
                            break
                    else:
                        consecutive_same_page_count = 0
                        last_page_text = current_page_text
                        page_extraction_success = True
                    
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
                    
                    # Click next page button with improved reliability
                    next_buttons = driver.find_elements(By.CSS_SELECTOR, ".gb-next-button, .next-button, [aria-label='Next page']")
                    next_clicked = False
                    
                    for next_button in next_buttons:
                        if next_button.is_displayed():
                            try:
                                # Check if button is disabled
                                disabled = next_button.get_attribute("disabled") or next_button.get_attribute("aria-disabled") == "true"
                                if disabled:
                                    logger.info("Next button is disabled, reached end of preview")
                                    break
                                
                                # Try JavaScript click which might bypass overlay issues
                                driver.execute_script("arguments[0].click();", next_button)
                                next_clicked = True
                                logger.info("Clicked next page button using JavaScript")
                                break
                            except ElementClickInterceptedException:
                                # If intercepted, try to dismiss any overlays
                                try:
                                    driver.execute_script("""
                                        var overlays = document.querySelectorAll('.overlay, .modal, .popup, .dialog');
                                        overlays.forEach(function(overlay) {
                                            overlay.style.display = 'none';
                                        });
                                    """)
                                    # Try again
                                    driver.execute_script("arguments[0].click();", next_button)
                                    next_clicked = True
                                    logger.info("Clicked next page button after removing overlays")
                                    break
                                except Exception as overlay_err:
                                    logger.warning(f"Error handling overlay: {overlay_err}")
                            except Exception as click_err:
                                logger.warning(f"Error clicking next button: {click_err}")
                    
                    # If we didn't click next, try keyboard navigation
                    if not next_clicked:
                        try:
                            # Try arrow right key
                            webdriver.ActionChains(driver).send_keys(webdriver.Keys.ARROW_RIGHT).perform()
                            next_clicked = True
                            logger.info("Used right arrow key for navigation")
                        except Exception as key_err:
                            logger.warning(f"Error using keyboard navigation: {key_err}")
                    
                    # If still no next action, we might be at the end
                    if not next_clicked:
                        logger.info("Could not navigate to next page, may have reached end of preview")
                        break
                    
                    # Wait for page transition
                    time.sleep(2)
                    
                    page_count += 1
                    
                except NoSuchElementException as e:
                    logger.warning(f"Element not found on page {page_count+1}: {str(e)}")
                    break
                except Exception as e:
                    logger.error(f"Error extracting page {page_count+1}: {str(e)}")
                    break
            
            logger.info(f"Extraction completed. Processed {page_count} pages, extracted {len(extracted_text)} chars")
            
            # Enhanced metadata extraction
            if not page_extraction_success or not extracted_text.strip():
                logger.warning("No page content extracted or extraction unsuccessful, enhancing metadata collection")
                
                try:
                    # Try to get book info
                    info_elements = driver.find_elements(By.CSS_SELECTOR, ".gb-volume-info, .book-info, .about-this-book")
                    for element in info_elements:
                        extracted_text += f"Book Info: {element.text}\n\n"
                
                    # Try to get publisher info
                    publisher_elements = driver.find_elements(By.CSS_SELECTOR, ".publisher, .publication-info")
                    for element in publisher_elements:
                        extracted_text += f"Publisher Info: {element.text}\n\n"
                    
                    # Try to get table of contents
                    toc_elements = driver.find_elements(By.CSS_SELECTOR, ".table-of-contents, .toc, .contents")
                    for element in toc_elements:
                        extracted_text += f"Table of Contents: {element.text}\n\n"
                        
                    # Try to get reviews
                    review_elements = driver.find_elements(By.CSS_SELECTOR, ".reviews, .user-reviews, .editorial-reviews")
                    for element in review_elements:
                        extracted_text += f"Reviews: {element.text}\n\n"
                except Exception as meta_err:
                    logger.error(f"Error getting book metadata: {meta_err}")
            
            # Try one more fallback for books with very restricted previews
            if len(extracted_text.strip()) < 200:
                logger.warning("Very little content extracted, trying fallback methods")
                
                try:
                    # Navigate to the book's info page which might have more accessible content
                    info_url = f"https://books.google.com/books?id={book_id}&hl=en"
                    logger.info(f"Navigating to book info page: {info_url}")
                    driver.get(info_url)
                    time.sleep(3)
                    
                    # Take screenshot
                    info_screenshot = os.path.join(
                        self.screenshots_dir, 
                        f"{safe_title}_info_page_{int(time.time())}.png"
                    )
                    driver.save_screenshot(info_screenshot)
                    screenshot_paths.append(info_screenshot)
                    
                    # Extract as much info as possible
                    body_text = driver.find_element(By.TAG_NAME, "body").text
                    
                    # Filter out common UI elements
                    ui_patterns = ["search", "upload", "sign in", "sign out", "menu", "page", "of", "next", "previous", "loading"]
                    lines = body_text.split("\n")
                    filtered_lines = [line for line in lines if all(pattern not in line.lower() for pattern in ui_patterns) and len(line) > 10]
                    
                    fallback_text = "\n".join(filtered_lines)
                    extracted_text += f"\nBook Information Page Content:\n{fallback_text}\n"
                    logger.info(f"Extracted {len(fallback_text)} chars from info page")
                    
                except Exception as fallback_err:
                    logger.error(f"Error in fallback extraction: {fallback_err}")
            
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
        
        # Clean the text to ensure consistent formatting and remove problematic characters
        cleaned_text = self._clean_text(text)
        
        # Process text into chunks with improved splitting logic to maintain context
        paragraphs = self._split_into_paragraphs(cleaned_text)
        current_chunk = ""
        current_index = 0
        
        for paragraph in paragraphs:
            # If this paragraph would make the chunk too large, save the current chunk and start a new one
            if len(current_chunk) + len(paragraph) > chunk_size and current_chunk:
                # Create summary from first part of chunk
                summary = current_chunk[:200] + "..." if len(current_chunk) > 200 else current_chunk
                
                chunks.append({
                    "book_id": book_id,
                    "chunk_index": current_index,
                    "text": current_chunk,
                    "title": title,
                    "author": author,
                    "summary": summary
                })
                
                current_index += 1
                # Start a new chunk with potential overlap for context preservation
                overlap_size = min(200, len(current_chunk))
                current_chunk = current_chunk[-overlap_size:] if overlap_size > 0 else ""
                current_chunk += paragraph
            else:
                current_chunk += paragraph
        
        # Don't forget the last chunk if not empty
        if current_chunk.strip():
            summary = current_chunk[:200] + "..." if len(current_chunk) > 200 else current_chunk
            
            chunks.append({
                "book_id": book_id,
                "chunk_index": current_index,
                "text": current_chunk,
                "title": title,
                "author": author,
                "summary": summary
            })
        
        logger.info(f"Created {len(chunks)} chunks for book {book_id}")
        return chunks
    
    def _clean_text(self, text: str) -> str:
        """Clean text to ensure consistent formatting and remove problematic characters"""
        if not text:
            return ""
        
        # Replace multiple newlines with a single newline
        cleaned = re.sub(r'\n{3,}', '\n\n', text)
        
        # Replace multiple spaces with a single space
        cleaned = re.sub(r' {2,}', ' ', cleaned)
        
        # Replace problematic Unicode characters
        cleaned = cleaned.replace('\u2028', '\n').replace('\u2029', '\n\n')
        
        # Remove ASCII control characters except newlines and tabs
        cleaned = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', cleaned)
        
        return cleaned.strip()
    
    def _split_into_paragraphs(self, text: str) -> List[str]:
        """Split text into paragraphs while preserving meaningful breaks"""
        if not text:
            return []
        
        # Split on paragraph breaks
        paragraphs = re.split(r'\n{2,}', text)
        
        # Process each paragraph to ensure they end with newlines
        processed_paragraphs = []
        for p in paragraphs:
            if p.strip():
                processed_paragraphs.append(p.strip() + "\n\n")
        
        return processed_paragraphs
