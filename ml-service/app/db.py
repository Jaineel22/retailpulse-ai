"""
Thin MongoDB accessor, mirroring backend/src/config/db.js's role on the Node
side. Deliberately does not define a duplicate Product/Order/Inventory model —
the ML service only ever reads the `inventoryevents` collection (Mongoose's
default pluralized collection name for the `InventoryEvent` model).
"""

from functools import lru_cache

from pymongo import MongoClient
from pymongo.database import Database

from app.config import MONGODB_URI


@lru_cache(maxsize=1)
def get_database() -> Database:
    client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
    return client.get_default_database()
