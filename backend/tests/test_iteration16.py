"""Iteration 16 backend tests.

Covers:
1) GET  /api/admob-settings                  -> public, returns defaults / persisted values
2) GET  /api/admin/admob-settings            -> requires admin Bearer
3) PUT  /api/admin/admob-settings            -> requires admin Bearer, persists payload
4) GET  /api/admin/users?active=1            -> only users with last_activity_date == today;
                                                each item carries referrals_count
5) GET  /api/admin/users/{user_id}           -> includes referrals_count
6) GET  /api/admin/users/{id}/referrals      -> JSON array
7) GET  /api/admin/users/{id}/transactions   -> JSON array
8) Smoke checks for previously-existing endpoints still 2xx:
   /api/auth/me, /api/banners, /api/campaigns, /api/links, /api/withdraw-settings
"""
import os
import uuid
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


# ---------------- Fixtures ----------------
@pytest.fixture(scope="session")
def db():
    return MongoClient(MONGO)[DBN]


@pytest.fixture
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _device_login(api):
    """Create a fresh device session and return the bearer token + user_id."""
    device_id = f"TEST-dev-{uuid.uuid4().hex[:14]}"
    r = api.post(f"{BASE}/api/auth/device", json={"device_id": device_id})
    assert r.status_code == 200, f"device login failed: {r.status_code} {r.text}"
    body = r.json()
    return body["session_token"], body["user"]["user_id"], device_id


@pytest.fixture
def admin_token(api, db):
    """Promote a device session to admin and clean up the user after the test."""
    token, user_id, device_id = _device_login(api)
    r = api.post(
        f"{BASE}/api/auth/admin-login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASS},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200, f"admin-login failed: {r.status_code} {r.text}"
    yield token
    # Best effort cleanup
    db.user_sessions.delete_one({"session_token": token})
    db.users.delete_one({"user_id": user_id})


@pytest.fixture
def user_token(api, db):
    token, user_id, device_id = _device_login(api)
    yield {"token": token, "user_id": user_id, "device_id": device_id}
    db.user_sessions.delete_one({"session_token": token})
    db.users.delete_one({"user_id": user_id})


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


# ---------------- AdMob settings ----------------
class TestAdMobSettings:
    def test_public_get_returns_keys(self, api):
        r = api.get(f"{BASE}/api/admob-settings")
        assert r.status_code == 200, r.text
        data = r.json()
        for key in (
            "android_app_id",
            "banner_unit_id",
            "interstitial_unit_id",
            "rewarded_unit_id",
            "native_unit_id",
        ):
            assert key in data, f"missing key {key} in {data}"
            assert isinstance(data[key], str) and data[key], f"{key} must be a non-empty string"

    def test_admin_get_requires_auth(self, api):
        r = api.get(f"{BASE}/api/admin/admob-settings")
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code} {r.text}"

    def test_admin_put_requires_auth(self, api):
        r = api.put(
            f"{BASE}/api/admin/admob-settings",
            json={
                "android_app_id": "ca-app-pub-0000000000000000~0000000000",
                "banner_unit_id": "ca-app-pub-0000000000000000/0000000000",
                "interstitial_unit_id": "ca-app-pub-0000000000000000/0000000000",
                "rewarded_unit_id": "ca-app-pub-0000000000000000/0000000000",
                "native_unit_id": "ca-app-pub-0000000000000000/0000000000",
            },
        )
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code} {r.text}"

    def test_admin_put_persists_and_public_reflects(self, api, admin_token, db):
        # Snapshot existing settings so we can restore them.
        original = db.app_settings.find_one({"_id": "admob"}) or None

        marker = uuid.uuid4().hex[:8]
        payload = {
            "android_app_id": f"ca-app-pub-TEST~{marker}",
            "banner_unit_id": f"ca-app-pub-TEST/banner-{marker}",
            "interstitial_unit_id": f"ca-app-pub-TEST/inter-{marker}",
            "rewarded_unit_id": f"ca-app-pub-TEST/rew-{marker}",
            "native_unit_id": f"ca-app-pub-TEST/nat-{marker}",
        }

        try:
            r = api.put(
                f"{BASE}/api/admin/admob-settings",
                json=payload, headers=_auth(admin_token),
            )
            assert r.status_code == 200, r.text
            saved = r.json()
            for k, v in payload.items():
                assert saved[k] == v

            # Admin GET reflects new values
            r2 = api.get(f"{BASE}/api/admin/admob-settings", headers=_auth(admin_token))
            assert r2.status_code == 200
            for k, v in payload.items():
                assert r2.json()[k] == v

            # Public GET also reflects
            r3 = api.get(f"{BASE}/api/admob-settings")
            assert r3.status_code == 200
            for k, v in payload.items():
                assert r3.json()[k] == v
        finally:
            # Restore
            if original is None:
                db.app_settings.delete_one({"_id": "admob"})
            else:
                clean = {k: v for k, v in original.items() if k != "_id"}
                db.app_settings.update_one(
                    {"_id": "admob"}, {"$set": clean}, upsert=True
                )


