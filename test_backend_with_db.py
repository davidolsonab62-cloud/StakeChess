# Test backend with database to see if that's the culprit
import socketio
from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

cors_origins_list = [
    'http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3006',
    'http://127.0.0.1:3000', 'http://127.0.0.1:3001', 'http://127.0.0.1:3002', 'http://127.0.0.1:3006'
]

# Socket.IO server
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins=cors_origins_list,
    logger=True,
    engineio_logger=True,
    transports=['polling', 'websocket']
)

# Create FastAPI app
_fastapi_app = FastAPI(title="StakeChess API (Test with DB)")

# Add CORS middleware
_fastapi_app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=cors_origins_list,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Try to initialize database (like in full backend)
try:
    mongo_url = os.environ.get('MONGO_URL')
    if mongo_url:
        print(f"Connecting to MongoDB: {mongo_url[:50]}...")
        client = AsyncIOMotorClient(mongo_url)
        db = client[os.environ.get('DB_NAME', 'stakechess')]
        print("MongoDB connection established")
except Exception as e:
    print(f"Warning: MongoDB connection failed: {e}")
    db = None

# Add a test route
@_fastapi_app.get("/api/health")
async def health():
    return {"status": "ok"}

# Socket.IO events
@sio.event
async def connect(sid, environ):
    print(f"Client {sid} connected")

@sio.event
async def disconnect(sid):
    print(f"Client {sid} disconnected")

# Wrap with ASGIApp
app = socketio.ASGIApp(sio, _fastapi_app, socketio_path="socket.io")

if __name__ == '__main__':
    import uvicorn
    print("Starting test backend with DB on port 8004...")
    uvicorn.run(app, host='127.0.0.1', port=8004)
