import requests
import json

print('=== Complete Auth Flow Test ===')
print()

# Test 1: Register a new user
print('Test 1: Register a new user')
try:
    response = requests.post('http://localhost:8000/api/auth/register', 
        json={
            'name': 'John Doe',
            'email': 'john.doe@example.com',
            'password': 'TestPassword123!'
        },
        timeout=5
    )
    print(f'Status: {response.status_code}')
    data = response.json()
    
    if response.status_code == 200:
        access_token = data.get('access_token')
        user = data.get('user', {})
        print(f'User ID: {user.get("user_id")}')
        print(f'Email: {user.get("email")}')
        print()
        
        # Test 2: Verify user info with /auth/me
        print('Test 2: Get authenticated user info (/auth/me)')
        response2 = requests.get('http://localhost:8000/api/auth/me',
            headers={'Authorization': f'Bearer {access_token}'},
            timeout=5
        )
        print(f'Status: {response2.status_code}')
        if response2.status_code == 200:
            user_data = response2.json()
            print(f'Email verified: {user_data.get("email")}')
    else:
        print(f'Error: {response.json()}')
except Exception as e:
    print(f'Error: {e}')

print()
print('Test 3: Login with registered credentials')
try:
    response = requests.post('http://localhost:8000/api/auth/login', 
        json={
            'email': 'john.doe@example.com',
            'password': 'TestPassword123!'
        },
        timeout=5
    )
    print(f'Status: {response.status_code}')
    if response.status_code == 200:
        data = response.json()
        print(f'Login successful!')
        token = data.get('access_token', '')[:50]
        print(f'Access token: {token}...')
        print(f'User: {data.get("user", {}).get("email")}')
    else:
        print(f'Error: {response.json()}')
except Exception as e:
    print(f'Error: {e}')

print()
print('Test 4: Test OAuth session flow')
try:
    # Create OAuth session
    response = requests.post('http://localhost:8000/api/auth/create-oauth-session', 
        json={
            'email': 'oauth.test@example.com',
            'name': 'OAuth Test User',
        },
        timeout=5
    )
    print(f'Create OAuth session - Status: {response.status_code}')
    if response.status_code == 200:
        data = response.json()
        session_id = data.get('session_id')
        print(f'Session ID: {session_id}')
        
        # Exchange session for token
        response2 = requests.post('http://localhost:8000/api/auth/session',
            json={'session_id': session_id},
            timeout=5
        )
        print(f'Exchange session - Status: {response2.status_code}')
        if response2.status_code == 200:
            user_data = response2.json()
            print(f'OAuth login successful!')
            print(f'User email: {user_data.get("user", {}).get("email")}')
        else:
            print(f'Error: {response2.json()}')
except Exception as e:
    print(f'Error: {e}')
