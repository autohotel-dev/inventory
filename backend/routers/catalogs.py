from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import uuid

from database import get_db
from models import Categories, Subcategories
from schemas.catalogs import (
    CategoryCreate, CategoryUpdate, CategoryResponse,
    SubcategoryCreate, SubcategoryUpdate, SubcategoryResponse
)

router = APIRouter(prefix="/catalogs", tags=["Catalogs"])

# --- Categories ---

@router.get("/categories", response_model=List[CategoryResponse])
def get_categories(db: Session = Depends(get_db)):
    """Listar todas las categorías principales"""
    return db.query(Categories).order_by(Categories.name).all()

@router.post("/categories", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(category: CategoryCreate, db: Session = Depends(get_db)):
    """Crear una nueva categoría"""
    db_category = Categories(**category.model_dump())
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category

@router.patch("/categories/{category_id}", response_model=CategoryResponse)
def update_category(category_id: uuid.UUID, category: CategoryUpdate, db: Session = Depends(get_db)):
    """Actualizar una categoría existente"""
    db_category = db.query(Categories).filter(Categories.id == category_id).first()
    if not db_category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    update_data = category.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_category, key, value)
        
    db.commit()
    db.refresh(db_category)
    return db_category

@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(category_id: uuid.UUID, db: Session = Depends(get_db)):
    """Eliminar una categoría"""
    db_category = db.query(Categories).filter(Categories.id == category_id).first()
    if not db_category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    db.delete(db_category)
    db.commit()
    return None

# --- Subcategories ---

@router.get("/subcategories", response_model=List[SubcategoryResponse])
def get_subcategories(category_id: uuid.UUID = None, db: Session = Depends(get_db)):
    """Listar subcategorías. Opcionalmente filtrar por category_id"""
    query = db.query(Subcategories)
    if category_id:
        query = query.filter(Subcategories.category_id == category_id)
    return query.order_by(Subcategories.name).all()

@router.post("/subcategories", response_model=SubcategoryResponse, status_code=status.HTTP_201_CREATED)
def create_subcategory(subcategory: SubcategoryCreate, db: Session = Depends(get_db)):
    """Crear una nueva subcategoría"""
    db_subcategory = Subcategories(**subcategory.model_dump())
    db.add(db_subcategory)
    db.commit()
    db.refresh(db_subcategory)
    return db_subcategory

@router.patch("/subcategories/{subcategory_id}", response_model=SubcategoryResponse)
def update_subcategory(subcategory_id: uuid.UUID, subcategory: SubcategoryUpdate, db: Session = Depends(get_db)):
    """Actualizar una subcategoría existente"""
    db_subcategory = db.query(Subcategories).filter(Subcategories.id == subcategory_id).first()
    if not db_subcategory:
        raise HTTPException(status_code=404, detail="Subcategory not found")
    
    update_data = subcategory.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_subcategory, key, value)
        
    db.commit()
    db.refresh(db_subcategory)
    return db_subcategory

@router.delete("/subcategories/{subcategory_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subcategory(subcategory_id: uuid.UUID, db: Session = Depends(get_db)):
    """Eliminar una subcategoría"""
    db_subcategory = db.query(Subcategories).filter(Subcategories.id == subcategory_id).first()
    if not db_subcategory:
        raise HTTPException(status_code=404, detail="Subcategory not found")
    
    db.delete(db_subcategory)
    db.commit()
    return None
