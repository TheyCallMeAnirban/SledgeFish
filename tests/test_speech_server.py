"""
Tests for SledgeFish Speech Server
Verifies endpoint structure, error handling, and parameter validation.
"""

from fastapi.testclient import TestClient
import pytest
from unittest.mock import patch, MagicMock
import speech_server
from speech_server import app

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert "api_key_configured" in data
    assert data["default_voice_id"] == "b3e2e78dfa3f4100a7b9be30175b06a7"

def test_tts_missing_api_key(monkeypatch):
    monkeypatch.setenv("FISH_API_KEY", "")
    response = client.post("/api/tts", json={"text": "नमस्ते"})
    assert response.status_code == 500
    assert "FISH_API_KEY" in response.json()["detail"]

def test_tts_empty_text():
    response = client.post("/api/tts", json={"text": ""})
    assert response.status_code == 422 # Validation error

@patch("httpx.AsyncClient.post")
def test_tts_successful_mock_audio(mock_post, monkeypatch):
    monkeypatch.setenv("FISH_API_KEY", "test_key_12345")
    
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.content = b"ID3\x04\x00\x00\x00\x00mock_audio_bytes"
    mock_post.return_value = mock_response

    response = client.post("/api/tts", json={
        "text": "शानदार चाल!",
        "reference_id": "b3e2e78dfa3f4100a7b9be30175b06a7",
        "format": "mp3"
    })

    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/mpeg"
    assert response.content == b"ID3\x04\x00\x00\x00\x00mock_audio_bytes"

@patch("httpx.AsyncClient.post")
def test_tts_upstream_rate_limit(mock_post, monkeypatch):
    monkeypatch.setenv("FISH_API_KEY", "test_key_12345")
    
    mock_response = MagicMock()
    mock_response.status_code = 429
    mock_response.text = "Rate limited"
    mock_post.return_value = mock_response

    response = client.post("/api/tts", json={"text": "वाह क्या चाल है"})
    assert response.status_code == 429
    assert "rate limit" in response.json()["detail"].lower()
