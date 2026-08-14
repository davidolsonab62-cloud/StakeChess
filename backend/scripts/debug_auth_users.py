import os
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv('.env')
client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]

async def main():
    admin = await db.users.find_one({'email': 'admin@stakechess.com'})
    print('admin:', admin and {k: v for k, v in admin.items() if k in ['user_id', 'email', 'username', 'password', 'is_admin']} or None)
    sample = await db.users.find_one({}, {'email': 1, 'user_id': 1, 'password': 1})
    print('sample:', sample)
    print('count:', await db.users.count_documents({}))

if __name__ == '__main__':
    asyncio.run(main())
