"""
Iteration 19 backend tests — new games (Coin Mine, Plinko, Treasure, Higher/Lower)
and updated /api/tasks/watch (5 watches per 6h, reward 50-100).
"""
import os
import time
import uuid
import requests
import pytest
from datetime import datetime, timezone

from conftest import BASE_URL  # type: ignore


# -------- helpers --------
def _fresh_device_user():
    """Create a fresh user via POST /api/auth/device (returns token)."""
    device_id = f"TEST_dev_{uuid.uuid4().hex[:12]}"
    r = requests.post(
        f"{BASE_URL}/api/auth/device",
        json={"device_id": device_id},
        timeout=15,
    )
    assert r.status_code == 200, f"device auth failed: {r.status_code} {r.text}"
    data = r.json()
    return {
        "user_id": data["user"]["user_id"],
        "token": data["session_token"],
        "headers": {
            "Authorization": f"Bearer {data['session_token']}",
            "Content-Type": "application/json",
        },
    }


@pytest.fixture
def fresh_user(mongo_db):
    """Fresh device-auth user with cleanup."""
    u = _fresh_device_user()
    yield u
    try:
        mongo_db.users.delete_one({"user_id": u["user_id"]})
        mongo_db.user_sessions.delete_many({"user_id": u["user_id"]})
        mongo_db.transactions.delete_many({"user_id": u["user_id"]})
    except Exception:
        pass


def _get_points(headers):
    r = requests.get(f"{BASE_URL}/api/auth/me", headers=headers, timeout=10)
    if r.status_code != 200:
        return None
    return int(r.json().get("points", 0))


# ============================================================
# Watch & Earn — 5 watches / 6h, reward 50-100
# ============================================================
class TestWatchEarn:
    def test_5_watches_then_cooldown(self, fresh_user):
        headers = fresh_user["headers"]
        rewards = []
        for i in range(5):
            r = requests.post(f"{BASE_URL}/api/tasks/watch", headers=headers, timeout=10)
            assert r.status_code == 200, f"watch #{i+1} failed: {r.status_code} {r.text}"
            body = r.json()
            assert 50 <= body["reward"] <= 100, f"reward out of range: {body['reward']}"
            assert body["cycle_used"] == i + 1
            assert body["remaining"] == 5 - (i + 1)
            assert "cycle_resets_at" in body
            rewards.append(body["reward"])

        # 6th must 400 cooldown
        r6 = requests.post(f"{BASE_URL}/api/tasks/watch", headers=headers, timeout=10)
        assert r6.status_code == 400, f"expected cooldown 400, got {r6.status_code} {r6.text}"
        detail = r6.json().get("detail")
        assert isinstance(detail, dict)
        assert detail.get("code") == "watch_cooldown"
        assert "resets_at" in detail

        # Verify points credited (>= 5*50)
        pts = _get_points(headers)
        assert pts is not None and pts >= sum(rewards)


