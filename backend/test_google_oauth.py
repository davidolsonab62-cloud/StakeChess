from fastapi.testclient import TestClient

from server import app

client = TestClient(app)


def test_google_start_falls_back_when_google_oauth_is_not_configured():
    response = client.get(
        "/api/auth/google/start",
        params={"redirect_uri": "http://localhost:3000/callback"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert "redirect_url" in payload
    assert "session_id=" in payload["redirect_url"]
