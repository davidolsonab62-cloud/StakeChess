import urllib.request, urllib.error, json, uuid

def req(method, url, data=None, token=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    body = None
    if data is not None:
        body = json.dumps(data).encode('utf-8')
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        print('HTTPError', e.code, e.reason, e.read().decode('utf-8'))
        raise
    except Exception as e:
        print('Error', e)
        raise

base = 'http://127.0.0.1:9000/api'
email_a = f'drawA_{uuid.uuid4().hex[:8]}@example.com'
email_b = f'drawB_{uuid.uuid4().hex[:8]}@example.com'
user_a = {'name': 'drawA', 'email': email_a, 'password': 'Testpass123'}
user_b = {'name': 'drawB', 'email': email_b, 'password': 'Testpass123'}
res_a = req('POST', f'{base}/auth/register', user_a)
res_b = req('POST', f'{base}/auth/register', user_b)
print('registeredA', res_a['user']['user_id'])
print('registeredB', res_b['user']['user_id'])
token_a = res_a['access_token']
token_b = res_b['access_token']
create_data = {'time_control': '3+0', 'stake_amount': 0, 'stake_currency': 'USDT', 'is_private': False, 'game_type': 'bullet'}
res_game = req('POST', f'{base}/games', create_data, token_a)
print('created_game', res_game['game_id'])
game_id = res_game['game_id']
res_join = req('POST', f'{base}/games/{game_id}/join', None, token_b)
print('joined_game status', res_join['status'])
res_offer = req('POST', f'{base}/games/{game_id}/draw/offer', None, token_a)
print('offer_draw OK')
res_accept = req('POST', f'{base}/games/{game_id}/draw/accept', None, token_b)
print('accept_draw OK')
res_final = req('GET', f'{base}/games/{game_id}')
print('final', json.dumps({'game_id': res_final['game_id'], 'status': res_final['status'], 'result': res_final['result'], 'end_reason': res_final.get('end_reason')}, indent=2))
