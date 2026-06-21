import time
import socketio

sio = socketio.Client(logger=False, engineio_logger=False)

@sio.event
def connect():
    print('test-client connected', sio.sid)
    sio.emit('join_game', {'game_id': 'game_test_123'})
    time.sleep(0.5)
    sio.emit('game_move', {'game_id': 'game_test_123', 'move': 'e2e4', 'fen': 'testfen', 'current_turn': 'black'})

@sio.event
def disconnect():
    print('test-client disconnected')

if __name__ == '__main__':
    sio.connect('http://127.0.0.1:8001')
    time.sleep(1)
    sio.disconnect()
