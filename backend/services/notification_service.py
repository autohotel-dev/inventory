import httpx
import logging
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from datetime import datetime
import uuid

from models.system import Notifications
from models.auth import Users
from models.hr import Employees

logger = logging.getLogger(__name__)

async def _send_expo_push(push_token: str, title: str, message: str, data: Dict[str, Any]):
    """Internal function to call Expo Push API"""
    if not push_token.startswith("ExponentPushToken"):
        return

    url = "https://exp.host/--/api/v2/push/send"
    payload = {
        "to": push_token,
        "title": title,
        "body": message,
        "data": data,
        "sound": "default"
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            logger.info(f"Push notification sent successfully to {push_token}")
    except Exception as e:
        logger.error(f"Failed to send push notification to {push_token}: {str(e)}")


def create_notification(
    db: Session,
    user_id: uuid.UUID,
    notification_type: str,
    title: str,
    message: str,
    data: Optional[Dict[str, Any]] = None,
    employee_id: Optional[uuid.UUID] = None
) -> Notifications:
    """Creates a notification in DB. Used as replacement for Supabase Triggers."""
    
    notif = Notifications(
        user_id=user_id,
        employee_id=employee_id,
        type=notification_type,
        title=title,
        message=message,
        data=data or {},
        is_read=False,
        created_at=datetime.utcnow()
    )
    db.add(notif)
    db.flush()
    return notif

async def notify_user(
    db: Session,
    user_id: uuid.UUID,
    notification_type: str,
    title: str,
    message: str,
    data: Optional[Dict[str, Any]] = None,
    employee_id: Optional[uuid.UUID] = None
):
    """
    Background task: Creates notification in DB and sends Expo Push.
    This replaces both the pg_net trigger and the Edge Function in Supabase.
    """
    # 1. Create DB record
    create_notification(db, user_id, notification_type, title, message, data, employee_id)
    db.commit()

    # 2. Get push token if available
    # Assuming user metadata has expo_push_token, or employee has it.
    # We query the user to check raw_user_meta_data for the token (common in Supabase setup).
    user = db.query(Users).filter(Users.id == user_id).first()
    if user and user.raw_user_meta_data:
        push_token = user.raw_user_meta_data.get("expo_push_token")
        if push_token:
            await _send_expo_push(push_token, title, message, data or {})

async def notify_chat_participants(
    db: Session,
    conversation_id: uuid.UUID,
    sender_user_id: uuid.UUID,
    sender_email: str,
    message_type: str,
    message_content: str,
    message_id: uuid.UUID
):
    """
    Background task to notify other chat participants.
    Replaces trigger_notify_chat_participants.
    """
    # Requires importing ConversationParticipants - assumes models.system or similar holds chat tables
    # Since we don't have the chat models right here, we will execute raw SQL to avoid model mapping errors
    from sqlalchemy import text
    
    query = text(\"\"\"
        SELECT cp.user_id 
        FROM conversation_participants cp
        JOIN employees e ON e.auth_user_id = cp.user_id AND e.is_active = true
        WHERE cp.conversation_id = :conv_id AND cp.user_id != :sender_id
    \"\"\")
    
    result = db.execute(query, {"conv_id": conversation_id, "sender_id": sender_user_id})
    participants = result.fetchall()

    title = f"Nuevo mensaje de {sender_email.split('@')[0]}"
    message_body = "📷 Imagen adjunta" if message_type == 'image' else (message_content[:100] if message_content else "")

    for row in participants:
        await notify_user(
            db=db,
            user_id=row.user_id,
            notification_type='chat_message',
            title=title,
            message=message_body,
            data={"conversationId": str(conversation_id), "messageId": str(message_id)}
        )
