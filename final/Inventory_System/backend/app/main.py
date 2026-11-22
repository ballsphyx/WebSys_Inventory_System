import os, uuid
from datetime import datetime, timezone, date, timedelta
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, Response, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select, func
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
from .database import Base, engine, get_db
from .models import User, Product, Transaction
from .schemas import LoginInput, ProductCreate, ProductUpdate, ProductOut, TransactionCreate
from .security import hash_password, verify_password, create_session, require_user, COOKIE_NAME, COOKIE_SECURE, SESSION_SECONDS

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    from .database import SessionLocal
    email = os.getenv("ADMIN_EMAIL", "admin@example.com").strip().lower()
    password = os.getenv("ADMIN_PASSWORD")
    if not password or len(password) < 12:
        raise RuntimeError("Set ADMIN_PASSWORD in backend/.env to a password of at least 12 characters before starting.")
    with SessionLocal() as db:
        if db.scalar(select(User).limit(1)) is None:
            db.add(User(email=email, password_hash=hash_password(password)))
            db.commit()
    yield

app = FastAPI(title="Inventory System API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500", "http://localhost:5500",
        "http://127.0.0.1:5501", "http://localhost:5501",
        "http://127.0.0.1:8000", "http://localhost:8000",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

def stock_status(stock: int) -> str:
    return "Out of Stock" if stock <= 0 else "Low Stock" if stock <= 5 else "In Stock"

def product_dict(p: Product):
    return {"id": p.id, "name": p.name, "category": p.category, "price": p.price, "stock": p.stock, "image": p.image, "status": stock_status(p.stock)}

def transaction_dict(t: Transaction):
    return {"id": t.id, "product_id": t.product_id, "product": t.product_name, "category": t.category, "type": t.type, "quantity": t.quantity, "price": t.price, "change": t.stock_change, "stockStatus": stock_status(t.stock_after), "status": t.status, "date": t.date}

@app.get("/api/health")
def health(): return {"status": "ok"}

@app.post("/api/auth/login")
def login(data: LoginInput, response: Response, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == data.email.lower().strip()))
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    response.set_cookie(COOKIE_NAME, create_session(user.id), httponly=True, secure=COOKIE_SECURE, samesite="strict", max_age=SESSION_SECONDS, path="/")
    return {"authenticated": True, "email": user.email}

@app.get("/api/auth/me")
def me(user: User = Depends(require_user)):
    return {"authenticated": True, "email": user.email}

@app.post("/api/auth/logout")
def logout(response: Response, user: User = Depends(require_user)):
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"authenticated": False}

@app.get("/api/products")
def list_products(search: str | None = None, category: str | None = None, status: str | None = None, db: Session = Depends(get_db), user: User = Depends(require_user)):
    stmt = select(Product).order_by(Product.name)
    if search: stmt = stmt.where(Product.name.ilike(f"%{search}%"))
    if category: stmt = stmt.where(Product.category == category)
    products = [product_dict(p) for p in db.scalars(stmt).all()]
    return [p for p in products if not status or p["status"] == status]

@app.post("/api/products", status_code=201)
def create_product(data: ProductCreate, db: Session = Depends(get_db), user: User = Depends(require_user)):
    if db.scalar(select(Product).where(func.lower(Product.name) == data.name.strip().lower())):
        raise HTTPException(409, "A product with this name already exists")
    p = Product(id="PR-" + uuid.uuid4().hex[:10].upper(), name=data.name.strip(), category=data.category.strip(), price=data.price, stock=0, image=data.image)
    db.add(p); db.commit(); db.refresh(p)
    return product_dict(p)

@app.get("/api/products/{product_id}")
def get_product(product_id: str, db: Session = Depends(get_db), user: User = Depends(require_user)):
    p = db.get(Product, product_id)
    if not p: raise HTTPException(404, "Product not found")
    return product_dict(p)

@app.put("/api/products/{product_id}")
def update_product(product_id: str, data: ProductUpdate, db: Session = Depends(get_db), user: User = Depends(require_user)):
    p = db.get(Product, product_id)
    if not p: raise HTTPException(404, "Product not found")
    duplicate = db.scalar(select(Product).where(func.lower(Product.name) == data.name.strip().lower(), Product.id != product_id))
    if duplicate: raise HTTPException(409, "A product with this name already exists")
    p.name, p.category, p.price = data.name.strip(), data.category.strip(), data.price
    if data.image is not None: p.image = data.image
    db.commit(); db.refresh(p)
    return product_dict(p)

@app.delete("/api/products/{product_id}")
def delete_product(product_id: str, db: Session = Depends(get_db), user: User = Depends(require_user)):
    p = db.get(Product, product_id)
    if not p: raise HTTPException(404, "Product not found")
    if db.scalar(select(Transaction.id).where(Transaction.product_id == product_id).limit(1)):
        raise HTTPException(409, "Cannot delete a product with transaction history. Archive it instead.")
    db.delete(p); db.commit()
    return {"deleted": True, "id": product_id}

