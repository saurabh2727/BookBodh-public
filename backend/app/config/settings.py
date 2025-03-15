
# API keys and configuration settings
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Replace the placeholder with the real Grok API key
    GROK_API_KEY: str = "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"
    
    # Model settings
    DEFAULT_MODEL: str = "llama3-70b-8192"
    MAX_TOKENS: int = 500
    TEMPERATURE: float = 0.7
    
    # Database settings
    CHUNK_SIZE: int = 300  # words per chunk
    TOP_K_RESULTS: int = 3  # number of chunks to retrieve
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()
