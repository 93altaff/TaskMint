import os
import time
import uuid
import pytest
import requests
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient
from dotenv import dotenv_values

_FE_ENV = dotenv_values("/app/frontend/.env")
_BE_ENV = dotenv_values("/app/backend/.env")

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL")
            or _FE_ENV.get("EXPO_PUBLIC_BACKEND_URL")
            or "http://localhost:8001").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL") or _BE_ENV.get("MONGO_URL") or "mongodb://localhost:27017"
DB_NAME = os.environ.get("DB_NAME") or _BE_ENV.get("DB_NAME") or "test_database"


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def mongo_db():
    c = MongoClient(MONGO_URL)
    return c[DB_NAME]


def _create_user(mongo_db, email, is_admin=False, points=5000, has_first_withdrawal=False):
    user_id = f"user_TEST_{uuid.uuid4().hex[:10]}"
    token = f"TEST_tok_{uuid.uuid4().hex[:16]}"
    mongo_db.users.insert_one({
        "user_id": user_id,
        "email": email,
        "name": "TEST User",
        "picture": "",
        "points": points,
        "total_earned": points,
        "total_tasks": 0,
        "streak": 0,
        "daily_spins_used": 0,
        "daily_scratches_used": 0,
        "has_first_withdrawal": has_first_withdrawal,
        "is_admin": is_admin,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    mongo_db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc),
    })
    return user_id, token


@pytest.fixture
def admin_session(mongo_db):
    user_id, token = _create_user(mongo_db, f"TEST_admin_{int(time.time()*1000)}@example.com", is_admin=True)
    yield {"user_id": user_id, "token": token, "headers": {"Authorization": f"Bearer {token}"}}
    mongo_db.users.delete_one({"user_id": user_id})
    mongo_db.user_sessions.delete_one({"session_token": token})
    mongo_db.transactions.delete_many({"user_id": user_id})
    mongo_db.withdrawals.delete_many({"user_id": user_id})


@pytest.fixture
def user_session(mongo_db):
    user_id, token = _create_user(mongo_db, f"TEST_user_{int(time.time()*1000)}_{uuid.uuid4().hex[:4]}@example.com")
    yield {"user_id": user_id, "token": token, "headers": {"Authorization": f"Bearer {token}"}}
    mongo_db.users.delete_one({"user_id": user_id})
    mongo_db.user_sessions.delete_one({"session_token": token})
    mongo_db.transactions.delete_many({"user_id": user_id})
    mongo_db.withdrawals.delete_many({"user_id": user_id})


@pytest.fixture
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s
