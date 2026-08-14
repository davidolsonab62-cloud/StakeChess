import socketio
import asyncio

async def test_server(port):
    sio = socketio.AsyncClient()
    
    @sio.event
    async def connect():
        print(f"[PORT {port}] SUCCESS: Connected to socket.io!")
        await sio.disconnect()
    
    @sio.event
    async def connect_error(data):
        print(f"[PORT {port}] ERROR: Connection error: {data}")
    
    @sio.event
    async def disconnect():
        print(f"[PORT {port}] Disconnected")
    
    try:
        print(f"[PORT {port}] Connecting...")
        await sio.connect(f'http://127.0.0.1:{port}', transports=['polling'])
        await asyncio.sleep(1)
    except Exception as e:
        print(f"[PORT {port}] EXCEPTION: {e}")

backend_port = int(os.environ.get('BACKEND_PORT', '8001'))
ports = [backend_port, 8002, 8003, 8004, 8005]
for port in ports:
    print(f"\n{'='*50}\nTesting port {port}\n{'='*50}")
    asyncio.run(test_server(port))

