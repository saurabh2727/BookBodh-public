
import logging
import os
from fastapi import APIRouter, Request, HTTPException
from app.utils.request_helpers import is_api_request
from app.config.settings import settings

# Configure logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])

@router.get("/health")
async def health_check(request: Request):
    """
    Health check endpoint for monitoring and diagnostics
    """
    try:
        # Enhanced logging for health check
        is_api = is_api_request(request)
        logger.info(f"Health check endpoint called, is_api_request: {is_api}")
        
        # Check essential directories
        app_dir = os.path.dirname(os.path.dirname(__file__))
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

@router.get("/api/health")
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

@router.get("/api/test")
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

@router.get("/")
async def root(request: Request):
    """
    Root endpoint with basic information
    """
    # Log all headers if in debug mode
    is_api = is_api_request(request)
    logger.info(f"Root endpoint called, is_api_request: {is_api}")
    
    # Get current directory info
    try:
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        current_dir = os.getcwd()
        app_dir = os.path.dirname(os.path.dirname(__file__))
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
