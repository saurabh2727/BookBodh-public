
"""
Enhanced test script to verify the extract-book API endpoint is accessible and working.
Run this script from the backend directory to test the API.
"""
import requests
import json
import sys
import uuid
import socket
import time
import os

def resolve_hostname(hostname):
    """Attempt to resolve a hostname to verify DNS is working"""
    try:
        print(f"Resolving hostname: {hostname}")
        ip_address = socket.gethostbyname(hostname)
        print(f"Hostname {hostname} resolves to IP: {ip_address}")
        return True
    except socket.gaierror as e:
        print(f"❌ DNS resolution failed for {hostname}: {e}")
        return False

def test_basic_connectivity(hostname):
    """Test basic connectivity to the host"""
    try:
        print(f"Testing basic connectivity to {hostname}")
        response = requests.get(f"https://{hostname}", timeout=10)
        print(f"Basic connectivity test: Status code {response.status_code}")
        return True
    except requests.exceptions.RequestException as e:
        print(f"❌ Basic connectivity failed: {e}")
        return False

def test_api_detection(api_url):
    """Test if the API server is properly detecting API requests"""
    detection_url = f"{api_url}/api/test"
    try:
        print(f"Testing API detection at: {detection_url}")
        response = requests.get(detection_url, timeout=10)
        print(f"Status code: {response.status_code}")
        print(f"Content type: {response.headers.get('content-type')}")
        
        if response.headers.get('content-type') and 'application/json' in response.headers.get('content-type'):
            print("✅ API detection successful - received JSON response")
            try:
                data = response.json()
                print(f"Response data: {json.dumps(data, indent=2)}")
                return True
            except json.JSONDecodeError:
                print("❌ Failed to parse JSON response despite content type")
                print(f"Raw response: {response.text[:500]}")
                return False
        else:
            print("❌ API detection failed - did not receive JSON response")
            print(f"Response preview: {response.text[:500]}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ API detection request failed: {e}")
        return False

def test_express_backend():
    """Test if we're hitting an Express.js backend instead of FastAPI"""
    express_urls = [
        "https://bookbodh.lovable.app/express-api/test",
        "https://bookbodh.lovable.app/node-api/test",
        "https://bookbodh.lovable.app/api-express/test",
    ]
    
    for url in express_urls:
        try:
            print(f"Testing potential Express.js API at: {url}")
            response = requests.get(url, timeout=10)
            if response.status_code != 404 and response.headers.get('content-type') and 'application/json' in response.headers.get('content-type'):
                print("✅ Found potential Express.js API endpoint")
                try:
                    data = response.json()
                    print(f"Response data: {json.dumps(data, indent=2)}")
                    return url.rsplit('/test', 1)[0]  # Return the base URL without /test
                except json.JSONDecodeError:
                    print("❌ Failed to parse JSON response despite content type")
            else:
                print(f"Status code: {response.status_code}, Content type: {response.headers.get('content-type')}")
        except requests.exceptions.RequestException as e:
            print(f"❌ Request failed: {e}")
    
    return None

def check_for_deployment_issues():
    """Check for common deployment issues"""
    # Check if we're running in a Lovable environment or locally
    is_production = os.environ.get("LOVABLE_ENV") == "production"
    is_preview = os.environ.get("LOVABLE_ENV") == "preview"
    
    if is_production or is_preview:
        print("\n===== DEPLOYMENT ENVIRONMENT DETECTED =====")
        print("This is running in a Lovable environment.")
        print("Common issues in this environment:")
        print("1. API routing may require configuration in vercel.json or similar")
        print("2. FastAPI server may not be running alongside the frontend")
        print("3. API URL in the frontend may need to be configured")
        
        # Try to locate vercel.json
        vercel_config_paths = [
            "./vercel.json",
            "../vercel.json",
            "../../vercel.json"
        ]
        
        for path in vercel_config_paths:
            if os.path.exists(path):
                try:
                    with open(path, 'r') as f:
                        config = json.load(f)
                        print(f"\nFound vercel.json at {path}:")
                        print(json.dumps(config, indent=2))
                        
                        # Check for API routes configuration
                        if "routes" in config:
                            has_api_route = any("/api" in route.get("src", "") for route in config["routes"])
                            if not has_api_route:
                                print("⚠️ No API routes found in vercel.json config")
                                print("Consider adding API route rules to correctly route API requests")
                        else:
                            print("⚠️ No routes configuration found in vercel.json")
                except Exception as e:
                    print(f"Error reading vercel.json: {e}")
    else:
        print("\n===== LOCAL ENVIRONMENT DETECTED =====")
        print("This is running in a local environment.")
        print("Common issues in this environment:")
        print("1. FastAPI server may not be running - check if it's started")
        print("2. CORS issues may prevent API access - check FastAPI CORS settings")
        print("3. Network configuration may block connections to the backend")

def get_sample_google_books_ids():
    """Return some sample Google Books IDs for testing"""
    return [
        {"id": "Jrx6EAAAQBAJ", "title": "Atomic Habits"},
        {"id": "_pYkTcVbS6YC", "title": "The Information"},
        {"id": "x5xoDwAAQBAJ", "title": "The Deficit Myth"},
        {"id": "F_5sDwAAQBAJ", "title": "Team of Rivals"}
    ]

