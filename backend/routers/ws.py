from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from ws_manager import manager
import json

router = APIRouter()

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Mantener la conexión abierta y procesar mensajes entrantes (como PING)
            # En nuestro caso, el flujo es principalmente Backend -> Frontend
            # Pero podemos recibir suscripciones si queremos filtrado en el backend luego.
            data = await websocket.receive_text()
            
            # Responder a PINGs del cliente para mantener el WebSocket vivo
            try:
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
            except json.JSONDecodeError:
                pass
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket)
