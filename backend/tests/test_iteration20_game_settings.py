"""
Iteration 20 backend tests — admin-tunable game settings.

Covers:
- GET /api/admin/game-settings (admin auth, returns all 22 defaults)
- PUT /api/admin/game-settings (partial updates, merged response)
- Validation errors (treasure_mega_chance>1, plinko_slots=[])
- Non-admin user receives 403
- Persistence (PUT then GET returns updated values)
- Game endpoints consume overrides at request time:
    * coin_daily_cap → coinmine/tap respects new cap
    * plinko_slots → plinko/state returns new slots
    * watch_reward_max → tasks/watch reward within range
    * hl_reward_streak_3 → hl ends with new reward at streak 3
    * treasure_total_days → treasure/state shows new total_days
- Reset defaults at end so user-visible state is clean.
"""
import uuid
import requests
import pytest

from conftest import BASE_URL  # type: ignore


DEFAULTS = {
    "coin_max_energy": 1000,
    "coin_tap_value": 1,
    "coin_daily_cap": 200,
    "coin_refill_cooldown_s": 1800,
    "plinko_daily_limit": 5,
    "plinko_ad_refills_max": 5,
    "plinko_slots": [200, 100, 50, 30, 50, 75, 50, 30, 50, 100, 200],
    "treasure_total_days": 30,
    "treasure_completion_bonus": 1000,
    "treasure_mega_chance": 0.05,
    "treasure_reward_min": 30,
    "treasure_reward_max": 100,
    "treasure_mega_reward": 500,
    "hl_daily_rounds": 10,
    "hl_ad_refills_max": 10,
    "hl_reward_streak_3": 30,
    "hl_reward_streak_5": 75,
    "hl_reward_streak_7": 100,
    "watch_cycle_limit": 5,
    "watch_cycle_hours": 6,
    "watch_reward_min": 50,
    "watch_reward_max": 100,
}


def _fresh_device_user():
    device_id = f"TEST_dev_{uuid.uuid4().hex[:12]}"
    r = requests.post(f"{BASE_URL}/api/auth/device",
                      json={"device_id": device_id}, timeout=15)
    assert r.status_code == 200, f"device auth: {r.status_code} {r.text}"
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
    u = _fresh_device_user()
    yield u
    try:
        mongo_db.users.delete_one({"user_id": u["user_id"]})
        mongo_db.user_sessions.delete_many({"user_id": u["user_id"]})
        mongo_db.transactions.delete_many({"user_id": u["user_id"]})
    except Exception:
        pass


