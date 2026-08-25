"""Smoke tests for deployment fixes verification (iteration 26).

Verifies:
- httpx dependency added -> backend runs without ImportError
- Core public endpoints respond
- Auth flow (device + admin) works
- Admin config includes daily_challenge_* keys
"""
import os
import json
import pytest
import requests

BASE_URL = os.environ.get("EXPO_BACKEND_URL", "https://task-importer.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "93altaff@gmail.com"
ADMIN_PASSWORD = "9372@Altaf93"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def device_token(session):
    r = session.post(
        f"{BASE_URL}/api/auth/device",
        json={"device_id": "smoke-002", "fingerprint": "smoke"},
        timeout=30,
    )
    assert r.status_code == 200, f"device auth failed: {r.status_code} {r.text}"
    token = r.json().get("session_token")
    assert token, f"missing session_token in {r.json()}"
    return token


@pytest.fixture(scope="module")
def admin_token(session, device_token):
    r = session.post(
        f"{BASE_URL}/api/auth/admin-login",
        headers={"Authorization": f"Bearer {device_token}"},
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=30,
    )
    assert r.status_code == 200, f"admin-login failed: {r.status_code} {r.text}"
    # Admin promotion typically reuses the device token; return it.
    body = r.json()
    return body.get("session_token") or body.get("token") or device_token


# --- Public endpoints ---
def test_earn_cards(session):
    r = session.get(f"{BASE_URL}/api/earn-cards", timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    cards = data["cards"] if isinstance(data, dict) else data
    assert isinstance(cards, list), f"expected list, got {type(cards)}"
    assert len(cards) == 15, f"expected 15 cards, got {len(cards)}"


def test_banners(session):
    r = session.get(f"{BASE_URL}/api/banners", timeout=30)
    assert r.status_code == 200, r.text
    assert isinstance(r.json(), list)


def test_campaigns(session):
    r = session.get(f"{BASE_URL}/api/campaigns", timeout=30)
    assert r.status_code == 200, r.text
    assert isinstance(r.json(), list)


# --- Auth flow ---
def test_auth_device_and_me(session, device_token):
    r = session.get(
        f"{BASE_URL}/api/auth/me",
        headers={"Authorization": f"Bearer {device_token}"},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    user = r.json()
    assert isinstance(user, dict)
    # Must include user identifying fields
    assert any(k in user for k in ("id", "user_id", "device_id", "_id")), f"unexpected user shape: {user}"


def test_admin_login(admin_token):
    assert admin_token, "admin_token missing"


def test_admin_app_config(session, admin_token):
    r = session.get(
        f"{BASE_URL}/api/admin/app-config",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    cfg = r.json()
    for key in ("daily_challenge_common", "daily_challenge_uncommon", "daily_challenge_rare", "daily_challenge_jackpot"):
        assert key in cfg, f"missing key {key} in app-config: {list(cfg.keys())}"


def test_admin_earn_cards(session, admin_token):
    r = session.get(
        f"{BASE_URL}/api/admin/earn-cards",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    cards = data["cards"] if isinstance(data, dict) else data
    assert isinstance(cards, list)
    assert len(cards) == 15, f"expected 15 admin earn cards, got {len(cards)}"


# --- Config validity checks ---
def test_app_json_valid():
    with open("/app/frontend/app.json", "r") as f:
        cfg = json.load(f)
    info = cfg["expo"]["ios"]["infoPlist"]
    assert "NSPhotoLibraryUsageDescription" in info, f"missing NSPhotoLibraryUsageDescription: {info}"


def test_gitignore_no_env_lines():
    with open("/app/.gitignore", "r") as f:
        lines = [ln.rstrip("\n") for ln in f]
    bad = [ln for ln in lines if ln.strip().startswith(".env") or ln.strip().startswith("*.env")]
    assert not bad, f"unexpected .env lines still present: {bad}"


def test_requirements_has_httpx():
    with open("/app/backend/requirements.txt", "r") as f:
        lines = [ln.strip() for ln in f]
    assert any(ln.lower().startswith("httpx") for ln in lines), "httpx missing from requirements.txt"
