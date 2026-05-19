"""Iteration 15 backend tests:
1) POST /api/auth/admin-logout — demote device-user from admin while keeping session valid
2) GET /api/admin/users?q=<name> — name + mobile only (no user_id/email match)
"""
import os
import uuid
import time
from datetime import datetime, timezone, timedelta
import pytest
import requests
from pymongo import MongoClient
from dotenv import dotenv_values

_FE = dotenv_values("/app/frontend/.env")
_BE = dotenv_values("/app/backend/.env")
BASE = (os.environ.get("EXPO_PUBLIC_BACKEND_URL")
        or _FE.get("EXPO_PUBLIC_BACKEND_URL")).rstrip("/")
MONGO = os.environ.get("MONGO_URL") or _BE.get("MONGO_URL")
DBN = os.environ.get("DB_NAME") or _BE.get("DB_NAME")

ADMIN_EMAIL = "93altaff@gmail.com"
ADMIN_PASS = "9372@Altaf93"


@pytest.fixture(scope="session")
def db():
    return MongoClient(MONGO)[DBN]


@pytest.fixture
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _fresh_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _device_login_fresh():
    """Use a brand-new requests.Session so cookies do not pollute callers."""
    s = _fresh_session()
    did = f"TEST_dev_{uuid.uuid4().hex[:12]}"
    r = s.post(f"{BASE}/api/auth/device", json={"device_id": did})
    assert r.status_code == 200, r.text
    d = r.json()
    return d["session_token"], d["user"]["user_id"]


def _seed_db_user(db, name="TEST_user", email=None, mobile=None):
    """Insert a user directly + a session token, no HTTP cookie side-effects."""
    user_id = f"user_TEST_{uuid.uuid4().hex[:10]}"
    token = f"TESTtok_{uuid.uuid4().hex[:16]}"
    doc = {
        "user_id": user_id,
        "device_id": f"TEST_dev_{uuid.uuid4().hex[:8]}",
        "email": email,
        "name": name,
        "picture": None,
        "points": 0,
        "total_earned": 0,
        "total_withdrawn": 0,
        "total_tasks": 0,
        "streak": 0,
        "is_admin": False,
        "mobile_number": mobile,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    db.users.insert_one(doc)
    db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc),
    })
    return user_id, token


@pytest.fixture
def admin(api, db):
    """Promote a fresh device user via the password endpoint."""
    tok, uid = _device_login_fresh()
    h = {"Authorization": f"Bearer {tok}"}
    # Use a clean session for admin-login too — avoid cookie carry-over into `api`.
    s = _fresh_session()
    r = s.post(f"{BASE}/api/auth/admin-login", headers=h,
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    yield {"token": tok, "user_id": uid, "headers": h}
    db.users.delete_one({"user_id": uid})
    db.user_sessions.delete_one({"session_token": tok})


# ---------------- 1) Admin Logout ----------------
class TestAdminLogout:
    def test_admin_logout_demotes_but_keeps_session(self, api, admin):
        # /api/auth/me returns user dict (flat, not wrapped)
        me1 = api.get(f"{BASE}/api/auth/me", headers=admin["headers"])
        assert me1.status_code == 200, me1.text
        assert me1.json().get("is_admin") is True, \
            f"Expected is_admin=True before logout, got {me1.json()}"

        r = api.post(f"{BASE}/api/auth/admin-logout", headers=admin["headers"])
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert body.get("user", {}).get("is_admin") is False
        assert body.get("user", {}).get("admin_session_expires_at") in (None, "")

        # Session still valid
        me2 = api.get(f"{BASE}/api/auth/me", headers=admin["headers"])
        assert me2.status_code == 200, me2.text
        assert me2.json().get("is_admin") is False

        # Admin endpoints now reject
        ru = api.get(f"{BASE}/api/admin/users", headers=admin["headers"])
        assert ru.status_code in (401, 403), \
            f"Expected admin endpoint to deny after logout, got {ru.status_code}: {ru.text}"

    def test_admin_logout_requires_auth(self, api):
        r = api.post(f"{BASE}/api/auth/admin-logout")
        assert r.status_code in (401, 403), r.text


# ---------------- 2) Admin User Search ----------------
class TestAdminUsersSearch:
    def test_search_by_user_id_returns_empty(self, admin, db):
        # Seed a user directly (no cookie pollution)
        unique_name = f"Bob_{uuid.uuid4().hex[:6]}"
        uid2, tok2 = _seed_db_user(db, name=unique_name)
        try:
            uid_sub = uid2[5:15]  # substring of user_id
            # Use a clean session — admin headers still pass via Bearer
            s = _fresh_session()
            r = s.get(f"{BASE}/api/admin/users",
                      headers=admin["headers"], params={"q": uid_sub})
            assert r.status_code == 200, r.text
            ids = [u.get("user_id") for u in r.json()]
            assert uid2 not in ids, \
                f"Search by user_id substring '{uid_sub}' should NOT return {uid2}"
        finally:
            db.users.delete_one({"user_id": uid2})
            db.user_sessions.delete_one({"session_token": tok2})

    def test_search_by_name_substring_matches(self, admin, db):
        marker = uuid.uuid4().hex[:6]
        full_name = f"TESTNAME_{marker}_Smith"
        uid2, tok2 = _seed_db_user(db, name=full_name)
        try:
            s = _fresh_session()
            r = s.get(f"{BASE}/api/admin/users",
                      headers=admin["headers"], params={"q": marker})
            assert r.status_code == 200, r.text
            ids = [u.get("user_id") for u in r.json()]
            assert uid2 in ids, \
                f"Search by name '{marker}' should return {uid2}, got {ids[:5]}"
        finally:
            db.users.delete_one({"user_id": uid2})
            db.user_sessions.delete_one({"session_token": tok2})

    def test_search_by_mobile_substring_matches(self, admin, db):
        mobile = f"9{int(time.time()*1000) % 1_000_000_000:09d}"
        uid2, tok2 = _seed_db_user(db, name="UnrelatedName", mobile=mobile)
        try:
            sub = mobile[2:8]
            s = _fresh_session()
            r = s.get(f"{BASE}/api/admin/users",
                      headers=admin["headers"], params={"q": sub})
            assert r.status_code == 200, r.text
            ids = [u.get("user_id") for u in r.json()]
            assert uid2 in ids, \
                f"Search by mobile '{sub}' should return {uid2}, got {ids[:5]}"
        finally:
            db.users.delete_one({"user_id": uid2})
            db.user_sessions.delete_one({"session_token": tok2})

    def test_search_by_email_substring_returns_empty(self, admin, db):
        marker = uuid.uuid4().hex[:8]
        email = f"TESTONLY_{marker}@example.com"
        uid2, tok2 = _seed_db_user(db, name="Charlie", email=email)
        try:
            s = _fresh_session()
            r = s.get(f"{BASE}/api/admin/users",
                      headers=admin["headers"], params={"q": marker})
            assert r.status_code == 200, r.text
            ids = [u.get("user_id") for u in r.json()]
            assert uid2 not in ids, \
                f"Search by email '{marker}' should NOT return {uid2}"
        finally:
            db.users.delete_one({"user_id": uid2})
            db.user_sessions.delete_one({"session_token": tok2})
