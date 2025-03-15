
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from app.main import app

client = TestClient(app)

@pytest.fixture
def mock_generate_response():
    with patch("app.services.llm.generate_response") as mock:
        mock.return_value = {
            "response": "According to 'The Alchemist' by Paulo Coelho, happiness is found when you pursue your Personal Legend. The book teaches that \"when you want something, all the universe conspires in helping you to achieve it.\"",
            "book": "The Alchemist",
            "author": "Paulo Coelho"
        }
        yield mock

@pytest.fixture
def mock_retrieve_chunks():
    with patch("app.services.retrieval.retrieve_chunks") as mock:
        mock.return_value = [
            {
                "text": "Personal Legend is a term coined by Paulo Coelho in his novel \"The Alchemist\". It refers to what you have always wanted to accomplish. According to Coelho, everyone has a Personal Legend, and discovering this Personal Legend is the primary purpose of one's life.",
                "title": "The Alchemist",
                "author": "Paulo Coelho",
                "score": 0.92
            }
        ]
        yield mock

def test_chat_endpoint(mock_retrieve_chunks, mock_generate_response):
    response = client.post(
        "/chat",
        json={"query": "What is happiness?"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "response" in data
    assert "book" in data
    assert "author" in data
    assert "The Alchemist" in data["book"]
    assert "Paulo Coelho" in data["author"]
    
    # Verify that our mocks were called
    mock_retrieve_chunks.assert_called_once()
    mock_generate_response.assert_called_once()

def test_chat_with_book_filter(mock_retrieve_chunks, mock_generate_response):
    response = client.post(
        "/chat",
        json={"query": "What is happiness?", "book": "The Alchemist"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "The Alchemist" in data["book"]
    
    # Verify book parameter was passed
    mock_retrieve_chunks.assert_called_once_with("What is happiness?", "The Alchemist")
