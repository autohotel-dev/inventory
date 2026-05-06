import asyncio
import websockets

async def test():
    try:
        async with websockets.connect('wss://luxor-backend-li1y.onrender.com/ws') as ws:
            print('Connected!')
    except Exception as e:
        print(f"Error: {e}")

asyncio.run(test())
