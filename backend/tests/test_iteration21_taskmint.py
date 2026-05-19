"""Iteration 21 - TaskMint updates:
- Remove daily limits from TTT / Memory / Math / Higher-Lower
- Memory reward 50-100 random; Math tiered rewards (10/8/6/4/else)
- Wallet split: campaign_points + games_task_points
- Withdraw: requires `source`; 2/day cap; per-bucket balance check
- /wallet/transactions supports ?category= filter; legacy=games_task
- Admin campaign approval credits campaign_points only
"""
import uuid
import time
import subprocess
import requests
from datetime import datetime, timezone


# ----------------------------- helpers ------------------------------
def _setup_wallet_user(mongo_db, *, cp=0, gp=0, points=None, mobile="9999999999"):
    """Create user with explicit wallet buckets + mobile (for withdraw tests)."""
    if points is None:
        points = cp + gp
    user_id = f"user_TEST_{uuid.uuid4().hex[:10]}"
    token = f"TEST_tok_{uuid.uuid4().hex[:16]}"
    from datetime import timedelta
    mongo_db.users.insert_one({
        "user_id": user_id,
        "email": f"TEST_wallet_{uuid.uuid4().hex[:6]}@example.com",
        "name": "TEST WalletUser",
        "picture": "",
        "points": points,
        "campaign_points": cp,
        "games_task_points": gp,
        "mobile_number": mobile,
        "total_earned": points,
        "total_tasks": 0,
        "streak": 0,
        "has_first_withdrawal": False,
        "is_admin": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    mongo_db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc),
    })
    return user_id, token


def _cleanup(mongo_db, user_id):
    mongo_db.users.delete_one({"user_id": user_id})
    mongo_db.user_sessions.delete_many({"user_id": user_id})
    mongo_db.transactions.delete_many({"user_id": user_id})
    mongo_db.withdrawals.delete_many({"user_id": user_id})
    mongo_db.campaign_completions.delete_many({"user_id": user_id})


# ----------------------------- Game state: no daily limit ----------
class TestGameStateNoDailyLimit:
    def test_tictactoe_state_plays_total_minus_one(self, base_url, user_session):
        r = requests.get(f"{base_url}/api/games/tictactoe/state", headers=user_session["headers"])
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("plays_total") == -1, data

    def test_memory_state_plays_total_minus_one(self, base_url, user_session):
        r = requests.get(f"{base_url}/api/games/memory/state", headers=user_session["headers"])
        assert r.status_code == 200, r.text
        assert r.json().get("plays_total") == -1

    def test_math_state_plays_total_minus_one(self, base_url, user_session):
        r = requests.get(f"{base_url}/api/games/math/state", headers=user_session["headers"])
        assert r.status_code == 200, r.text
        assert r.json().get("plays_total") == -1

    def test_hl_state_rounds_total_and_ad_refills_max_minus_one(self, base_url, user_session):
        r = requests.get(f"{base_url}/api/games/hl/state", headers=user_session["headers"])
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("rounds_total") == -1
        assert data.get("ad_refills_max") == -1


# ----------------------------- Memory reward 50-100 ----------------
class TestMemoryReward:
    def test_completed_reward_50_to_100(self, base_url, user_session):
        for _ in range(5):
            r = requests.post(
                f"{base_url}/api/games/memory/play",
                json={"moves": 12, "time_seconds": 30, "completed": True},
                headers=user_session["headers"],
            )
            assert r.status_code == 200, r.text
            reward = r.json().get("reward")
            assert 50 <= reward <= 100, f"reward {reward} not in [50,100]"

    def test_not_completed_reward_zero(self, base_url, user_session):
        r = requests.post(
            f"{base_url}/api/games/memory/play",
            json={"moves": 5, "time_seconds": 10, "completed": False},
            headers=user_session["headers"],
        )
        assert r.status_code == 200
        assert r.json().get("reward") == 0


