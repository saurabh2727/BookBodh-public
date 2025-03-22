
"""
Simple test script to verify the extract-book API endpoint is accessible and working.
Run this script from the backend directory to test the API.
"""
import requests
import json
import sys
import uuid

def test_extract_endpoint(book_id, external_id=None, api_url=None):
    """Test the extract-book endpoint with the given book_id"""
    if not api_url:
        api_url = "http://localhost:8000"  # Default to local development server
    
    # Try both with and without /api prefix
    urls_to_try = [
        f"{api_url}/extract-book/{book_id}",
        f"{api_url}/api/extract-book/{book_id}"
    ]
    
    for url in urls_to_try:
        print(f"Testing endpoint: {url}")
        
        # Prepare request payload
        payload = {
            "book_id": book_id,
            "force": True
        }
        
        if external_id:
            payload["external_id"] = external_id
        
        # Send request
        try:
            response = requests.post(url, json=payload)
            
            print(f"Status code: {response.status_code}")
            print(f"Content type: {response.headers.get('content-type')}")
            
            # Try to parse as JSON
            try:
                json_response = response.json()
                print("Response (JSON):")
                print(json.dumps(json_response, indent=2))
                
                if response.status_code == 200 or response.status_code == 202:
                    print(f"✅ Success: API endpoint {url} is working correctly")
                    return True
            except json.JSONDecodeError:
                # Not JSON, print text
                print("Response (text):")
                print(response.text[:500] + "..." if len(response.text) > 500 else response.text)
                print(f"❌ Error: Response is not valid JSON")
        
        except Exception as e:
            print(f"❌ Error: {str(e)}")
    
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
    api_url = sys.argv[3] if len(sys.argv) > 3 else None
    
    # Run the test
    test_extract_endpoint(book_id, external_id, api_url)