# ---------------- Admin users (active filter + referrals_count) ----------------
class TestAdminUsers:
    def test_active_filter_includes_today_and_excludes_others(self, api, admin_token, db):
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        yesterday = (datetime.now(timezone.utc) - timedelta(days=2)).strftime("%Y-%m-%d")

        active_uid = f"user_TEST_active_{uuid.uuid4().hex[:8]}"
        inactive_uid = f"user_TEST_inactive_{uuid.uuid4().hex[:8]}"

        # Insert one active-today user and one inactive user
        db.users.insert_one({
            "user_id": active_uid,
            "name": "TEST_ActiveToday",
            "email": f"{active_uid}@t.local",
            "points": 0,
            "is_admin": False,
            "last_activity_date": today,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        db.users.insert_one({
            "user_id": inactive_uid,
            "name": "TEST_NotActive",
            "email": f"{inactive_uid}@t.local",
            "points": 0,
            "is_admin": False,
            "last_activity_date": yesterday,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

        try:
            r = api.get(
                f"{BASE}/api/admin/users",
                params={"active": "1"},
                headers=_auth(admin_token),
            )
            assert r.status_code == 200, r.text
            items = r.json()
            assert isinstance(items, list)

            ids = {u.get("user_id") for u in items}
            assert active_uid in ids, "active-today user must appear"
            assert inactive_uid not in ids, "inactive user must NOT appear when active=1"

            # Every returned user must carry referrals_count (int)
            for u in items:
                assert "referrals_count" in u, f"missing referrals_count in {u.get('user_id')}"
                assert isinstance(u["referrals_count"], int)
                # last_activity_date for ALL must be today
                assert u.get("last_activity_date") == today
        finally:
            db.users.delete_one({"user_id": active_uid})
            db.users.delete_one({"user_id": inactive_uid})

    def test_user_detail_has_referrals_count(self, api, admin_token, db):
        owner_uid = f"user_TEST_owner_{uuid.uuid4().hex[:8]}"
        ref1 = f"user_TEST_ref1_{uuid.uuid4().hex[:8]}"
        ref2 = f"user_TEST_ref2_{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc).isoformat()
        db.users.insert_many([
            {"user_id": owner_uid, "name": "TEST_Owner", "email": f"{owner_uid}@t.l",
             "points": 0, "is_admin": False, "created_at": now},
            {"user_id": ref1, "name": "TEST_Ref1", "email": f"{ref1}@t.l",
             "points": 0, "is_admin": False, "referred_by": owner_uid, "created_at": now},
            {"user_id": ref2, "name": "TEST_Ref2", "email": f"{ref2}@t.l",
             "points": 0, "is_admin": False, "referred_by": owner_uid, "created_at": now},
        ])
        try:
            r = api.get(f"{BASE}/api/admin/users/{owner_uid}", headers=_auth(admin_token))
            assert r.status_code == 200, r.text
            data = r.json()
            assert data["user_id"] == owner_uid
            assert data.get("referrals_count") == 2, data

            # /referrals returns the right rows
            rr = api.get(
                f"{BASE}/api/admin/users/{owner_uid}/referrals",
                headers=_auth(admin_token),
            )
            assert rr.status_code == 200
            refs = rr.json()
            assert isinstance(refs, list)
            ids = {x.get("user_id") for x in refs}
            assert ref1 in ids and ref2 in ids
            for row in refs:
                assert "name" in row and "streak" in row and "joined_at" in row

            # /transactions returns a list (likely empty)
            tx = api.get(
                f"{BASE}/api/admin/users/{owner_uid}/transactions",
                headers=_auth(admin_token),
            )
            assert tx.status_code == 200
            assert isinstance(tx.json(), list)
        finally:
            db.users.delete_many({"user_id": {"$in": [owner_uid, ref1, ref2]}})

    def test_admin_users_admin_required(self, api):
        # No auth header at all
        r = api.get(f"{BASE}/api/admin/users", params={"active": "1"})
        assert r.status_code in (401, 403), r.text


# ---------------- Smoke for previously-existing endpoints ----------------
class TestSmokePreviousEndpoints:
    def test_auth_me(self, api, user_token):
        r = api.get(f"{BASE}/api/auth/me", headers=_auth(user_token["token"]))
        assert r.status_code == 200, r.text
        body = r.json()
        # auth/me typically returns user dict
        assert body.get("user_id") == user_token["user_id"] or body.get("user", {}).get("user_id") == user_token["user_id"]

    def test_banners(self, api):
        r = api.get(f"{BASE}/api/banners")
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)

    def test_campaigns(self, api, user_token):
        # campaigns may or may not require auth; try authed first, fallback unauth'd
        r = api.get(f"{BASE}/api/campaigns", headers=_auth(user_token["token"]))
        if r.status_code in (401, 403):
            r = api.get(f"{BASE}/api/campaigns")
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)

    def test_links(self, api):
        r = api.get(f"{BASE}/api/links")
        assert r.status_code == 200, r.text
        body = r.json()
        # /api/links returns the social/links config object (dict)
        assert isinstance(body, dict)
        assert "privacy_policy" in body

    def test_withdraw_settings(self, api):
        r = api.get(f"{BASE}/api/withdraw-settings")
        assert r.status_code == 200, r.text
        body = r.json()
        assert isinstance(body, dict)
