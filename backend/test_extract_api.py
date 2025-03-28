
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

def test_extract_endpoint(book_id, external_id=None, api_url=None):
    """Test the extract-book endpoint with the given book_id"""
    if not api_url:
        api_url = "http://localhost:8000"  # Default to local development server
    
    # Resolve DNS and test basic connectivity
    hostname = api_url.replace("https://", "").replace("http://", "").split('/')[0]
    if not resolve_hostname(hostname):
        print("❌ DNS resolution failed - check network or hostname")
        return False
        
    if not test_basic_connectivity(hostname):
        print("❌ Basic connectivity failed - check if server is running")
        return False
        
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
    print("Possible causes:")
    print("1. API server is not running")
    print("2. API server is running but not accessible from current network")
    print("3. API server is running but not properly routing API requests")
    print("4. DNS resolution is incorrect")
    print("5. Firewall is blocking requests")
    print("\nSuggested actions:")
    print("1. Check if API server is running")
    print("2. Check server logs for errors")
    print("3. Verify network configuration")
    print("4. Try running API server locally and test again")
    
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
