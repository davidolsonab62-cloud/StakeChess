import requests
BASE = "http://127.0.0.1:8001"
try:
    r = requests.post(BASE + "/api/auth/login", json={"email": "admin@stakechess.com", "password": "admin123"}, timeout=10)
    print("login status", r.status_code)
    print("login body", r.text)
    if r.status_code == 200:
        token = r.json().get("access_token")
        h = {"Authorization": f"Bearer {token}"}
        q = requests.get(BASE + "/api/puzzles/next", headers=h, timeout=10)
        print("puzzle status", q.status_code)
        print("puzzle body", q.text[:2000])
except Exception as e:
    print("error", e)
