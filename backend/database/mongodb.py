from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import OperationFailure
import os

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DATABASE_NAME = "kisaannavi"

client = AsyncIOMotorClient(MONGODB_URI)
db = client[DATABASE_NAME]

users_collection = db["users"]
conversations_collection = db["conversations"]
feedback_collection = db["feedback"]

async def init_db():
    db = client.kisaannavi
    
    await db.users.create_index("name", unique=True)
    try:
        await db.users.create_index("phone", unique=True, sparse=True, name="phone_1")
    except OperationFailure as e:
        # Existing deployments may already have phone_1 without sparse=True.
        # Drop and recreate the index to avoid startup failure.
        if e.code == 86:  # IndexKeySpecsConflict
            await db.users.drop_index("phone_1")
            await db.users.create_index("phone", unique=True, sparse=True, name="phone_1")
        else:
            raise
    await db.conversations.create_index("user_id")
    await db.conversations.create_index("created_at")
    await db.feedback.create_index("created_at")
    await db.feedback.create_index("feature")
    await db.feedback.create_index("user_id")
    
    print("Database initialized")

def get_database():
    return client.kisaannavi
