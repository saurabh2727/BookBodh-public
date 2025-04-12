
# API keys and configuration settings
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Groq API key (not Grok - that was the naming mistake)
    GROK_API_KEY: str = "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"
    
    # Model settings
    DEFAULT_MODEL: str = "llama3-70b-8192"
    MAX_TOKENS: int = 500
    TEMPERATURE: float = 0.7
    
    # Database settings
    CHUNK_SIZE: int = 300  # words per chunk
    CHUNK_OVERLAP: int = 50  # words overlap between chunks
    TOP_K_RESULTS: int = 3  # number of chunks to retrieve
    
    # Upload settings
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10MB
    ALLOWED_EXTENSIONS: list[str] = ["pdf"]
    UPLOAD_DIR: str = "app/uploads"
    
    # Embedding model
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
    
    # Debug mode
    debug: bool = True
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()
