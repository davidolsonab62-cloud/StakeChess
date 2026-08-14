from motor.motor_asyncio import AsyncIOMotorClient
import asyncio
import os
from pathlib import Path
from dotenv import load_dotenv
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')
client = AsyncIOMotorClient(os.environ['MONGO_URL'])

async def main():
    db = client[os.environ['DB_NAME']]
    users = await db.users.find({}, {'_id': 0, 'email': 1, 'username': 1}).to_list(100)
    print('DB', os.environ['DB_NAME'])
    print('users', users)
    print('count', await db.users.count_documents({}))

asyncio.run(main())
