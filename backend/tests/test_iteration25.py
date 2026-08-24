"""
Iteration 25 backend verification for bugs:
  5a) Admin > Banners: title/subtitle now optional
  5b) Admin > Offerwall Campaigns: pin flag persists + GET /api/campaigns sorts pinned first
  5c) Admin > Game Rewards: daily_challenge_* config keys + PUT persistence
"""

import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://task-importer.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "93altaff@gmail.com"
ADMIN_PASSWORD = "9372@Altaf93"


@pytest.fixture(scope="module")
def admin_token():
    """Device login -> promote to admin -> return session token."""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    dev = s.post(
        f"{BASE_URL}/api/auth/device",
        json={"device_id": f"iter25-{uuid.uuid4().hex[:10]}", "fingerprint": "web"},
        timeout=20,
    )
    assert dev.status_code == 200, f"device login failed: {dev.status_code} {dev.text}"
    token = dev.json().get("session_token")
    assert token, "no session_token"
    promote = s.post(
        f"{BASE_URL}/api/auth/admin-login",
        headers={"Authorization": f"Bearer {token}"},
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=20,
    )
    assert promote.status_code == 200, f"admin promote failed: {promote.status_code} {promote.text}"
    return token


@pytest.fixture
def client(admin_token):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {admin_token}"})
    return s


# ------------------------- 5a: Banners title/subtitle optional -------------------------
class TestBannerOptionalFields:
    def test_create_banner_without_title_and_subtitle(self, client):
        image_url = f"https://picsum.photos/seed/iter25-{uuid.uuid4().hex[:6]}/400"
        payload = {"image_url": image_url, "title": "", "subtitle": "", "active": True}
        r = client.post(f"{BASE_URL}/api/admin/banners", json=payload, timeout=20)
        assert r.status_code == 200, f"POST /api/admin/banners: {r.status_code} {r.text}"
        created = r.json()
        assert "id" in created, f"missing id in create response: {created}"
        bid = created["id"]
        assert created.get("title", "") == ""
        assert created.get("subtitle", "") == ""
        assert created.get("image_url") == image_url

        # Verify visible in GET /api/banners (public list)
        gl = client.get(f"{BASE_URL}/api/banners", timeout=20)
        assert gl.status_code == 200
        found = next((b for b in gl.json() if b.get("id") == bid), None)
        assert found is not None, "created banner not returned in /api/banners"
        assert found.get("title", "") == ""

        # Cleanup
        d = client.delete(f"{BASE_URL}/api/admin/banners/{bid}", timeout=20)
        assert d.status_code == 200, f"delete failed: {d.status_code} {d.text}"


# ------------------------- 5b: Campaign pin flag -------------------------
class TestCampaignPin:
    def test_pin_campaign_and_verify_sort(self, client):
        # Create campaign
        name = f"TEST_iter25_{uuid.uuid4().hex[:6]}"
        payload = {
            "name": name,
            "note": "iter25 pin test",
            "logo_url": "https://picsum.photos/seed/iter25c/200",
            "reward_points": 100,
        }
        c = client.post(f"{BASE_URL}/api/admin/campaigns", json=payload, timeout=20)
        assert c.status_code == 200, f"create campaign: {c.status_code} {c.text}"
        cid = c.json().get("id")
        assert cid, f"no campaign id: {c.json()}"

        try:
            # Toggle pinned via PUT (send full body — API requires the full Campaign model)
            full = dict(c.json())
            full["pinned"] = True
            # strip server-managed id if present in path
            full.pop("id", None)
            put = client.put(
                f"{BASE_URL}/api/admin/campaigns/{cid}",
                json=full,
                timeout=20,
            )
            assert put.status_code == 200, f"pin PUT: {put.status_code} {put.text}"
            # Some PUT endpoints return {"ok": true} — accept that and verify via GET instead
            body = put.json()
            if "pinned" in body:
                assert body.get("pinned") is True, f"pinned not true in response: {body}"

            # GET /api/campaigns should return the pinned one first
            gl = client.get(f"{BASE_URL}/api/campaigns", timeout=20)
            assert gl.status_code == 200
            arr = gl.json()
            assert len(arr) > 0, "empty campaigns list"
            # Pinned campaigns are floated first
            pinned_positions = [i for i, x in enumerate(arr) if x.get("pinned")]
            our_pos = next((i for i, x in enumerate(arr) if x.get("id") == cid), -1)
            assert our_pos != -1, "our campaign missing from list"
            # our campaign should be within the pinned prefix
            unpinned_positions = [i for i, x in enumerate(arr) if not x.get("pinned")]
            first_unpinned = min(unpinned_positions) if unpinned_positions else len(arr)
            assert our_pos < first_unpinned, (
                f"pinned campaign at index {our_pos} not before first unpinned at {first_unpinned}"
            )
        finally:
            client.delete(f"{BASE_URL}/api/admin/campaigns/{cid}", timeout=20)


# ------------------------- 5c: Daily challenge & game reward config -------------------------
EXPECTED_KEYS = [
    "spin_min", "spin_max",
    "scratch_min", "scratch_max",
    "visit_min", "visit_max",
    "watch_min", "watch_max",
    "survey_min", "survey_max",
    "quiz_min", "quiz_max",
    "checkin_base", "checkin_step", "checkin_cap",
    "daily_challenge_common", "daily_challenge_uncommon",
    "daily_challenge_rare", "daily_challenge_jackpot",
]


class TestGameRewardConfig:
    def test_get_app_config_has_all_keys(self, client):
        r = client.get(f"{BASE_URL}/api/admin/app-config", timeout=20)
        assert r.status_code == 200, f"GET app-config: {r.status_code} {r.text}"
        cfg = r.json()
        missing = [k for k in EXPECTED_KEYS if k not in cfg]
        assert not missing, f"missing config keys: {missing}. got={list(cfg.keys())}"

        # Default values for daily challenge
        assert int(cfg.get("daily_challenge_common", -1)) == 50
        assert int(cfg.get("daily_challenge_uncommon", -1)) == 150
        assert int(cfg.get("daily_challenge_rare", -1)) == 300
        assert int(cfg.get("daily_challenge_jackpot", -1)) == 1000

    def test_update_daily_challenge_jackpot(self, client):
        # Read current
        cur = client.get(f"{BASE_URL}/api/admin/app-config", timeout=20).json()
        original = int(cur.get("daily_challenge_jackpot", 1000) or 1000)

        try:
            new_val = 2000
            u = client.put(
                f"{BASE_URL}/api/admin/app-config",
                json={"daily_challenge_jackpot": new_val},
                timeout=20,
            )
            assert u.status_code == 200, f"PUT app-config: {u.status_code} {u.text}"

            # Verify persisted
            after = client.get(f"{BASE_URL}/api/admin/app-config", timeout=20).json()
            assert int(after.get("daily_challenge_jackpot", -1)) == new_val, (
                f"jackpot not persisted; got {after.get('daily_challenge_jackpot')}"
            )
        finally:
            # Restore
            client.put(
                f"{BASE_URL}/api/admin/app-config",
                json={"daily_challenge_jackpot": original},
                timeout=20,
            )
