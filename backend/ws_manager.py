import asyncio
import json
import os
import asyncpg
from typing import Dict, Set
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        # Maps user IDs to their WebSocket connections
        self.active_users: Dict[str, Set[WebSocket]] = {}
        # Maps channels to sets of WebSockets subscribed to them
        self.channels: Dict[str, Set[WebSocket]] = {}
        # Reverse map to quickly find which channels a WS is subscribed to and who it belongs to
        self.ws_info: Dict[WebSocket, dict] = {}

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.ws_info[websocket] = {"user_id": None, "channels": set()}

    async def authenticate(self, websocket: WebSocket, user_id: str):
        self.ws_info[websocket]["user_id"] = user_id
        if user_id not in self.active_users:
            self.active_users[user_id] = set()
        self.active_users[user_id].add(websocket)
        
        # Subscribe to personal channel by default
        personal_channel = f"system-notifications-{user_id}"
        await self.subscribe(websocket, personal_channel)

    def disconnect(self, websocket: WebSocket):
        if websocket not in self.ws_info:
            return
            
        info = self.ws_info[websocket]
        user_id = info["user_id"]
        
        # Remove from user mapping
        if user_id and user_id in self.active_users:
            self.active_users[user_id].discard(websocket)
            if not self.active_users[user_id]:
                del self.active_users[user_id]
                
        # Remove from channels
        for channel in info["channels"]:
            if channel in self.channels:
                self.channels[channel].discard(websocket)
                if not self.channels[channel]:
                    del self.channels[channel]
                    
        del self.ws_info[websocket]

    async def subscribe(self, websocket: WebSocket, channel: str):
        if websocket not in self.ws_info:
            return
        self.ws_info[websocket]["channels"].add(channel)
        if channel not in self.channels:
            self.channels[channel] = set()
        self.channels[channel].add(websocket)

    async def unsubscribe(self, websocket: WebSocket, channel: str):
        if websocket not in self.ws_info:
            return
        if channel in self.ws_info[websocket]["channels"]:
            self.ws_info[websocket]["channels"].remove(channel)
        if channel in self.channels:
            self.channels[channel].discard(websocket)
            if not self.channels[channel]:
                del self.channels[channel]

    async def broadcast_to_channel(self, channel: str, message: dict):
        if channel not in self.channels:
            return
            
        message_str = json.dumps(message)
        dead_connections = set()
        
        for connection in self.channels[channel]:
            try:
                await connection.send_text(message_str)
            except Exception as e:
                print(f"Error sending to {connection.client}: {e}")
                dead_connections.add(connection)
                
        for dead in dead_connections:
            self.disconnect(dead)
            
    async def process_pg_payload(self, payload_str: str):
        """Processes the postgres notification payload and routes it"""
        try:
            payload = json.loads(payload_str)
            # Example payload from luxor_realtime: {"table": "rooms", "action": "UPDATE", "data": {...}}
            table = payload.get("table")
            
            # Create a generic channel name for the table (e.g. "rooms", "room_assets")
            if table:
                # Let's route to a channel named after the table (or a custom mapping)
                # For compatibility with frontend expecting "rooms", "room_assets", etc.
                # The frontend might subscribe to "assets-realtime" for room_assets and rooms
                if table in ["rooms", "room_assets"]:
                    await self.broadcast_to_channel("assets-realtime", payload)
                
                # Also broadcast to exact table name channel just in case
                await self.broadcast_to_channel(table, payload)
                
            # Global broadcast for backwards compatibility if needed, but discouraged
            # await self.broadcast_to_channel("global", payload)
            
        except json.JSONDecodeError:
            print("Failed to decode PostgreSQL payload")
        except Exception as e:
            print(f"Error processing pg payload: {e}")

manager = ConnectionManager()

async def listen_to_pg():
    """
    Connects to PostgreSQL using asyncpg and listens for notifications
    on the 'luxor_realtime' channel.
    """
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL not found. Realtime listener disabled.")
        return

    if db_url.startswith("postgresql+psycopg2://"):
        db_url = db_url.replace("postgresql+psycopg2://", "postgresql://")

    while True:
        try:
            print("Conectando a PostgreSQL para Realtime LISTEN...")
            conn = await asyncpg.connect(db_url)
            print("Conexión Realtime establecida. Escuchando 'luxor_realtime'...")

            def pg_notify_handler(connection, pid, channel, payload):
                # We offload the broadcast to the event loop
                asyncio.create_task(manager.process_pg_payload(payload))

            await conn.add_listener("luxor_realtime", pg_notify_handler)

            while True:
                await conn.execute("SELECT 1")
                await asyncio.sleep(60)

        except (asyncpg.exceptions.PostgresError, OSError) as e:
            print(f"Error en la conexión Realtime: {e}. Reintentando en 5 segundos...")
            await asyncio.sleep(5)
        except Exception as e:
            print(f"Error crítico en Realtime listener: {e}")
            break
