import asyncio
import json
import os
import asyncpg
from typing import List
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        # Transmitimos a todas las conexiones activas
        for connection in self.active_connections.copy():
            try:
                await connection.send_text(message)
            except Exception as e:
                # Si falla (ej. cliente se desconectó abruptamente), lo removemos
                print(f"Error sending message to {connection.client}: {e}")
                self.disconnect(connection)

manager = ConnectionManager()

async def listen_to_pg():
    """
    Se conecta a PostgreSQL usando asyncpg y escucha notificaciones
    en el canal 'luxor_realtime'.
    """
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL no encontrada. No se puede iniciar el listener de realtime.")
        return

    # asyncpg requiere postgresql:// en lugar de postgesql+asyncpg:// o similar
    # Si la URL viene configurada para sqlalchemy con psycopg2, la limpiamos
    if db_url.startswith("postgresql+psycopg2://"):
        db_url = db_url.replace("postgresql+psycopg2://", "postgresql://")

    # Retry loop in case the database is temporarily unavailable
    while True:
        try:
            print("Conectando a PostgreSQL para Realtime LISTEN...")
            conn = await asyncpg.connect(db_url)
            print("Conexión Realtime establecida. Escuchando 'luxor_realtime'...")

            def pg_notify_handler(connection, pid, channel, payload):
                # Imprimimos o enviamos el evento directamente
                # FastAPI corre el event loop asíncrono principal,
                # por lo que creamos una tarea para no bloquear el handler de asyncpg
                asyncio.create_task(manager.broadcast(payload))

            await conn.add_listener("luxor_realtime", pg_notify_handler)

            # Mantenemos viva la conexión indefinidamente
            while True:
                # Comprobamos la salud de la conexión periodicamente
                await conn.execute("SELECT 1")
                await asyncio.sleep(60)

        except (asyncpg.exceptions.PostgresError, OSError) as e:
            print(f"Error en la conexión Realtime: {e}. Reintentando en 5 segundos...")
            await asyncio.sleep(5)
        except Exception as e:
            print(f"Error crítico en Realtime listener: {e}")
            break