@app.get("/api/transactions")
def list_transactions(from_date: date | None = Query(None, alias="from"), to_date: date | None = Query(None, alias="to"), type: str | None = None, category: str | None = None, status: str | None = None, db: Session = Depends(get_db), user: User = Depends(require_user)):
    stmt = select(Transaction).order_by(Transaction.date.desc())
    if from_date: stmt = stmt.where(Transaction.date >= datetime.combine(from_date, datetime.min.time(), tzinfo=timezone.utc))
    if to_date: stmt = stmt.where(Transaction.date < datetime.combine(to_date + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc))
    if type: stmt = stmt.where(Transaction.type == type)
    if category: stmt = stmt.where(Transaction.category == category)
    if status: stmt = stmt.where(Transaction.status == status)
    return [transaction_dict(t) for t in db.scalars(stmt).all()]

@app.post("/api/transactions", status_code=201)
def create_transaction(data: TransactionCreate, db: Session = Depends(get_db), user: User = Depends(require_user)):
    p = db.scalar(select(Product).where(Product.id == data.product_id).with_for_update())
    if not p: raise HTTPException(404, "Product not found")
    before = p.stock
    if data.type == "In": after, change = before + data.quantity, data.quantity
    elif data.type == "Out":
        if data.quantity > before: raise HTTPException(422, f"Only {before} in stock; cannot take out {data.quantity}")
        after, change = before - data.quantity, -data.quantity
    else:
        after, change = data.quantity, data.quantity - before
    p.stock = after
    t = Transaction(id="TX-" + uuid.uuid4().hex[:10].upper(), product_id=p.id, product_name=p.name, category=p.category, type=data.type, quantity=data.quantity, price=data.price, stock_change=change, stock_after=after, status="Completed")
    db.add(t); db.commit(); db.refresh(t)
    return transaction_dict(t)

@app.put("/api/transactions/{transaction_id}")
def update_transaction(transaction_id: str, data: TransactionCreate, db: Session = Depends(get_db), user: User = Depends(require_user)):
    t = db.scalar(select(Transaction).where(Transaction.id == transaction_id).with_for_update())
    if not t: raise HTTPException(404, "Transaction not found")
    old_product = db.scalar(select(Product).where(Product.id == t.product_id).with_for_update())
    new_product = db.scalar(select(Product).where(Product.id == data.product_id).with_for_update())
    if not old_product or not new_product: raise HTTPException(404, "Product not found")
    # Restore the stock change made by the original transaction, then apply the edited one.
    old_product.stock -= t.stock_change
    before = new_product.stock
    if data.type == "In": after, change = before + data.quantity, data.quantity
    elif data.type == "Out":
        if data.quantity > before:
            db.rollback(); raise HTTPException(422, f"Only {before} in stock; cannot take out {data.quantity}")
        after, change = before - data.quantity, -data.quantity
    else: after, change = data.quantity, data.quantity - before
    new_product.stock = after
    t.product_id, t.product_name, t.category = new_product.id, new_product.name, new_product.category
    t.type, t.quantity, t.price, t.stock_change, t.stock_after = data.type, data.quantity, data.price, change, after
    db.commit(); db.refresh(t)
    return transaction_dict(t)

@app.get("/api/dashboard")
def dashboard(db: Session = Depends(get_db), user: User = Depends(require_user)):
    products = db.scalars(select(Product)).all()
    txs = db.scalars(select(Transaction).order_by(Transaction.date.desc()).limit(8)).all()
    return {"totalProducts": len(products), "totalStocks": sum(p.stock for p in products), "lowStocks": sum(0 < p.stock <= 5 for p in products), "outOfStocks": sum(p.stock == 0 for p in products), "inventoryValue": sum(p.stock * p.price for p in products), "lowStockItems": [product_dict(p) for p in products if 0 < p.stock <= 5], "recentTransactions": [transaction_dict(t) for t in txs]}

@app.get("/api/reports/summary")
def report_summary(from_date: date | None = Query(None, alias="from"), to_date: date | None = Query(None, alias="to"), db: Session = Depends(get_db), user: User = Depends(require_user)):
    stmt = select(Transaction).where(Transaction.type == "Out", Transaction.status == "Completed")
    if from_date: stmt = stmt.where(Transaction.date >= datetime.combine(from_date, datetime.min.time(), tzinfo=timezone.utc))
    if to_date: stmt = stmt.where(Transaction.date < datetime.combine(to_date + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc))
    sales = db.scalars(stmt).all()
    products = db.scalars(select(Product)).all()
    by_product = {}
    for t in sales:
        row = by_product.setdefault(t.product_name, {"product": t.product_name, "category": t.category, "itemsSold": 0, "revenue": 0})
        row["itemsSold"] += t.quantity; row["revenue"] += t.quantity * t.price
    return {"salesCount": len(sales), "itemsSold": sum(t.quantity for t in sales), "revenue": sum(t.quantity * t.price for t in sales), "inventoryValue": sum(p.stock * p.price for p in products), "topProducts": sorted(by_product.values(), key=lambda x: x["revenue"], reverse=True), "movements": [transaction_dict(t) for t in db.scalars(select(Transaction).order_by(Transaction.date.desc())).all()]}

# The frontend is a separate sibling directory and should be served independently
# (for example: python -m http.server 5500 from the frontend directory).
