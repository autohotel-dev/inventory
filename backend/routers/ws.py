from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import asyncio
import json
from ws_manager import manager
from auth_utils import verify_token

router = APIRouter()

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    authenticated = False
    
    # Simple timeout task for initial authentication
    async def auth_timeout():
        await asyncio.sleep(5)
        if not authenticated:
            await websocket.close(code=4003, reason="Authentication timeout")
            
    timeout_task = asyncio.create_task(auth_timeout())

    try:
        while True:
            data = await websocket.receive_text()
            
            try:
                msg = json.loads(data)
                msg_type = msg.get("type")
                
                # Ping/Pong handling
                if msg_type == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
                    continue
                    
                # Authentication handling
                if msg_type == "auth":
                    token = msg.get("token")
                    if not token:
                        await websocket.close(code=4003, reason="Missing token")
                        return
                        
                    try:
                        user = verify_token(token)
                        authenticated = True
                        await manager.authenticate(websocket, user.id)
                        await websocket.send_text(json.dumps({"type": "auth_success", "user_id": user.id}))
                    except Exception as e:
                        print(f"WS Auth failed: {e}")
                        await websocket.close(code=4003, reason="Invalid token")
                        return
                    continue
                
                # Ensure authentication before processing further messages
                if not authenticated:
                    await websocket.send_text(json.dumps({"type": "error", "message": "Not authenticated"}))
                    continue
                
                # Subscription handling
                if msg_type == "subscribe":
                    channel = msg.get("channel")
                    if channel:
                        await manager.subscribe(websocket, channel)
                        await websocket.send_text(json.dumps({"type": "subscribed", "channel": channel}))
                
                elif msg_type == "unsubscribe":
                    channel = msg.get("channel")
                    if channel:
                        await manager.unsubscribe(websocket, channel)
                        await websocket.send_text(json.dumps({"type": "unsubscribed", "channel": channel}))
                        
            except json.JSONDecodeError:
                pass
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket)
    finally:
        timeout_task.cancel()
