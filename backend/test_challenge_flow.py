import requests
BASE='http://127.0.0.1:9000'
print('Registering target user...')
try:
    r=requests.post(BASE+'/api/auth/register', json={'name':'testbot','email':'testbot@example.com','password':'password'}, timeout=5)
    print('register status', r.status_code)
    print(r.text)
    target_id = None
    if r.status_code==200:
        target_id = r.json()['user']['user_id']
        print('target created', target_id)
    else:
        # Try to lookup user by login
        print('Register failed, trying login...')
        r2 = requests.post(BASE+'/api/auth/login', json={'email':'testbot@example.com','password':'password'}, timeout=5)
        print('login', r2.status_code)
        if r2.status_code==200:
            target_id = r2.json()['user']['user_id']

    # Now login as admin again and set preferences for target user
    print('Admin login...')
    admin = requests.post(BASE+'/api/auth/login', json={'email':'admin@stakechess.com','password':'admin123'}, timeout=5)
    print('admin login', admin.status_code)
    admin_token = None
    if admin.status_code==200:
        admin_token = admin.json()['access_token']
    if not target_id or not admin_token:
        print('Missing data; abort')
    else:
        headers = {'Authorization':f'Bearer {admin_token}'}
        settings = {'min_challenge_rating':1400, 'max_challenge_rating':2000, 'allow_any_rating':False}
        r3 = requests.put(f"{BASE}/api/users/{target_id}/settings", json=settings, headers=headers, timeout=5)
        print('set prefs', r3.status_code, r3.text)

        # Now login as low-rated user and attempt to challenge
        print('Register low-rated challenger...')
        ch = requests.post(BASE+'/api/auth/register', json={'name':'lowrank','email':'lowrank@example.com','password':'pw'}, timeout=5)
        print('ch reg', ch.status_code)
        if ch.status_code==200:
            ch_token = ch.json()['access_token']
            print('challenger token ok')
            # attempt challenge
            r4 = requests.post(f"{BASE}/api/challenges", json={'target_user_id': target_id, 'message':'hi'}, headers={'Authorization':f'Bearer {ch_token}'}, timeout=5)
            print('challenge attempt', r4.status_code, r4.text)
        else:
            print('Failed to create challenger')

except Exception as e:
    print('Error', e)
