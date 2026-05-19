"""Iteration 14 backend smoke tests — verifies Round 13 endpoints still work
(referral-settings tiers + sharing_text round-trip; admin/version PUT, GET /api/version,
non-admin 403)."""
import os
import uuid
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


def _device_login():
    did = f"TEST_dev_{uuid.uuid4().hex[:12]}"
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE}/api/auth/device", json={"device_id": did})
    assert r.status_code == 200, r.text
    d = r.json()
    return d["session_token"], d["user"]["user_id"]


@pytest.fixture
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture
def user(api, db):
    tok, uid = _device_login()
    yield {"token": tok, "user_id": uid, "headers": {"Authorization": f"Bearer {tok}"}}
    db.users.delete_one({"user_id": uid})
    db.user_sessions.delete_one({"session_token": tok})


@pytest.fixture
def admin(api, db):
    tok, uid = _device_login()
    h = {"Authorization": f"Bearer {tok}"}
    r = api.post(f"{BASE}/api/auth/admin-login", headers=h,
                 json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    yield {"token": tok, "user_id": uid, "headers": h}
    db.users.delete_one({"user_id": uid})
    db.user_sessions.delete_one({"session_token": tok})


# Referral-settings round-trip with multi-tier + sharing_text
class TestReferralSettingsRoundTrip:
    def test_put_tiers_and_sharing_text_persists(self, api, admin):
        payload = {
            "streak_7_reward_points": 0,
            "streak_15_reward_points": 0,
            "tiers": [
                {"streak_days": 7, "points": 1000},
                {"streak_days": 15, "points": 2000},
                {"streak_days": 30, "points": 5000},
            ],
            "sharing_text": "Use code {code}",
        }
        r = api.put(f"{BASE}/api/admin/referral-settings", headers=admin["headers"], json=payload)
        assert r.status_code == 200, r.text

        g = api.get(f"{BASE}/api/admin/referral-settings", headers=admin["headers"])
        assert g.status_code == 200, g.text
        d = g.json()
        assert d.get("sharing_text") == "Use code {code}"
        tiers = d.get("tiers") or []
        # ensure all three tiers present
        for want in payload["tiers"]:
            assert any(int(t.get("streak_days", 0)) == want["streak_days"]
                       and int(t.get("points", 0)) == want["points"] for t in tiers), \
                f"Tier {want} not found in {tiers}"


# Admin version PUT + GET /api/version reflection + non-admin 403
class TestAdminVersion:
    def test_put_then_public_version_reflects(self, api, admin):
        new = {
            "latest_version": "1.2.0",
            "min_supported_version": "1.0.0",
            "play_store_url": "https://play.google.com/store/apps/details?id=com.taskmint.app",
            "force_update": True,
            "release_notes": "Bug fixes",
        }
        r = api.put(f"{BASE}/api/admin/version", headers=admin["headers"], json=new)
        assert r.status_code == 200, r.text

        pub = api.get(f"{BASE}/api/version")
        assert pub.status_code == 200
        d = pub.json()
        assert d["latest_version"] == "1.2.0"
        assert d["force_update"] is True
        # release_notes should also flow back if exposed
        if "release_notes" in d:
            assert d["release_notes"] == "Bug fixes"

        # restore safe defaults so frontend smoke (UpdateGate) doesn't trigger
        api.put(f"{BASE}/api/admin/version", headers=admin["headers"], json={
            "latest_version": "1.0.0",
            "min_supported_version": "1.0.0",
            "play_store_url": "https://play.google.com/store/apps/details?id=com.taskmint.app",
            "force_update": False,
            "release_notes": "",
        })

    def test_non_admin_put_403(self, api, user):
        r = api.put(f"{BASE}/api/admin/version", headers=user["headers"], json={
            "latest_version": "9.9.9", "min_supported_version": "1.0.0",
            "play_store_url": "", "force_update": False, "release_notes": ""
        })
        assert r.status_code == 403, r.text
