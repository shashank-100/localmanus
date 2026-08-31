"""
FastAPI application for localmanus.
"""

import asyncio
import json
import logging
from pathlib import Path
from typing import List, Optional, Union

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from src.config import BROWSER_HISTORY_DIR
from src.config.env import BASIC_MODEL, REASONING_MODEL
from src.service.workflow_service import run_agent_workflow

# Configure logging
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="LocalManus API",
    description="API for the LocalManus LangGraph-based agent workflow",
    version="0.1.0",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)


class ContentItem(BaseModel):
    type: str = Field(..., description="The type of content (text, image, etc.)")
    text: Optional[str] = Field(None, description="The text content if type is 'text'")
    image_url: Optional[str] = Field(
        None, description="The image URL if type is 'image'"
    )


class ChatMessage(BaseModel):
    role: str = Field(
        ..., description="The role of the message sender (user or assistant)"
    )
    content: Union[str, List[ContentItem]] = Field(
        ...,
        description="The content of the message, either a string or a list of content items",
    )


class ChatRequest(BaseModel):
    messages: List[ChatMessage] = Field(..., description="The conversation history")
    debug: Optional[bool] = Field(False, description="Whether to enable debug logging")
    deep_thinking_mode: Optional[bool] = Field(
        False, description="Whether to enable deep thinking mode"
    )
    search_before_planning: Optional[bool] = Field(
        False, description="Whether to search before planning"
    )


@app.post("/api/chat/stream")
async def chat_endpoint(request: ChatRequest, req: Request):
    """
    Chat endpoint for LangGraph invoke.

    Args:
        request: The chat request
        req: The FastAPI request object for connection state checking

    Returns:
        The streamed response
    """
    try:
        # Convert Pydantic models to dictionaries and normalize content format
        messages = []
        for msg in request.messages:
            message_dict = {"role": msg.role}

            # Handle both string content and list of content items
            if isinstance(msg.content, str):
                message_dict["content"] = msg.content
            else:
                # For content as a list, convert to the format expected by the workflow
                content_items = []
                for item in msg.content:
                    if item.type == "text" and item.text:
                        content_items.append({"type": "text", "text": item.text})
                    elif item.type == "image" and item.image_url:
                        content_items.append(
                            {"type": "image", "image_url": item.image_url}
                        )

                message_dict["content"] = content_items

            messages.append(message_dict)

        async def event_generator():
            try:
                async for event in run_agent_workflow(
                    messages,
                    request.debug,
                    request.deep_thinking_mode,
                    request.search_before_planning,
                ):
                    # Check if client is still connected
                    if await req.is_disconnected():
                        logger.info("Client disconnected, stopping workflow")
                        break
                    yield {
                        "event": event["event"],
                        "data": json.dumps(event["data"], ensure_ascii=False),
                    }
            except asyncio.CancelledError:
                logger.info("Stream processing cancelled")
                raise

        return EventSourceResponse(
            event_generator(),
            media_type="text/event-stream",
            sep="\n",
        )
    except Exception as e:
        logger.error(f"Error in chat endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/browser_history/{filename}")
async def get_browser_history_file(filename: str):
    """
    Get a specific browser history GIF file.

    Args:
        filename: The filename of the GIF to retrieve

    Returns:
        The GIF file
    """
    try:
        # Resolve under the history directory so "../" cannot escape it.
        history_dir = Path(BROWSER_HISTORY_DIR).resolve()
        file_path = (history_dir / filename).resolve()
        if (
            not filename.endswith(".gif")
            or history_dir not in file_path.parents
            or not file_path.is_file()
        ):
            raise HTTPException(status_code=404, detail="File not found")

        return FileResponse(
            file_path, media_type="image/gif", filename=file_path.name
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving browser history file: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/models")
async def get_models():
    """
    Report the configured model names so the UI can display them.

    Only names are exposed here; API keys and base URLs stay server-side.
    """
    # Strip any LiteLLM "provider/" prefix, which is a routing detail.
    def display_name(model: str) -> str:
        return model.split("/", 1)[-1] if model else "unset"

    return {
        "basic": display_name(BASIC_MODEL),
        "reasoning": display_name(REASONING_MODEL),
    }


# Serve the companion chat UI after API routes so /api/* remains authoritative.
WEB_DIR = Path(__file__).resolve().parents[2] / "web"


@app.get("/")
async def index():
    """
    Serve index.html with cache-busted asset URLs.

    StaticFiles lets browsers cache app.js and styles.css, so after a deploy a
    returning visitor can run stale JavaScript against the new API. Stamping the
    URLs with each file's mtime gives changed assets a fresh URL while unchanged
    ones stay cacheable.
    """
    html = (WEB_DIR / "index.html").read_text()
    for asset in ("app.js", "styles.css"):
        version = int((WEB_DIR / asset).stat().st_mtime)
        html = html.replace(f"/{asset}", f"/{asset}?v={version}")
    return HTMLResponse(html, headers={"Cache-Control": "no-cache"})


app.mount("/", StaticFiles(directory=WEB_DIR, html=True), name="web")
