import asyncio
import uuid
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
import bcrypt

MONGO = "mongodb://127.0.0.1:27017"
DB_NAME = "stakechess"

async def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

async def main():
    client = AsyncIOMotorClient(MONGO)
    db = client[DB_NAME]

    demo_password = "DemoPass123!"
    users = []
    for i in range(1000):
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        username = f"demo_player_{i+1:04d}"
        email = f"{username}@example.com"
        hashed = await hash_password(demo_password)
        user_doc = {
            "user_id": user_id,
            "username": username,
            "email": email,
            "password": hashed,
            "rating": 1200,
            "games_played": 0,
            "wins": 0,
            "losses": 0,
            "draws": 0,
            "wallet_balance": {"USDT": 100.0},
            "created_at": datetime.now(timezone.utc).isoformat(),
            "is_admin": False,
            "is_flagged": False,
            "is_banned": False
        }
        users.append(user_doc)

    # Bulk insert in chunks
    chunk = 200
    for i in range(0, len(users), chunk):
        await db.users.insert_many(users[i:i+chunk])
        print(f"Inserted users {i+1}-{min(i+chunk, len(users))}")

    print("Done generating demo users")

if __name__ == '__main__':
    asyncio.run(main())
