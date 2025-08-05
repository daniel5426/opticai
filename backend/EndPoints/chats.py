from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import Chat, ChatMessage, Clinic
from schemas import ChatCreate, ChatUpdate, Chat as ChatSchema

router = APIRouter(prefix="/chats", tags=["chats"])

@router.post("/", response_model=ChatSchema)
def create_chat(chat: ChatCreate, db: Session = Depends(get_db)):
    db_chat = Chat(**chat.dict())
    db.add(db_chat)
    db.commit()
    db.refresh(db_chat)
    return db_chat

@router.get("/{chat_id}", response_model=ChatSchema)
def get_chat(chat_id: int, db: Session = Depends(get_db)):
    chat = db.query(Chat).filter(Chat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    return chat

@router.get("/", response_model=List[ChatSchema])
def get_all_chats(
    clinic_id: Optional[int] = Query(None, description="Filter by clinic ID"),
    db: Session = Depends(get_db)
):
    query = db.query(Chat)
    if clinic_id:
        query = query.filter(Chat.clinic_id == clinic_id)
    return query.all()

@router.get("/clinic/{clinic_id}", response_model=List[ChatSchema])
def get_chats_by_clinic(clinic_id: int, db: Session = Depends(get_db)):
    chats = db.query(Chat).filter(Chat.clinic_id == clinic_id).all()
    return chats

@router.put("/{chat_id}", response_model=ChatSchema)
def update_chat(chat_id: int, chat: ChatUpdate, db: Session = Depends(get_db)):
    db_chat = db.query(Chat).filter(Chat.id == chat_id).first()
    if not db_chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    for field, value in chat.dict(exclude_unset=True).items():
        setattr(db_chat, field, value)
    
    db.commit()
    db.refresh(db_chat)
    return db_chat

@router.delete("/{chat_id}")
def delete_chat(chat_id: int, db: Session = Depends(get_db)):
    chat = db.query(Chat).filter(Chat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    db.delete(chat)
    db.commit()
    return {"message": "Chat deleted successfully"}

# Chat Messages endpoints
@router.post("/{chat_id}/messages")
def create_chat_message(
    chat_id: int, 
    message_data: dict, 
    db: Session = Depends(get_db)
):
    # Check if chat exists
    chat = db.query(Chat).filter(Chat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    chat_message = ChatMessage(
        chat_id=chat_id,
        type=message_data.get("type", "text"),
        content=message_data.get("content", ""),
        data=message_data.get("data")
    )
    db.add(chat_message)
    db.commit()
    db.refresh(chat_message)
    
    return {
        "id": chat_message.id,
        "chat_id": chat_message.chat_id,
        "type": chat_message.type,
        "content": chat_message.content,
        "data": chat_message.data,
        "timestamp": chat_message.timestamp
    }

@router.get("/{chat_id}/messages", response_model=List[dict])
def get_chat_messages(chat_id: int, db: Session = Depends(get_db)):
    # Check if chat exists
    chat = db.query(Chat).filter(Chat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    messages = db.query(ChatMessage).filter(ChatMessage.chat_id == chat_id).all()
    return [
        {
            "id": message.id,
            "chat_id": message.chat_id,
            "type": message.type,
            "content": message.content,
            "data": message.data,
            "timestamp": message.timestamp
        }
        for message in messages
    ]

@router.put("/{chat_id}/messages/{message_id}")
def update_chat_message(
    chat_id: int, 
    message_id: int, 
    message_data: dict, 
    db: Session = Depends(get_db)
):
    message = db.query(ChatMessage).filter(
        ChatMessage.id == message_id,
        ChatMessage.chat_id == chat_id
    ).first()
    
    if not message:
        raise HTTPException(status_code=404, detail="Chat message not found")
    
    for field, value in message_data.items():
        if hasattr(message, field):
            setattr(message, field, value)
    
    db.commit()
    db.refresh(message)
    
    return {
        "id": message.id,
        "chat_id": message.chat_id,
        "type": message.type,
        "content": message.content,
        "data": message.data,
        "timestamp": message.timestamp
    }

@router.delete("/{chat_id}/messages/{message_id}")
def delete_chat_message(chat_id: int, message_id: int, db: Session = Depends(get_db)):
    message = db.query(ChatMessage).filter(
        ChatMessage.id == message_id,
        ChatMessage.chat_id == chat_id
    ).first()
    
    if not message:
        raise HTTPException(status_code=404, detail="Chat message not found")
    
    db.delete(message)
    db.commit()
    return {"message": "Chat message deleted successfully"} 