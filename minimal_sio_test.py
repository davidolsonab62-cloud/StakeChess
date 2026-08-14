import socketio
import asyncio

# Minimal socket.io server
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins=['http://localhost:3000', 'http://127.0.0.1:3000'],
    transports=['polling', 'websocket']
)

@sio.event
async def connect(sid, environ):
    print(f"Client {sid} connected")

@sio.event
async def disconnect(sid):
    print(f"Client {sid} disconnected")

# Minimal app - just return 404 for everything not socket.io
async def fallback_app(scope, receive, send):
    if scope['type'] == 'http':
        await send({
            'type': 'http.response.start',
            'status': 404,
            'headers': [[b'content-type', b'text/plain']],
        })
        await send({
            'type': 'http.response.body',
            'body': b'Not Found',
        })
    else:
        raise ValueError(f'Unknown scope type: {scope["type"]}')

# Wrap with ASGIApp
app = socketio.ASGIApp(sio, fallback_app, socketio_path='socket.io')

if __name__ == '__main__':
    import uvicorn
    print("Starting minimal socket.io server on port 8001...")
    uvicorn.run(app, host='127.0.0.1', port=8001)
