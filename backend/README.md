
# BookBodh Backend

This is the Python backend for the BookBodh application. It provides a FastAPI-based API that implements Retrieval-Augmented Generation (RAG) to answer questions based on book content.

## Features

- FastAPI-based REST API
- RAG (Retrieval-Augmented Generation) with books database
- Semantic search using sentence-transformers and FAISS
- Grok API integration for generating responses
- Book database with chunk management

## Installation

1. Clone the repository
2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Replace the placeholder Grok API key in `app/config/settings.py` with your actual API key.

## Running the Application

To run the application in development mode:

```bash
uvicorn app.main:app --reload
```

The API will be available at http://localhost:8000.

## API Endpoints

- `GET /`: Root endpoint that returns a status message
- `POST /chat`: Main chat endpoint that accepts queries and returns AI-generated responses

## Running Tests

To run the tests:

```bash
pytest
```

## Project Structure

```
app/
├── __init__.py         # Marks app as a package
├── main.py             # Entry point, FastAPI app setup
├── models/             # Data models (e.g., Pydantic for API)
│   ├── __init__.py
│   └── chat.py         # Query and response schemas
├── services/           # Business logic (RAG, LLM)
│   ├── __init__.py
│   ├── retrieval.py    # Vector search and chunk retrieval
│   └── llm.py          # LLM API integration with Grok
├── database/           # Book data and embeddings
│   ├── __init__.py
│   ├── books.py        # Book loading and preprocessing
│   └── embeddings.py   # Embedding generation and storage
├── routers/            # API endpoints
│   ├── __init__.py
│   └── chat.py         # /chat endpoint logic
└── config/             # Configuration settings
    ├── __init__.py
    └── settings.py     # API keys, model settings, etc.
```

## Frontend Integration

This backend is designed to work with the TypeScript/React frontend running on http://localhost:5173. CORS is enabled for this origin.
