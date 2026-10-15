"""
SledgeFish - Minimal FastAPI Speech Server for Fish Audio TTS
Acts as a secure local backend proxy so FISH_API_KEY is never exposed to the browser extension.
"""

import os
import sys
from typing import Optional
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field
import httpx
from dotenv import load_dotenv

# Load .env if present
load_dotenv()

FISH_API_URL = "https://api.fish.audio/v1/tts"
DEFAULT_VOICE_MODEL_ID = "b3e2e78dfa3f4100a7b9be30175b06a7"

app = FastAPI(
    title="SledgeFish Speech Service",
    description="TTS proxy for Fish Audio Cricket Commentary voice model",
    version="0.1.0"
)

# Enable CORS for Chrome Extension origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows chrome-extension:// origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000, description="Hindi commentary text")
    reference_id: Optional[str] = Field(DEFAULT_VOICE_MODEL_ID, description="Fish Audio Voice Model Reference ID")
    format: Optional[str] = Field("mp3", description="Audio output format (mp3, wav, opus)")
    mp3_bitrate: Optional[int] = Field(128, description="MP3 bitrate in kbps")

@app.get("/health")
def health_check():
    """Returns status and whether the API key is configured."""
    api_key = os.getenv("FISH_API_KEY", "")
    has_key = bool(api_key and not api_key.startswith("your_"))
    return {
        "status": "online",
        "api_key_configured": has_key,
        "default_voice_id": DEFAULT_VOICE_MODEL_ID
    }

@app.post("/api/tts")
async def generate_speech(req: TTSRequest):
    """
    Calls Fish Audio TTS API and streams back the audio bytes.
    Preserves exact Hindi text; handles rate limits, credit limits, and timeouts.
    """
    api_key = os.getenv("FISH_API_KEY", "").strip()
    if not api_key or api_key.startswith("your_"):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="FISH_API_KEY environment variable is not configured on the speech server. Set it in .env"
        )

    voice_id = req.reference_id or os.getenv("FISH_VOICE_MODEL_ID", DEFAULT_VOICE_MODEL_ID)

    payload = {
        "text": req.text,
        "reference_id": voice_id,
        "format": req.format or "mp3",
        "mp3_bitrate": req.mp3_bitrate or 128
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "model": "s2.1-pro"
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(FISH_API_URL, json=payload, headers=headers)

            if resp.status_code == 200:
                media_type = f"audio/{req.format}" if req.format != "mp3" else "audio/mpeg"
                return Response(content=resp.content, media_type=media_type)

            # Handle specific upstream Fish Audio error codes
            if resp.status_code == 401:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Fish Audio authentication failed. Please verify your FISH_API_KEY."
                )
            elif resp.status_code == 429:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Fish Audio rate limit reached. Please wait a moment before trying again."
                )
            elif resp.status_code == 402 or "credit" in resp.text.lower() or "balance" in resp.text.lower():
                raise HTTPException(
                    status_code=status.HTTP_402_PAYMENT_REQUIRED,
                    detail="Fish Audio credits exhausted or payment required."
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Fish Audio error (HTTP {resp.status_code}): {resp.text}"
                )

    except httpx.TimeoutException:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Fish Audio TTS request timed out (exceeded 15s)."
        )
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Network error connecting to Fish Audio API: {str(exc)}"
        )

if __name__ == "__main__":
    import uvicorn
    host = os.getenv("SPEECH_HOST", "127.0.0.1")
    port = int(os.getenv("SPEECH_PORT", "8000"))
    print(f"Starting SledgeFish Speech Service on http://{host}:{port}")
    uvicorn.run("speech_server:app", host=host, port=port, reload=True)