# ============================================================
# Coin Mine
# ============================================================
class TestCoinMine:
    def test_state_initial(self, fresh_user):
        r = requests.get(f"{BASE_URL}/api/games/coinmine/state", headers=fresh_user["headers"], timeout=10)
        assert r.status_code == 200, r.text
        body = r.json()
        for k in ("energy", "energy_max", "tap_value", "daily_earned", "daily_cap", "can_refill"):
            assert k in body
        assert body["energy_max"] == 1000
        assert body["daily_cap"] == 200
        assert body["tap_value"] == 1
        assert body["can_refill"] is True
        assert body["energy"] == 1000
        assert body["daily_earned"] == 0

    def test_tap_credits_and_respects_batch_cap(self, fresh_user):
        # 100 taps -> reward 100 (tap_value 1, under daily cap of 200)
        r = requests.post(
            f"{BASE_URL}/api/games/coinmine/tap",
            headers=fresh_user["headers"],
            json={"taps": 100},
            timeout=10,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["reward"] == 100
        assert body["energy"] == 900
        assert body["daily_earned"] == 100
        assert body["capped"] is False

        # Request 200 (over MAX_BATCH=100). Should be clamped to 100 taps,
        # but daily cap of 200 leaves only 100 -> reward 100 again.
        r2 = requests.post(
            f"{BASE_URL}/api/games/coinmine/tap",
            headers=fresh_user["headers"],
            json={"taps": 200},
            timeout=10,
        )
        assert r2.status_code == 200, r2.text
        b2 = r2.json()
        assert b2["reward"] == 100
        assert b2["daily_earned"] == 200

        # Third request — daily cap hit, reward should be 0 but energy still spent (capped True)
        r3 = requests.post(
            f"{BASE_URL}/api/games/coinmine/tap",
            headers=fresh_user["headers"],
            json={"taps": 50},
            timeout=10,
        )
        assert r3.status_code == 200, r3.text
        b3 = r3.json()
        assert b3["reward"] == 0
        assert b3["daily_earned"] == 200
        assert b3["capped"] is True

        # Points should match daily earned (200)
        pts = _get_points(fresh_user["headers"])
        assert pts == 200

    def test_tap_zero_returns_400(self, fresh_user):
        r = requests.post(
            f"{BASE_URL}/api/games/coinmine/tap",
            headers=fresh_user["headers"],
            json={"taps": 0},
            timeout=10,
        )
        assert r.status_code == 400

    def test_refill_then_cooldown(self, fresh_user):
        # Burn some energy first
        requests.post(
            f"{BASE_URL}/api/games/coinmine/tap",
            headers=fresh_user["headers"],
            json={"taps": 50},
            timeout=10,
        )
        r = requests.post(f"{BASE_URL}/api/games/coinmine/refill", headers=fresh_user["headers"], timeout=10)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["energy"] == body["energy_max"] == 1000

        # Second refill -> 400 cooldown
        r2 = requests.post(f"{BASE_URL}/api/games/coinmine/refill", headers=fresh_user["headers"], timeout=10)
        assert r2.status_code == 400
        assert "cooldown" in r2.json().get("detail", "").lower()

        # State should reflect can_refill=False
        s = requests.get(f"{BASE_URL}/api/games/coinmine/state", headers=fresh_user["headers"], timeout=10).json()
        assert s["can_refill"] is False
        assert s["next_refill_in"] > 0


# ============================================================
# Plinko
# ============================================================
class TestPlinko:
    def test_state_initial(self, fresh_user):
        r = requests.get(f"{BASE_URL}/api/games/plinko/state", headers=fresh_user["headers"], timeout=10)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["drops_used"] == 0
        assert body["drops_total"] == 5
        assert body["ad_refills_used"] == 0
        assert body["ad_refills_max"] == 5
        assert isinstance(body["slots"], list)
        assert len(body["slots"]) == 11

    def test_drop_5_then_limit(self, fresh_user):
        h = fresh_user["headers"]
        total_reward = 0
        for i in range(5):
            r = requests.post(f"{BASE_URL}/api/games/plinko/drop", headers=h, json={"ad_refill": False}, timeout=10)
            assert r.status_code == 200, f"drop {i+1} failed: {r.text}"
            b = r.json()
            assert 0 <= b["slot"] <= 10
            assert b["reward"] in [200, 100, 50, 30, 50, 75, 50, 30, 50, 100, 200]
            assert len(b["path"]) == 10
            assert b["drops_used"] == i + 1
            total_reward += b["reward"]

        r6 = requests.post(f"{BASE_URL}/api/games/plinko/drop", headers=h, json={"ad_refill": False}, timeout=10)
        assert r6.status_code == 400, f"expected 400, got {r6.status_code} {r6.text}"

        # ad_refill drop should work
        r_ad = requests.post(f"{BASE_URL}/api/games/plinko/drop", headers=h, json={"ad_refill": True}, timeout=10)
        assert r_ad.status_code == 200, r_ad.text
        assert r_ad.json()["ad_refills_used"] == 1

        # Points should equal total reward earned
        pts = _get_points(h)
        assert pts >= total_reward  # could include the ad_refill reward too


# ============================================================
# Treasure Hunt
# ============================================================
class TestTreasure:
    def test_state_initial(self, fresh_user):
        r = requests.get(f"{BASE_URL}/api/games/treasure/state", headers=fresh_user["headers"], timeout=10)
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["total_days"] == 30
        assert isinstance(b["today_day"], int)
        assert 1 <= b["today_day"] <= 31
        assert b["revealed"] == []
        assert b["can_reveal"] is True
        assert b["completion_bonus"] == 1000
        assert b["completed"] is False

    def test_reveal_once_per_day(self, fresh_user):
        h = fresh_user["headers"]
        r = requests.post(f"{BASE_URL}/api/games/treasure/reveal", headers=h, timeout=10)
        assert r.status_code == 200, r.text
        b = r.json()
        assert (30 <= b["reward"] <= 100) or b["reward"] == 500
        assert b["kind"] in ("normal", "mega")
        assert b["completion_bonus"] == 0
        assert isinstance(b["day"], int)
        assert len(b["revealed"]) == 1

        # 2nd reveal same day -> 400
        r2 = requests.post(f"{BASE_URL}/api/games/treasure/reveal", headers=h, timeout=10)
        assert r2.status_code == 400

        # State now shows can_reveal=False
        s = requests.get(f"{BASE_URL}/api/games/treasure/state", headers=h, timeout=10).json()
        assert s["can_reveal"] is False
        assert len(s["revealed"]) == 1

        pts = _get_points(h)
        assert pts == b["reward"]


# ============================================================
# Higher-or-Lower
# ============================================================
class TestHigherLower:
    def test_state_initial(self, fresh_user):
        r = requests.get(f"{BASE_URL}/api/games/hl/state", headers=fresh_user["headers"], timeout=10)
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["rounds_used"] == 0
        assert b["rounds_total"] == 10
        assert b["ad_refills_used"] == 0
        assert b["ad_refills_max"] == 10
        assert b["active"] is None

    def test_start_then_play_until_round_over(self, fresh_user):
        h = fresh_user["headers"]
        r = requests.post(f"{BASE_URL}/api/games/hl/start", headers=h, json={"ad_refill": False}, timeout=10)
        assert r.status_code == 200, r.text
        b = r.json()
        assert 1 <= b["card"] <= 13
        assert b["streak"] == 0
        assert b["rounds_used"] == 1

        # Play up to 25 guesses, alternating "higher" — should eventually end
        round_over = False
        max_loops = 30
        for _ in range(max_loops):
            guess = "higher" if b["card"] <= 7 else "lower"
            rr = requests.post(f"{BASE_URL}/api/games/hl/guess", headers=h, json={"guess": guess}, timeout=10)
            assert rr.status_code == 200, rr.text
            b = rr.json()
            if b["round_over"]:
                round_over = True
                assert "reward" in b
                assert b["reward"] in (0, 30, 75, 100)
                break
        # If not over within 30 guesses, that's still acceptable, but unusual.
        assert round_over or b["streak"] >= 10

    def test_cashout_requires_streak_3(self, fresh_user):
        h = fresh_user["headers"]
        # No active round -> 400
        r = requests.post(f"{BASE_URL}/api/games/hl/cashout", headers=h, timeout=10)
        assert r.status_code == 400

        # Start round, immediately try cashout with streak 0 -> 400
        requests.post(f"{BASE_URL}/api/games/hl/start", headers=h, json={"ad_refill": False}, timeout=10)
        r2 = requests.post(f"{BASE_URL}/api/games/hl/cashout", headers=h, timeout=10)
        assert r2.status_code == 400
        assert "3" in r2.json().get("detail", "")

    def test_guess_without_active_round(self, fresh_user):
        h = fresh_user["headers"]
        r = requests.post(f"{BASE_URL}/api/games/hl/guess", headers=h, json={"guess": "higher"}, timeout=10)
        assert r.status_code == 400


# ============================================================
# Transactions persistence sanity check
# ============================================================
class TestTransactionsPersistence:
    def test_coinmine_creates_transaction(self, fresh_user, mongo_db):
        h = fresh_user["headers"]
        r = requests.post(f"{BASE_URL}/api/games/coinmine/tap", headers=h, json={"taps": 10}, timeout=10)
        assert r.status_code == 200
        # Transactions use type='earn' and source='coinmine'
        tx = list(mongo_db.transactions.find(
            {"user_id": fresh_user["user_id"], "source": "coinmine"}, {"_id": 0}
        ))
        assert len(tx) >= 1
        assert tx[0]["points"] == 10
        assert tx[0]["type"] == "earn"

    def test_treasure_creates_transaction(self, fresh_user, mongo_db):
        h = fresh_user["headers"]
        r = requests.post(f"{BASE_URL}/api/games/treasure/reveal", headers=h, timeout=10)
        assert r.status_code == 200
        reward = r.json()["reward"]
        tx = list(mongo_db.transactions.find(
            {"user_id": fresh_user["user_id"], "source": "treasure"}, {"_id": 0}
        ))
        assert len(tx) >= 1
        assert tx[0]["points"] == reward
        assert tx[0]["type"] == "earn"
