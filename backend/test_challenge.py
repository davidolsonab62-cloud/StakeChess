import requests
BASE='http://127.0.0.1:9000'
print('Login...')
try:
    r=requests.post(BASE+'/api/auth/login', json={'email':'admin@stakechess.com','password':'admin123'})
    print('login', r.status_code)
    print(r.text)
    if r.status_code==200:
        token=r.json().get('access_token')
        headers={'Authorization':f'Bearer {token}'}
        payload={'target_user_id':'user_testbot','message':'hello test challenge'}
        r2=requests.post(BASE+'/api/challenges', json=payload, headers=headers)
        print('challenge', r2.status_code)
        print(r2.text)
    else:
        print('Login failed')
except Exception as e:
    print('Error', e)
