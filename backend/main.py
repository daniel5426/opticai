# where the backend fastapi app that will be used as a proxy for openai llm call, and for handling the app backups

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import config
from database import engine
from models import Base
from EndPoints import auth, companies, clinics, users, clients, families, appointments, medical_logs, exam_data, orders, referrals, files, settings, work_shifts, lookups, campaigns, contact_lenses, billing, chats, email_logs, optical_exams, exam_layouts, exams, unified_exam_data
import httpx
import json
from fastapi.responses import StreamingResponse

app = FastAPI(
    title=config.settings.PROJECT_NAME,
    version=config.settings.VERSION,
    openapi_url=f"{config.settings.API_V1_STR}/openapi.json"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

app.include_router(auth.router, prefix=config.settings.API_V1_STR)
app.include_router(companies.router, prefix=config.settings.API_V1_STR)
app.include_router(clinics.router, prefix=config.settings.API_V1_STR)
app.include_router(users.router, prefix=config.settings.API_V1_STR)
app.include_router(clients.router, prefix=config.settings.API_V1_STR)
app.include_router(families.router, prefix=config.settings.API_V1_STR)
app.include_router(appointments.router, prefix=config.settings.API_V1_STR)
app.include_router(medical_logs.router, prefix=config.settings.API_V1_STR)
app.include_router(exam_data.router, prefix=config.settings.API_V1_STR)
app.include_router(orders.router, prefix=config.settings.API_V1_STR)
app.include_router(referrals.router, prefix=config.settings.API_V1_STR)
app.include_router(files.router, prefix=config.settings.API_V1_STR)
app.include_router(settings.router, prefix=config.settings.API_V1_STR)
app.include_router(work_shifts.router, prefix=config.settings.API_V1_STR)
app.include_router(lookups.router, prefix=config.settings.API_V1_STR)
app.include_router(campaigns.router, prefix=config.settings.API_V1_STR)
app.include_router(contact_lenses.router, prefix=config.settings.API_V1_STR)
app.include_router(billing.router, prefix=config.settings.API_V1_STR)
app.include_router(chats.router, prefix=config.settings.API_V1_STR)
app.include_router(email_logs.router, prefix=config.settings.API_V1_STR)
app.include_router(optical_exams.router, prefix=config.settings.API_V1_STR)
app.include_router(exam_layouts.router, prefix=config.settings.API_V1_STR)
app.include_router(exams.router, prefix=config.settings.API_V1_STR)
app.include_router(unified_exam_data.router, prefix=config.settings.API_V1_STR)

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "OpticAI API"}

@app.post("/chat/completions")
async def chat_completions(request: dict):
    try:
        if not request.get("messages"):
            return {"error": "Messages cannot be empty"}
        
        stream = request.get("stream", False)
        
        async with httpx.AsyncClient() as client:
            headers = {
                "Authorization": f"Bearer {config.settings.OPENAI_API_KEY}",
                "Content-Type": "application/json"
            }
            
            messages = []
            for msg in request["messages"]:
                message_dict = {"role": msg["role"]}
                if "content" in msg:
                    message_dict["content"] = msg["content"]
                if "tool_calls" in msg:
                    message_dict["tool_calls"] = msg["tool_calls"]
                if "tool_call_id" in msg:
                    message_dict["tool_call_id"] = msg["tool_call_id"]
                if "name" in msg:
                    message_dict["name"] = msg["name"]
                messages.append(message_dict)
            
            payload = {
                "model": request.get("model", "gpt-4o"),
                "messages": messages,
                "temperature": request.get("temperature", 0.7),
                "stream": stream,
            }
            
            if "max_tokens" in request:
                payload["max_tokens"] = request["max_tokens"]
            
            if "tools" in request:
                payload["tools"] = request["tools"]
                
            if "tool_choice" in request:
                payload["tool_choice"] = request["tool_choice"]
                
            if "functions" in request:
                payload["functions"] = request["functions"]
                
            if "function_call" in request:
                payload["function_call"] = request["function_call"]
            
            if stream:
                async def generate_stream():
                    async with client.stream(
                        "POST",
                        f"{config.settings.OPENAI_BASE_URL}/chat/completions",
                        json=payload,
                        headers=headers,
                        timeout=60.0
                    ) as response:
                        if response.status_code != 200:
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
                response = await client.post(
                    f"{config.settings.OPENAI_BASE_URL}/chat/completions",
                    json=payload,
                    headers=headers,
                    timeout=60.0
                )
                
                if response.status_code != 200:
                    error_detail = response.text if response.text else f"OpenAI API returned status {response.status_code}"
                    return {"error": error_detail}
                
                return response.json()
            
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=config.settings.HOST, port=config.settings.PORT)