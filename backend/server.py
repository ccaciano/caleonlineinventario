from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from bson import ObjectId

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Helper function to serialize ObjectId
def serialize_doc(doc):
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc

# Models
class StoreConfig(BaseModel):
    store_id: str
    store_name: str
    email: str
    manager_phone: str
    manager_name: str

class InventoryCreate(BaseModel):
    description: str
    date: str

class Inventory(BaseModel):
    id: Optional[str] = None
    description: str
    date: str
    status: str = "open"  # open or closed
    created_at: datetime = Field(default_factory=datetime.utcnow)

class CountedItemCreate(BaseModel):
    product_code: str
    quantity: int
    lot: str
    expiry_date: str

class CountedItem(BaseModel):
    id: Optional[str] = None
    inventory_id: str
    product_code: str
    quantity: int
    lot: str
    expiry_date: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class CountedItemUpdate(BaseModel):
    product_code: Optional[str] = None
    quantity: Optional[int] = None
    lot: Optional[str] = None
    expiry_date: Optional[str] = None

# Store Configuration Endpoints
@api_router.post("/store/config")
async def save_store_config(config: StoreConfig):
    config_dict = config.dict()
    # Upsert - update if exists, insert if not
    result = await db.store_config.update_one(
        {},
        {"$set": config_dict},
        upsert=True
    )
    return {"success": True, "message": "Store configuration saved"}

@api_router.get("/store/config")
async def get_store_config():
    config = await db.store_config.find_one()
    if not config:
        return None
    return serialize_doc(config)

# Inventory Endpoints
@api_router.get("/inventories")
async def get_inventories():
    inventories = await db.inventories.find().sort("created_at", -1).to_list(1000)
    for inv in inventories:
        serialize_doc(inv)
        # Count items for each inventory
        inv["item_count"] = await db.counted_items.count_documents({"inventory_id": str(inv["_id"])})
    return inventories

@api_router.post("/inventories")
async def create_inventory(inventory: InventoryCreate):
    inventory_dict = inventory.dict()
    inventory_dict["status"] = "open"
    inventory_dict["created_at"] = datetime.utcnow()
    result = await db.inventories.insert_one(inventory_dict)
    inventory_dict["_id"] = str(result.inserted_id)
    return serialize_doc(inventory_dict)

@api_router.get("/inventories/{inventory_id}")
async def get_inventory(inventory_id: str):
    try:
        inventory = await db.inventories.find_one({"_id": ObjectId(inventory_id)})
        if not inventory:
            raise HTTPException(status_code=404, detail="Inventory not found")
        return serialize_doc(inventory)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.put("/inventories/{inventory_id}/close")
async def close_inventory(inventory_id: str):
    try:
        result = await db.inventories.update_one(
            {"_id": ObjectId(inventory_id)},
            {"$set": {"status": "closed"}}
        )
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Inventory not found")
        return {"success": True, "message": "Inventory closed"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# Counted Items Endpoints
@api_router.get("/inventories/{inventory_id}/items")
async def get_counted_items(inventory_id: str):
    items = await db.counted_items.find({"inventory_id": inventory_id}).sort("created_at", -1).to_list(1000)
    return [serialize_doc(item) for item in items]

@api_router.post("/inventories/{inventory_id}/items")
async def add_counted_item(inventory_id: str, item: CountedItemCreate):
    # Check if inventory exists and is open
    try:
        inventory = await db.inventories.find_one({"_id": ObjectId(inventory_id)})
        if not inventory:
            raise HTTPException(status_code=404, detail="Inventory not found")
        if inventory.get("status") == "closed":
            raise HTTPException(status_code=400, detail="Cannot add items to closed inventory")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    item_dict = item.dict()
    item_dict["inventory_id"] = inventory_id
    item_dict["created_at"] = datetime.utcnow()
    result = await db.counted_items.insert_one(item_dict)
    item_dict["_id"] = str(result.inserted_id)
    return serialize_doc(item_dict)

@api_router.put("/inventories/{inventory_id}/items/{item_id}")
async def update_counted_item(inventory_id: str, item_id: str, item: CountedItemUpdate):
    try:
        update_data = {k: v for k, v in item.dict().items() if v is not None}
        if not update_data:
            raise HTTPException(status_code=400, detail="No data to update")
        
        result = await db.counted_items.update_one(
            {"_id": ObjectId(item_id), "inventory_id": inventory_id},
            {"$set": update_data}
        )
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Item not found")
        
        updated_item = await db.counted_items.find_one({"_id": ObjectId(item_id)})
        return serialize_doc(updated_item)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.delete("/inventories/{inventory_id}/items/{item_id}")
async def delete_counted_item(inventory_id: str, item_id: str):
    try:
        result = await db.counted_items.delete_one(
            {"_id": ObjectId(item_id), "inventory_id": inventory_id}
        )
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Item not found")
        return {"success": True, "message": "Item deleted"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/inventories/{inventory_id}/export")
async def get_export_data(inventory_id: str):
    try:
        # Get store config
        store = await db.store_config.find_one()
        
        # Get inventory
        inventory = await db.inventories.find_one({"_id": ObjectId(inventory_id)})
        if not inventory:
            raise HTTPException(status_code=404, detail="Inventory not found")
        
        # Get counted items
        items = await db.counted_items.find({"inventory_id": inventory_id}).to_list(1000)
        
        return {
            "store": serialize_doc(store) if store else None,
            "inventory": serialize_doc(inventory),
            "items": [serialize_doc(item) for item in items]
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
