import os
import httpx
from dotenv import load_dotenv

load_dotenv()
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="pose2img")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MODAL_ENDPOINT = os.environ.get("MODAL_ENDPOINT", "")


class RenderRequest(BaseModel):
    pose_image: str
    reference_image: str | None = None
    prompt: str
    width: int = 1024
    height: int = 1024
    num_steps: int = 28
    guidance_scale: float = 3.5
    pose_strength: float = 0.9
    seed: int | None = None


class RenderResponse(BaseModel):
    image: str  # base64 PNG


@app.get("/api/health")
def health():
    return {"status": "ok", "modal_configured": bool(MODAL_ENDPOINT)}


@app.post("/api/render", response_model=RenderResponse)
async def render(req: RenderRequest):
    if not MODAL_ENDPOINT:
        raise HTTPException(status_code=503, detail="MODAL_ENDPOINT not configured")
    async with httpx.AsyncClient(timeout=300) as client:
        resp = await client.post(MODAL_ENDPOINT, json=req.model_dump())
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
        return RenderResponse(**resp.json())
