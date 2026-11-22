import base64, hashlib, hmac, json, os, secrets, time
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session
from .database import get_db
from .models import User

SECRET = os.getenv("APP_SECRET_KEY", "development-only-change-me")
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"
COOKIE_NAME = "inventory_session"
SESSION_SECONDS = 60 * 60 * 12

def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 310_000)
    return "pbkdf2_sha256$310000$" + base64.urlsafe_b64encode(salt).decode() + "$" + base64.urlsafe_b64encode(digest).decode()

def verify_password(password: str, encoded: str) -> bool:
    try:
        scheme, rounds, salt_b64, hash_b64 = encoded.split("$")
        if scheme != "pbkdf2_sha256": return False
        salt = base64.urlsafe_b64decode(salt_b64)
        expected = base64.urlsafe_b64decode(hash_b64)
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, int(rounds))
        return hmac.compare_digest(actual, expected)
    except Exception:
        return False

def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

def create_session(user_id: int) -> str:
    payload = _b64(json.dumps({"sub": user_id, "exp": int(time.time()) + SESSION_SECONDS}).encode())
    signature = _b64(hmac.new(SECRET.encode(), payload.encode(), hashlib.sha256).digest())
    return payload + "." + signature

def read_session(token: str):
    try:
        payload, signature = token.split(".")
        expected = _b64(hmac.new(SECRET.encode(), payload.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(signature, expected): return None
        data = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
        if data["exp"] < time.time(): return None
        return int(data["sub"])
    except Exception:
        return None

def require_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get(COOKIE_NAME)
    user_id = read_session(token) if token else None
    user = db.get(User, user_id) if user_id else None
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user
