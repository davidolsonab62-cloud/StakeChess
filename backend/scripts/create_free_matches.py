import asyncio
import random
import uuid
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone

MONGO = "mongodb://127.0.0.1:27017"
DB_NAME = "stakechess"

async def main():
    client = AsyncIOMotorClient(MONGO)
    db = client[DB_NAME]

    users = await db.users.find({}).to_list(10000)
    demo_users = [u for u in users if u.get('email','').endswith('@example.com')]

    if len(demo_users) < 2:
        print("Not enough demo users to create matches")
        return

    # create 200 free lobby matches pairing random demo users
    matches = []
    for i in range(200):
        a, b = random.sample(demo_users, 2)
        game_id = f"game_{uuid.uuid4().hex[:12]}"
        game_doc = {
            "game_id": game_id,
            "white_player": {"user_id": a['user_id'], "username": a['username']},
            "black_player": {"user_id": b['user_id'], "username": b['username']},
            "fen": "start",
            "moves": [],
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "white_time": 600,
            "black_time": 600
        }
        matches.append(game_doc)

    await db.games.insert_many(matches)
    print(f"Created {len(matches)} free matches")

if __name__ == '__main__':
    asyncio.run(main())
