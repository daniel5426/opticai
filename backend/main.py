# where the backend fastapi app that will be used as a proxy for openai llm call, and for handling the app backups

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import httpx
import os
from dotenv import load_dotenv
import uvicorn

load_dotenv()

app = FastAPI(title="OpticAI Proxy Server", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OPENAI_API_KEY = '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'
OPENAI_BASE_URL = "https://api.openai.com/v1"

if not OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY environment variable is required")

class ChatMessage(BaseModel):
    role: str
    content: Optional[str] = None
    tool_calls: Optional[List[Dict[str, Any]]] = None
    tool_call_id: Optional[str] = None
    name: Optional[str] = None

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    model: str = "gpt-4o"
    temperature: float = 0.7
    max_tokens: Optional[int] = None
    tools: Optional[List[Dict[str, Any]]] = None
    tool_choice: Optional[Any] = None
    functions: Optional[List[Dict[str, Any]]] = None
    function_call: Optional[Any] = None
    stream: bool = False

class ChatResponse(BaseModel):
    id: str
    object: str
    created: int
    model: str
    choices: List[Dict[str, Any]]
    usage: Dict[str, Any]

@app.post("/chat/completions")
async def chat_completions(request: ChatRequest):
    from fastapi.responses import StreamingResponse
    import json
    
    try:
        print(f"Received request: {request.model_dump()}")  # Debug log
        
        # Validate that we have messages
        if not request.messages:
            raise HTTPException(status_code=422, detail="Messages cannot be empty")
        
        # Check if streaming is requested
        stream = getattr(request, 'stream', False)
        
        async with httpx.AsyncClient() as client:
            headers = {
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json"
            }
            
            # Create the payload exactly as OpenAI expects it
            # Build messages with all fields
            messages = []
            for msg in request.messages:
                message_dict = {"role": msg.role}
                if msg.content is not None:
                    message_dict["content"] = msg.content
                if msg.tool_calls:
                    message_dict["tool_calls"] = msg.tool_calls
                if msg.tool_call_id:
                    message_dict["tool_call_id"] = msg.tool_call_id
                if msg.name:
                    message_dict["name"] = msg.name
                messages.append(message_dict)
            
            payload = {
                "model": request.model,
                "messages": messages,
                "temperature": request.temperature,
                "stream": stream,
            }
            
            if request.max_tokens:
                payload["max_tokens"] = request.max_tokens
            
            # Handle function calling properly (both new and legacy formats)
            if request.tools:
                payload["tools"] = request.tools
                
            if request.tool_choice:
                payload["tool_choice"] = request.tool_choice
                
            if request.functions:
                payload["functions"] = request.functions
                
            if request.function_call:
                payload["function_call"] = request.function_call
            
            print(f"Sending to OpenAI: {payload}")  # Debug log
            
            if stream:
                # Handle streaming response
                async def generate_stream():
                    async with client.stream(
                        "POST",
                        f"{OPENAI_BASE_URL}/chat/completions",
                        json=payload,
                        headers=headers,
                        timeout=60.0
                    ) as response:
                        if response.status_code != 200:
                            print(f"OpenAI API error: {response.status_code}")
                            error_data = {
                                "error": f"OpenAI API returned status {response.status_code}"
                            }
                            yield f"data: {json.dumps(error_data)}\n\n"
                            return
                        
                        async for chunk in response.aiter_lines():
                            if chunk:
                                chunk_str = chunk.decode('utf-8')
                                if chunk_str.startswith('data: '):
                                    yield f"{chunk_str}\n\n"
                
                return StreamingResponse(
                    generate_stream(),
                    media_type="text/plain",
                    headers={
                        "Cache-Control": "no-cache",
                        "Connection": "keep-alive",
                        "Content-Type": "text/plain; charset=utf-8"
                    }
                )
            else:
                # Handle regular response
                response = await client.post(
                    f"{OPENAI_BASE_URL}/chat/completions",
                    json=payload,
                    headers=headers,
                    timeout=60.0
                )
                
                if response.status_code != 200:
                    print(f"OpenAI API error: {response.status_code} - {response.text}")
                    error_detail = response.text if response.text else f"OpenAI API returned status {response.status_code}"
                    raise HTTPException(
                        status_code=response.status_code,
                        detail=error_detail
                    )
                
                result = response.json()
                print(f"OpenAI response: {result}")  # Debug log
                return result
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=408, detail="Request timeout")
    except Exception as e:
        print(f"Proxy error: {str(e)}")
        print(f"Error type: {type(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "OpticAI Proxy Server"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)