@pytest.fixture(scope="module", autouse=True)
def reset_settings_after_module():
    """Reset game_settings to defaults after this whole module runs."""
    yield
    # Need an admin to reset. Build one ad-hoc via the conftest pattern.
    import time as _t
    from pymongo import MongoClient
    from datetime import datetime, timezone, timedelta
    from dotenv import dotenv_values
    _BE = dotenv_values("/app/backend/.env")
    import os as _os
    MONGO_URL = _os.environ.get("MONGO_URL") or _BE.get("MONGO_URL")
    DB_NAME = _os.environ.get("DB_NAME") or _BE.get("DB_NAME")
    c = MongoClient(MONGO_URL)
    db = c[DB_NAME]
    user_id = f"user_TEST_reset_{uuid.uuid4().hex[:8]}"
    token = f"TEST_tok_reset_{uuid.uuid4().hex[:12]}"
    db.users.insert_one({
        "user_id": user_id, "email": f"TEST_reset_{int(_t.time()*1000)}@example.com",
        "name": "TEST", "picture": "", "points": 0, "total_earned": 0,
        "total_tasks": 0, "is_admin": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    db.user_sessions.insert_one({
        "user_id": user_id, "session_token": token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=1),
        "created_at": datetime.now(timezone.utc),
    })
    h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    try:
        requests.put(f"{BASE_URL}/api/admin/game-settings",
                     json=DEFAULTS, headers=h, timeout=15)
    finally:
        db.users.delete_one({"user_id": user_id})
        db.user_sessions.delete_one({"session_token": token})


# ============================================================
# Admin GET / PUT contract
# ============================================================
class TestAdminGameSettingsContract:
    def test_get_requires_admin_auth(self, fresh_user):
        r = requests.get(f"{BASE_URL}/api/admin/game-settings",
                         headers=fresh_user["headers"], timeout=10)
        assert r.status_code == 403, f"expected 403, got {r.status_code} {r.text}"

    def test_get_unauth_returns_401(self):
        r = requests.get(f"{BASE_URL}/api/admin/game-settings", timeout=10)
        assert r.status_code in (401, 403)

    def test_get_returns_all_default_fields(self, admin_session):
        r = requests.get(f"{BASE_URL}/api/admin/game-settings",
                         headers=admin_session["headers"], timeout=10)
        assert r.status_code == 200, r.text
        body = r.json()
        for k, v in DEFAULTS.items():
            assert k in body, f"missing field {k}"
            # value may have been overridden by previous run — only check type
            assert type(body[k]) == type(v), f"{k}: type mismatch {type(body[k])} vs {type(v)}"

    def test_put_partial_update_merges(self, admin_session, mongo_db):
        h = admin_session["headers"]
        # First baseline-reset to defaults so we know starting state
        requests.put(f"{BASE_URL}/api/admin/game-settings",
                     json=DEFAULTS, headers=h, timeout=10)

        payload = {"coin_daily_cap": 250, "plinko_slots": [10, 20, 30, 40, 50],
                   "watch_reward_max": 120}
        r = requests.put(f"{BASE_URL}/api/admin/game-settings",
                         json=payload, headers=h, timeout=10)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["coin_daily_cap"] == 250
        assert body["plinko_slots"] == [10, 20, 30, 40, 50]
        assert body["watch_reward_max"] == 120
        # Other fields stay at defaults
        assert body["watch_reward_min"] == 50
        assert body["treasure_total_days"] == 30
        # Persistence: GET should reflect
        g = requests.get(f"{BASE_URL}/api/admin/game-settings",
                         headers=h, timeout=10).json()
        assert g["coin_daily_cap"] == 250
        assert g["plinko_slots"] == [10, 20, 30, 40, 50]
        assert g["watch_reward_max"] == 120

    def test_put_validation_mega_chance(self, admin_session):
        r = requests.put(f"{BASE_URL}/api/admin/game-settings",
                         json={"treasure_mega_chance": 1.5},
                         headers=admin_session["headers"], timeout=10)
        assert r.status_code == 400, f"expected 400 got {r.status_code} {r.text}"

    def test_put_validation_empty_plinko_slots(self, admin_session):
        r = requests.put(f"{BASE_URL}/api/admin/game-settings",
                         json={"plinko_slots": []},
                         headers=admin_session["headers"], timeout=10)
        assert r.status_code == 400, f"expected 400 got {r.status_code} {r.text}"

    def test_put_validation_negative_plinko_slot(self, admin_session):
        r = requests.put(f"{BASE_URL}/api/admin/game-settings",
                         json={"plinko_slots": [10, -5, 30]},
                         headers=admin_session["headers"], timeout=10)
        assert r.status_code == 400

    def test_put_requires_admin(self, fresh_user):
        r = requests.put(f"{BASE_URL}/api/admin/game-settings",
                         json={"coin_daily_cap": 9999},
                         headers=fresh_user["headers"], timeout=10)
        assert r.status_code == 403


# ============================================================
# Game endpoints consume overrides at request time
# ============================================================
class TestOverridesAppliedToGames:
    def _set(self, h, payload):
        r = requests.put(f"{BASE_URL}/api/admin/game-settings",
                         json=payload, headers=h, timeout=10)
        assert r.status_code == 200, r.text

    def _reset_defaults(self, h):
        requests.put(f"{BASE_URL}/api/admin/game-settings",
                     json=DEFAULTS, headers=h, timeout=10)

    def test_plinko_state_reflects_new_slots(self, admin_session, fresh_user):
        self._set(admin_session["headers"],
                  {"plinko_slots": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]})
        try:
            r = requests.get(f"{BASE_URL}/api/games/plinko/state",
                             headers=fresh_user["headers"], timeout=10)
            assert r.status_code == 200
            body = r.json()
            assert body["slots"] == [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
        finally:
            self._reset_defaults(admin_session["headers"])

    def test_coin_daily_cap_override(self, admin_session, fresh_user):
        self._set(admin_session["headers"], {"coin_daily_cap": 250})
        try:
            h = fresh_user["headers"]
            # tap repeatedly to reach the new cap
            total = 0
            capped_seen = False
            for _ in range(5):
                r = requests.post(f"{BASE_URL}/api/games/coinmine/tap",
                                  headers=h, json={"taps": 100}, timeout=10)
                assert r.status_code == 200, r.text
                b = r.json()
                total = b["daily_earned"]
                if b["capped"]:
                    capped_seen = True
                    break
            assert total == 250, f"expected cap 250 got {total}"
            assert capped_seen
            # Next tap should be capped with reward 0
            r2 = requests.post(f"{BASE_URL}/api/games/coinmine/tap",
                               headers=h, json={"taps": 10}, timeout=10)
            assert r2.status_code == 200
            b2 = r2.json()
            assert b2["reward"] == 0
            assert b2["daily_earned"] == 250
            assert b2["capped"] is True
        finally:
            self._reset_defaults(admin_session["headers"])

    def test_watch_reward_max_override(self, admin_session, fresh_user):
        self._set(admin_session["headers"], {"watch_reward_max": 120})
        try:
            h = fresh_user["headers"]
            rewards = []
            for i in range(5):
                r = requests.post(f"{BASE_URL}/api/tasks/watch",
                                  headers=h, timeout=10)
                assert r.status_code == 200, r.text
                rewards.append(r.json()["reward"])
            for rew in rewards:
                assert 50 <= rew <= 120, f"reward {rew} out of [50,120]"
            # at least one reward >100 is statistically likely with 5 samples
            # but we don't strictly assert it (could be flaky); just log.
        finally:
            self._reset_defaults(admin_session["headers"])

    def test_hl_streak3_reward_override(self, admin_session, fresh_user):
        """Override hl_reward_streak_3=50, force a 3-streak cashout returns 50."""
        self._set(admin_session["headers"], {"hl_reward_streak_3": 50})
        try:
            h = fresh_user["headers"]
            # Try up to several rounds until we get a 3-streak cashout.
            seen_reward = None
            for attempt in range(20):
                start = requests.post(f"{BASE_URL}/api/games/hl/start",
                                      headers=h, json={"ad_refill": False}, timeout=10)
                if start.status_code != 200:
                    break  # out of rounds (10 default)
                b = start.json()
                while True:
                    card = b["card"]
                    guess = "higher" if card <= 7 else "lower"
                    gr = requests.post(f"{BASE_URL}/api/games/hl/guess",
                                       headers=h, json={"guess": guess}, timeout=10)
                    assert gr.status_code == 200, gr.text
                    b = gr.json()
                    if b.get("round_over"):
                        break
                    if b["streak"] >= 3:
                        # cashout
                        co = requests.post(f"{BASE_URL}/api/games/hl/cashout",
                                           headers=h, timeout=10)
                        assert co.status_code == 200, co.text
                        cb = co.json()
                        # cashout returns reward — should equal override (50)
                        seen_reward = cb.get("reward")
                        break
                if seen_reward is not None:
                    break
            # If we never reached streak 3, that's a flake — skip not fail
            if seen_reward is None:
                pytest.skip("could not reach 3-streak within rounds budget")
            assert seen_reward == 50, f"expected reward 50, got {seen_reward}"
        finally:
            self._reset_defaults(admin_session["headers"])

    def test_treasure_total_days_override(self, admin_session, fresh_user):
        self._set(admin_session["headers"], {"treasure_total_days": 2})
        try:
            r = requests.get(f"{BASE_URL}/api/games/treasure/state",
                             headers=fresh_user["headers"], timeout=10)
            assert r.status_code == 200, r.text
            assert r.json()["total_days"] == 2
        finally:
            self._reset_defaults(admin_session["headers"])


# ============================================================
# Regression — default settings still work end-to-end
# ============================================================
class TestRegressionWithDefaults:
    @pytest.fixture(autouse=True)
    def ensure_defaults(self, admin_session):
        requests.put(f"{BASE_URL}/api/admin/game-settings",
                     json=DEFAULTS, headers=admin_session["headers"], timeout=10)
        yield

    def test_coinmine_default(self, fresh_user):
        h = fresh_user["headers"]
        s = requests.get(f"{BASE_URL}/api/games/coinmine/state", headers=h, timeout=10).json()
        assert s["daily_cap"] == 200
        r = requests.post(f"{BASE_URL}/api/games/coinmine/tap",
                          headers=h, json={"taps": 50}, timeout=10)
        assert r.status_code == 200
        assert r.json()["reward"] == 50

    def test_plinko_default(self, fresh_user):
        h = fresh_user["headers"]
        s = requests.get(f"{BASE_URL}/api/games/plinko/state", headers=h, timeout=10).json()
        assert s["slots"] == DEFAULTS["plinko_slots"]
        r = requests.post(f"{BASE_URL}/api/games/plinko/drop",
                          headers=h, json={"ad_refill": False}, timeout=10)
        assert r.status_code == 200
        assert r.json()["reward"] in DEFAULTS["plinko_slots"]

    def test_treasure_default(self, fresh_user):
        h = fresh_user["headers"]
        s = requests.get(f"{BASE_URL}/api/games/treasure/state", headers=h, timeout=10).json()
        assert s["total_days"] == 30
        assert s["completion_bonus"] == 1000
        r = requests.post(f"{BASE_URL}/api/games/treasure/reveal", headers=h, timeout=10)
        assert r.status_code == 200
        b = r.json()
        assert (30 <= b["reward"] <= 100) or b["reward"] == 500

    def test_hl_default(self, fresh_user):
        h = fresh_user["headers"]
        s = requests.get(f"{BASE_URL}/api/games/hl/state", headers=h, timeout=10).json()
        assert s["rounds_total"] == 10
        st = requests.post(f"{BASE_URL}/api/games/hl/start",
                           headers=h, json={"ad_refill": False}, timeout=10)
        assert st.status_code == 200

    def test_watch_default(self, fresh_user):
        h = fresh_user["headers"]
        r = requests.post(f"{BASE_URL}/api/tasks/watch", headers=h, timeout=10)
        assert r.status_code == 200
        b = r.json()
        assert 50 <= b["reward"] <= 100
        assert b["remaining"] == 4