# ----------------------------- Math tiered rewards -----------------
class TestMathTieredReward:
    def _play(self, base_url, headers, correct, total=20):
        return requests.post(
            f"{base_url}/api/games/math/play",
            json={"correct": correct, "total": total, "time_seconds": 20},
            headers=headers,
        )

    def test_10_correct_reward_150(self, base_url, user_session):
        r = self._play(base_url, user_session["headers"], 10)
        assert r.status_code == 200 and r.json()["reward"] == 150

    def test_8_correct_reward_100(self, base_url, user_session):
        r = self._play(base_url, user_session["headers"], 8)
        assert r.status_code == 200 and r.json()["reward"] == 100

    def test_6_correct_reward_50(self, base_url, user_session):
        r = self._play(base_url, user_session["headers"], 6)
        assert r.status_code == 200 and r.json()["reward"] == 50

    def test_4_correct_reward_30(self, base_url, user_session):
        r = self._play(base_url, user_session["headers"], 4)
        assert r.status_code == 200 and r.json()["reward"] == 30

    def test_2_correct_reward_0(self, base_url, user_session):
        r = self._play(base_url, user_session["headers"], 2)
        assert r.status_code == 200 and r.json()["reward"] == 0


# ----------------------------- No daily-cap enforcement ------------
class TestNoDailyLimitEnforcement:
    def test_tictactoe_play_many_times(self, base_url, user_session):
        """Server should never return a 'daily limit' error regardless of repeats."""
        for _ in range(15):
            r = requests.post(
                f"{base_url}/api/games/tictactoe/play",
                json={"result": "win", "difficulty": "easy"},
                headers=user_session["headers"],
            )
            assert r.status_code == 200, r.text
            assert r.json().get("remaining") == -1

    def test_hl_start_no_ad_refill_many_times(self, base_url, user_session):
        for _ in range(15):
            r = requests.post(
                f"{base_url}/api/games/hl/start",
                json={"ad_refill": False},
                headers=user_session["headers"],
            )
            assert r.status_code == 200, r.text
            data = r.json()
            assert "Daily rounds exhausted" not in str(data)
            assert data.get("rounds_total") == -1


