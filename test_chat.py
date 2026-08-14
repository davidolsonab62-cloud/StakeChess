import socketio
import time
sio = socketio.Client()

@sio.event
def connect():
    print('connected')
    sio.emit('join_user_room', {'user_id':'testbot_1'})
    sio.emit('join_game', {'game_id':'game_41b938769386','user_id':'testbot_1'})
    time.sleep(0.5)
    sio.emit('chat_message', {'game_id':'game_41b938769386','message':'hello from testbot','username':'testbot'})
    time.sleep(1)
    sio.disconnect()

if __name__ == '__main__':
    # Use default transport (polling) to avoid extra websocket deps in test client
    sio.connect('http://127.0.0.1:9000')
