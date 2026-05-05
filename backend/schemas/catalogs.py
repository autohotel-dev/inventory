from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime
import uuid

# --- Categories ---
class CategoryBase(BaseModel):
    name: str
    description: Optional[str] = None

class CategoryCreate(CategoryBase):
    pass

class CategoryUpdate(CategoryBase):
    name: Optional[str] = None

class CategoryResponse(CategoryBase):
    id: uuid.UUID
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    
    model_config = ConfigDict(from_attributes=True)

# --- Subcategories ---
class SubcategoryBase(BaseModel):
    name: str
    description: Optional[str] = None
    is_active: Optional[bool] = True

class SubcategoryCreate(SubcategoryBase):
    category_id: uuid.UUID

class SubcategoryUpdate(SubcategoryBase):
    name: Optional[str] = None
    category_id: Optional[uuid.UUID] = None

class SubcategoryResponse(SubcategoryBase):
    id: uuid.UUID
    category_id: uuid.UUID
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    
    model_config = ConfigDict(from_attributes=True)