# ----------------------------- Wallet split & migration ------------
class TestWalletSplit:
    def test_auth_me_returns_split_fields(self, base_url, user_session):
        r = requests.get(f"{base_url}/api/auth/me", headers=user_session["headers"])
        assert r.status_code == 200, r.text
        body = r.json()
        assert "campaign_points" in body
        assert "games_task_points" in body

    def test_migration_runs_on_startup(self, base_url, mongo_db):
        """Insert a legacy user with points but no buckets, restart backend,
        then verify the migration has split the balance."""
        user_id = f"user_TEST_mig_{uuid.uuid4().hex[:8]}"
        from datetime import timedelta
        token = f"TEST_tok_{uuid.uuid4().hex[:16]}"
        mongo_db.users.insert_one({
            "user_id": user_id,
            "email": f"TEST_mig_{uuid.uuid4().hex[:6]}@example.com",
            "name": "TEST MigUser",
            "points": 1000,
            "campaign_points": 0,
            "games_task_points": 0,
            "total_earned": 1000,
            "is_admin": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        mongo_db.user_sessions.insert_one({
            "user_id": user_id,
            "session_token": token,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
            "created_at": datetime.now(timezone.utc),
        })
        try:
            # Trigger startup migration by restarting backend
            subprocess.run(["sudo", "supervisorctl", "restart", "backend"],
                           check=False, capture_output=True, timeout=30)
            # Wait for server to come up
            for _ in range(30):
                try:
                    h = requests.get(f"{base_url}/api/auth/me",
                                     headers={"Authorization": f"Bearer {token}"}, timeout=3)
                    if h.status_code in (200, 401):
                        break
                except Exception:
                    pass
                time.sleep(1)
            time.sleep(2)
            u = mongo_db.users.find_one({"user_id": user_id})
            cp = int(u.get("campaign_points", 0))
            gp = int(u.get("games_task_points", 0))
            assert cp + gp == 1000, f"buckets {cp}+{gp} != 1000"
        finally:
            _cleanup(mongo_db, user_id)


# ----------------------------- Withdraw split & cap ---------------
class TestWithdrawSplit:
    def test_withdraw_games_task_deducts_only_games_task(self, base_url, mongo_db):
        uid, tok = _setup_wallet_user(mongo_db, cp=500, gp=500)
        try:
            r = requests.post(
                f"{base_url}/api/withdraw",
                json={"method": "upi", "source": "games_task",
                      "points": 200, "upi_id": "test@upi"},
                headers={"Authorization": f"Bearer {tok}"},
            )
            assert r.status_code == 200, r.text
            assert r.json().get("source") == "games_task"
            u = mongo_db.users.find_one({"user_id": uid})
            assert u["games_task_points"] == 300, u["games_task_points"]
            assert u["campaign_points"] == 500, "campaign bucket must be untouched"
        finally:
            _cleanup(mongo_db, uid)

    def test_withdraw_campaign_deducts_only_campaign(self, base_url, mongo_db):
        uid, tok = _setup_wallet_user(mongo_db, cp=500, gp=500)
        try:
            r = requests.post(
                f"{base_url}/api/withdraw",
                json={"method": "upi", "source": "campaign",
                      "points": 333, "upi_id": "test@upi"},
                headers={"Authorization": f"Bearer {tok}"},
            )
            assert r.status_code == 200, r.text
            assert r.json().get("source") == "campaign"
            u = mongo_db.users.find_one({"user_id": uid})
            assert u["campaign_points"] == 167
            assert u["games_task_points"] == 500
        finally:
            _cleanup(mongo_db, uid)

    def test_withdraw_insufficient_in_bucket_returns_400(self, base_url, mongo_db):
        # campaign has only 100 but games_task has 1000 → still must reject
        uid, tok = _setup_wallet_user(mongo_db, cp=100, gp=1000)
        try:
            r = requests.post(
                f"{base_url}/api/withdraw",
                json={"method": "upi", "source": "campaign",
                      "points": 500, "upi_id": "test@upi"},
                headers={"Authorization": f"Bearer {tok}"},
            )
            assert r.status_code == 400, r.text
            assert "Insufficient" in r.json().get("detail", ""), r.text
        finally:
            _cleanup(mongo_db, uid)

    def test_third_withdraw_in_a_day_blocked(self, base_url, mongo_db):
        uid, tok = _setup_wallet_user(mongo_db, cp=0, gp=1000)
        hdr = {"Authorization": f"Bearer {tok}"}
        try:
            for i in range(2):
                r = requests.post(
                    f"{base_url}/api/withdraw",
                    json={"method": "upi", "source": "games_task",
                          "points": 100, "upi_id": "test@upi"},
                    headers=hdr,
                )
                assert r.status_code == 200, f"#{i+1} {r.text}"
            r3 = requests.post(
                f"{base_url}/api/withdraw",
                json={"method": "upi", "source": "games_task",
                      "points": 100, "upi_id": "test@upi"},
                headers=hdr,
            )
            assert r3.status_code == 400, r3.text
            assert "Daily withdrawal limit" in r3.json().get("detail", ""), r3.text
        finally:
            _cleanup(mongo_db, uid)


# ----------------------------- Transactions filter ----------------
class TestTransactionCategoryFilter:
    def test_category_field_returned(self, base_url, mongo_db, user_session):
        uid = user_session["user_id"]
        # Insert one of each category
        mongo_db.transactions.insert_many([
            {"id": f"txn_TEST_{uuid.uuid4().hex[:6]}",
             "user_id": uid, "type": "earn", "source": "campaign",
             "category": "campaign", "points": 100, "note": "TEST campaign",
             "created_at": datetime.now(timezone.utc).isoformat()},
            {"id": f"txn_TEST_{uuid.uuid4().hex[:6]}",
             "user_id": uid, "type": "earn", "source": "tictactoe",
             "category": "games_task", "points": 30, "note": "TEST ttt",
             "created_at": datetime.now(timezone.utc).isoformat()},
            # Legacy txn without category
            {"id": f"txn_TEST_{uuid.uuid4().hex[:6]}",
             "user_id": uid, "type": "earn", "source": "checkin",
             "points": 20, "note": "TEST legacy",
             "created_at": datetime.now(timezone.utc).isoformat()},
        ])
        r = requests.get(f"{base_url}/api/wallet/transactions",
                         headers=user_session["headers"])
        assert r.status_code == 200
        rows = r.json()
        # Each TEST row should have a 'category' field (legacy → default games_task in model)
        ours = [t for t in rows if t.get("note", "").startswith("TEST")]
        assert len(ours) >= 3
        for t in ours:
            assert "category" in t

    def test_filter_campaign(self, base_url, mongo_db, user_session):
        uid = user_session["user_id"]
        mongo_db.transactions.insert_many([
            {"id": f"txn_TEST_{uuid.uuid4().hex[:6]}",
             "user_id": uid, "type": "earn", "source": "campaign",
             "category": "campaign", "points": 100, "note": "TEST cmp",
             "created_at": datetime.now(timezone.utc).isoformat()},
            {"id": f"txn_TEST_{uuid.uuid4().hex[:6]}",
             "user_id": uid, "type": "earn", "source": "tictactoe",
             "category": "games_task", "points": 30, "note": "TEST gt",
             "created_at": datetime.now(timezone.utc).isoformat()},
        ])
        r = requests.get(f"{base_url}/api/wallet/transactions?category=campaign",
                         headers=user_session["headers"])
        assert r.status_code == 200
        rows = r.json()
        ours = [t for t in rows if t.get("note", "").startswith("TEST")]
        assert all(t.get("category") == "campaign" for t in ours), ours

    def test_filter_games_task_includes_legacy(self, base_url, mongo_db, user_session):
        uid = user_session["user_id"]
        mongo_db.transactions.insert_many([
            {"id": f"txn_TEST_{uuid.uuid4().hex[:6]}",
             "user_id": uid, "type": "earn", "source": "tictactoe",
             "category": "games_task", "points": 30, "note": "TEST gt2",
             "created_at": datetime.now(timezone.utc).isoformat()},
            {"id": f"txn_TEST_{uuid.uuid4().hex[:6]}",
             "user_id": uid, "type": "earn", "source": "checkin",
             "points": 20, "note": "TEST legacy2",
             "created_at": datetime.now(timezone.utc).isoformat()},
            {"id": f"txn_TEST_{uuid.uuid4().hex[:6]}",
             "user_id": uid, "type": "earn", "source": "campaign",
             "category": "campaign", "points": 100, "note": "TEST cmp2",
             "created_at": datetime.now(timezone.utc).isoformat()},
        ])
        r = requests.get(f"{base_url}/api/wallet/transactions?category=games_task",
                         headers=user_session["headers"])
        assert r.status_code == 200
        rows = r.json()
        ours = [t for t in rows if t.get("note", "").startswith("TEST")]
        notes = [t["note"] for t in ours]
        assert any("legacy2" in n for n in notes), "Legacy txn must be in games_task filter"
        assert all("cmp2" not in n for n in notes), "Campaign rows must be excluded"


# ----------------------------- Admin: campaign approval credits campaign_points
class TestAdminCampaignApprovalCredits:
    def test_approval_increases_campaign_points_only(self, base_url, mongo_db, admin_session):
        uid, tok = _setup_wallet_user(mongo_db, cp=100, gp=200)
        try:
            # Insert a pending completion directly
            comp_id = f"cmc_TEST_{uuid.uuid4().hex[:8]}"
            mongo_db.campaign_completions.insert_one({
                "id": comp_id, "user_id": uid, "user_name": "TEST",
                "user_email": "test@x.com", "campaign_id": "cmp_TEST_x",
                "campaign_name": "TEST campaign", "reward_points": 250,
                "form_field_1_value": "", "form_field_2_value": "",
                "status": "pending", "admin_note": "",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })
            r = requests.put(
                f"{base_url}/api/admin/campaign-completions/{comp_id}",
                json={"status": "approved", "admin_note": ""},
                headers=admin_session["headers"],
            )
            assert r.status_code == 200, r.text
            u = mongo_db.users.find_one({"user_id": uid})
            assert u["campaign_points"] == 100 + 250, u["campaign_points"]
            assert u["games_task_points"] == 200, "games_task untouched"
            # Verify txn category=campaign
            t = mongo_db.transactions.find_one(
                {"user_id": uid, "source": "campaign"})
            assert t and t.get("category") == "campaign", t
        finally:
            mongo_db.campaign_completions.delete_many({"user_id": uid})
            _cleanup(mongo_db, uid)


# ----------------------------- Admin: withdrawals expose `source` -------
class TestAdminWithdrawalsListSource:
    def test_source_in_admin_withdrawals(self, base_url, mongo_db, admin_session):
        # Insert a withdrawal directly
        wd_id = f"wdr_TEST_{uuid.uuid4().hex[:8]}"
        mongo_db.withdrawals.insert_one({
            "id": wd_id, "user_id": "user_TEST_admWD",
            "user_name": "TEST", "user_email": "t@x.com",
            "method": "upi", "source": "campaign",
            "points": 100, "inr_amount": 1.0,
            "upi_id": "x@upi", "status": "pending",
            "admin_note": "",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
        try:
            r = requests.get(f"{base_url}/api/admin/withdrawals",
                             headers=admin_session["headers"])
            assert r.status_code == 200
            rows = r.json()
            ours = next((w for w in rows if w["id"] == wd_id), None)
            assert ours is not None, "inserted withdrawal not returned"
            assert ours.get("source") == "campaign", ours
        finally:
            mongo_db.withdrawals.delete_one({"id": wd_id})