def test_extract_endpoint(book_id, external_id=None, api_url=None):
    """Test the extract-book endpoint with the given book_id"""
    if not api_url:
        api_url = "https://bookbodh.lovable.app"  # Default to production server
    
    # Check if there's potentially an Express.js backend
    express_api_url = test_express_backend()
    if express_api_url:
        print(f"\n✅ Found potential Express.js API at: {express_api_url}")
        print("Trying this API endpoint instead...")
        api_url = express_api_url
    
    # Resolve DNS and test basic connectivity
    hostname = api_url.replace("https://", "").replace("http://", "").split('/')[0]
    if not resolve_hostname(hostname):
        print("❌ DNS resolution failed - check network or hostname")
        return False
        
    if not test_basic_connectivity(hostname):
        print("❌ Basic connectivity failed - check if server is running")
        return False
    
    print("\n===== CHECKING DEPLOYMENT ISSUES =====")
    check_for_deployment_issues()
    
    print("\n===== CHECKING API ROUTING =====")    
    if not test_api_detection(api_url):
        print("❌ API detection failed - server might not be properly routing API requests")
        # Try alternate URL structures
        print("Trying alternate URL structures...")
        alternates = [
            f"https://{hostname}/api",
            f"http://{hostname}/api",
            f"https://api.{hostname}",
            f"http://api.{hostname}"
        ]
        for alt_url in alternates:
            print(f"Testing alternate URL: {alt_url}")
            if test_api_detection(alt_url):
                print(f"✅ Found working API URL: {alt_url}")
                api_url = alt_url
                break
        else:
            print("❌ Could not find working API URL")
    
    # Try both with and without /api prefix
    urls_to_try = [
        f"{api_url}/extract-book/{book_id}",
        f"{api_url}/api/extract-book/{book_id}",
        f"{api_url}/api/debug-extract/{book_id}"  # Try our special debug endpoint
    ]
    
    for url in urls_to_try:
        print(f"\nTesting endpoint: {url}")
        
        # Prepare request payload
        payload = {
            "book_id": book_id,
            "force": True
        }
        
        if external_id:
            payload["external_id"] = external_id
        
        # Send request
        try:
            response = requests.post(url, json=payload, timeout=15)
            
            print(f"Status code: {response.status_code}")
            print(f"Content type: {response.headers.get('content-type')}")
            
            # Try to parse as JSON
            try:
                if response.headers.get('content-type') and 'application/json' in response.headers.get('content-type'):
                    json_response = response.json()
                    print("Response (JSON):")
                    print(json.dumps(json_response, indent=2))
                    
                    if response.status_code == 200 or response.status_code == 202:
                        print(f"✅ Success: API endpoint {url} is working correctly")
                        return True
                else:
                    # Not JSON, print text
                    print("Response (text):")
                    print(response.text[:500] + "..." if len(response.text) > 500 else response.text)
                    print(f"❌ Error: Response is not valid JSON")
            except json.JSONDecodeError:
                # Not JSON, print text
                print("Response (text):")
                print(response.text[:500] + "..." if len(response.text) > 500 else response.text)
                print(f"❌ Error: Response is not valid JSON")
        
        except Exception as e:
            print(f"❌ Error: {str(e)}")
    
    print("\n❌ All API endpoints failed")
    print("\n===== DIAGNOSIS =====")
    print("The server is returning HTML instead of JSON for API requests.")
    print("This usually means that API requests are being routed to the frontend application instead of the API server.")
    print("\nPossible solutions:")
    print("1. Check if the backend FastAPI server is running")
    print("2. Verify that your deployment configuration correctly routes API requests")
    print("3. If using Lovable, check that the API server is properly configured")
    print("4. If you are in control of the server, verify that the API routes are properly configured")
    
    print("\n===== WORKAROUND =====")
    print("You can continue to use the application with the following limitations:")
    print("1. Book content extraction won't work automatically")
    print("2. When you add books, they'll be saved but without extracted content")
    print("3. You can still chat about books, but the AI won't have specific knowledge of the book content")
    
    # Print sample Google Books IDs for testing
    print("\n===== SAMPLE GOOGLE BOOKS IDs FOR TESTING =====")
    sample_ids = get_sample_google_books_ids()
    for book in sample_ids:
        print(f"- {book['title']}: {book['id']}")
    
    return False

if __name__ == "__main__":
    # Get book_id from command line or generate a test one
    if len(sys.argv) > 1:
        book_id = sys.argv[1]
    else:
        book_id = str(uuid.uuid4())
        print(f"No book_id provided, using generated ID: {book_id}")
    
    # Get external_id (Google Books ID) from command line if provided
    external_id = sys.argv[2] if len(sys.argv) > 2 else None
    
    # Get API URL from command line if provided
    api_url = sys.argv[3] if len(sys.argv) > 3 else "https://bookbodh.lovable.app"
    
    # Run the test
    test_extract_endpoint(book_id, external_id, api_url)
