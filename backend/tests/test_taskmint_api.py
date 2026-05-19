"""TaskMint backend tests - covers iteration 2 changes (campaign approval flow,
admin user mgmt, withdraw settings, spin/scratch 50-100, total_withdrawn,
telegram_contact, link_url for banners/campaigns, DAU stat).
"""
import time
import pytest


# ---------- Public ----------
class TestPublic:
    def test_banners(self, api, base_url):
        r = api.get(f"{base_url}/api/banners")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) >= 1
        assert "title" in data[0] and "image_url" in data[0]
        # link_url field present (may be empty string)
        assert "link_url" in data[0]

    def test_campaigns(self, api, base_url):
        r = api.get(f"{base_url}/api/campaigns")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) >= 1
        for c in data:
            assert {"id", "name", "reward_points", "reward_inr"}.issubset(c.keys())
            assert "link_url" in c

    def test_links(self, api, base_url):
        r = api.get(f"{base_url}/api/links")
        assert r.status_code == 200
        d = r.json()
        for k in ["telegram", "whatsapp", "customer_support", "privacy_policy", "terms"]:
            assert k in d
        # New iteration 2: telegram_contact may be present (default empty if seeded fresh)
        # Tolerate absence on legacy seed since it defaults to "" via model
        # but admin PUT will populate it.

    def test_withdraw_settings_public(self, api, base_url):
        r = api.get(f"{base_url}/api/withdraw-settings")
        assert r.status_code == 200
        d = r.json()
        assert "amounts" in d and isinstance(d["amounts"], list)
        # default amounts
        assert all(isinstance(x, int) for x in d["amounts"])


# ---------- Auth ----------
class TestAuth:
    def test_me_no_auth(self, api, base_url):
        r = api.get(f"{base_url}/api/auth/me")
        assert r.status_code == 401

    def test_me_with_bearer_updates_activity(self, api, base_url, user_session, mongo_db):
        # clear last_activity_date first
        mongo_db.users.update_one({"user_id": user_session["user_id"]},
                                  {"$set": {"last_activity_date": None}})
        r = api.get(f"{base_url}/api/auth/me", headers=user_session["headers"])
        assert r.status_code == 200
        d = r.json()
        assert d["user_id"] == user_session["user_id"]
        from datetime import datetime, timezone
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        assert d["last_activity_date"] == today
        assert "_id" not in d
        # total_withdrawn field present
        assert "total_withdrawn" in d

    def test_session_invalid_id(self, api, base_url):
        r = api.post(f"{base_url}/api/auth/session", json={"session_id": "invalid_xxx"})
        assert r.status_code == 401


# ---------- Tasks: Spin / Scratch (50-100) ----------
class TestSpinScratch:
    def test_spin_50_to_100(self, api, base_url, user_session):
        r = api.post(f"{base_url}/api/tasks/spin", headers=user_session["headers"])
        assert r.status_code == 200, r.text
        reward = r.json()["reward"]
        assert 50 <= reward <= 100, f"spin reward {reward} out of [50,100]"

    def test_spin_limit(self, api, base_url, user_session, mongo_db):
        from datetime import datetime, timezone
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        mongo_db.users.update_one({"user_id": user_session["user_id"]},
                                  {"$set": {"daily_spins_used": 10, "last_activity_date": today}})
        r = api.post(f"{base_url}/api/tasks/spin", headers=user_session["headers"])
        assert r.status_code == 400

    def test_scratch_50_to_100(self, api, base_url, user_session):
        r = api.post(f"{base_url}/api/tasks/scratch", headers=user_session["headers"])
        assert r.status_code == 200
        reward = r.json()["reward"]
        assert 50 <= reward <= 100, f"scratch reward {reward} out of [50,100]"

    def test_scratch_limit(self, api, base_url, user_session, mongo_db):
        from datetime import datetime, timezone
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        mongo_db.users.update_one({"user_id": user_session["user_id"]},
                                  {"$set": {"daily_scratches_used": 10, "last_activity_date": today}})
        r = api.post(f"{base_url}/api/tasks/scratch", headers=user_session["headers"])
        assert r.status_code == 400


# ---------- Tasks: Campaign open + submit (PENDING) flow ----------
class TestCampaignPending:
    def test_open_campaign_returns_link(self, api, base_url, user_session):
        camps = api.get(f"{base_url}/api/campaigns").json()
        assert len(camps) > 0
        cid = camps[0]["id"]
        before = api.get(f"{base_url}/api/auth/me", headers=user_session["headers"]).json()["points"]
        r = api.post(f"{base_url}/api/tasks/campaign/{cid}", headers=user_session["headers"])
        assert r.status_code == 200, r.text
        body = r.json()
        # New flow: open does NOT create a completion - it only returns link_url
        assert "link_url" in body
        # NOT credited yet
        after = api.get(f"{base_url}/api/auth/me", headers=user_session["headers"]).json()["points"]
        assert after == before, "Points should NOT be credited on open"

    def test_submit_campaign_creates_pending(self, api, base_url, user_session):
        camps = api.get(f"{base_url}/api/campaigns").json()
        cid = camps[0]["id"]
        r = api.post(f"{base_url}/api/tasks/campaign/{cid}/submit",
                     headers=user_session["headers"], json={})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "pending"
        assert "completion_id" in body

    def test_submit_campaign_duplicate_400(self, api, base_url, user_session):
        camps = api.get(f"{base_url}/api/campaigns").json()
        cid = camps[0]["id"]
        api.post(f"{base_url}/api/tasks/campaign/{cid}/submit",
                 headers=user_session["headers"], json={})
        r2 = api.post(f"{base_url}/api/tasks/campaign/{cid}/submit",
                      headers=user_session["headers"], json={})
        assert r2.status_code == 400

    def test_open_campaign_not_found(self, api, base_url, user_session):
        r = api.post(f"{base_url}/api/tasks/campaign/nonexistent_id", headers=user_session["headers"])
        assert r.status_code == 404

    def test_my_campaign_completions_filtered(self, api, base_url, user_session):
        camps = api.get(f"{base_url}/api/campaigns").json()
        cid = camps[0]["id"]
        api.post(f"{base_url}/api/tasks/campaign/{cid}/submit",
                 headers=user_session["headers"], json={})
        r = api.get(f"{base_url}/api/campaign-completions", headers=user_session["headers"])
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 1
        for it in items:
            assert it["user_id"] == user_session["user_id"]


# ---------- Wallet ----------
class TestWallet:
    def test_transactions_desc(self, api, base_url, user_session):
        # spin/scratch now require explicit claim before a transaction is logged
        api.post(f"{base_url}/api/tasks/spin", headers=user_session["headers"])
        api.post(f"{base_url}/api/tasks/spin/claim", headers=user_session["headers"])
        time.sleep(0.05)
        api.post(f"{base_url}/api/tasks/scratch", headers=user_session["headers"])
        api.post(f"{base_url}/api/tasks/scratch/claim", headers=user_session["headers"])
        r = api.get(f"{base_url}/api/wallet/transactions", headers=user_session["headers"])
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 2
        assert items[0]["created_at"] >= items[-1]["created_at"]


# ---------- Withdraw ----------
class TestWithdraw:
    def test_withdraw_below_min_first(self, api, base_url, user_session):
        r = api.post(f"{base_url}/api/withdraw", headers=user_session["headers"],
                     json={"method": "upi", "points": 50, "upi_id": "test@upi"})
        assert r.status_code == 400

    def test_withdraw_increments_total_withdrawn(self, api, base_url, user_session):
        before = api.get(f"{base_url}/api/auth/me", headers=user_session["headers"]).json()
        before_tw = before.get("total_withdrawn", 0)
        r = api.post(f"{base_url}/api/withdraw", headers=user_session["headers"],
                     json={"method": "upi", "points": 100, "upi_id": "test@upi"})
        assert r.status_code == 200, r.text
        wd = r.json()
        assert wd["status"] == "pending"
        assert wd["inr_amount"] == 1.0
        me = api.get(f"{base_url}/api/auth/me", headers=user_session["headers"]).json()
        assert me["has_first_withdrawal"] is True
        assert me["points"] == 4900
        assert me.get("total_withdrawn", 0) == before_tw + 100

    def test_withdraw_upi_required(self, api, base_url, user_session):
        r = api.post(f"{base_url}/api/withdraw", headers=user_session["headers"],
                     json={"method": "upi", "points": 100})
        assert r.status_code == 400

    def test_withdraw_bank_required(self, api, base_url, user_session):
        r = api.post(f"{base_url}/api/withdraw", headers=user_session["headers"],
                     json={"method": "bank", "points": 100})
        assert r.status_code == 400


# ---------- Admin gating ----------
class TestAdminGating:
    def test_non_admin_forbidden(self, api, base_url, user_session):
        endpoints = [
            "/api/admin/banners", "/api/admin/campaigns",
            "/api/admin/withdrawals", "/api/admin/links", "/api/admin/stats",
            "/api/admin/users", "/api/admin/campaign-completions",
            "/api/admin/withdraw-settings",
        ]
        for ep in endpoints:
            r = api.get(f"{base_url}{ep}", headers=user_session["headers"])
            assert r.status_code == 403, f"{ep} returned {r.status_code}"


# ---------- Admin Users ----------
class TestAdminUsers:
    def test_list_and_filter(self, api, base_url, admin_session, user_session):
        h = admin_session["headers"]
        # without filter
        r = api.get(f"{base_url}/api/admin/users", headers=h)
        assert r.status_code == 200
        all_users = r.json()
        assert isinstance(all_users, list) and len(all_users) >= 1
        # with email filter (case insensitive)
        user_email = next(u for u in all_users if u["user_id"] == user_session["user_id"])["email"]
        frag = user_email.split("@")[0][:6]
        r2 = api.get(f"{base_url}/api/admin/users", headers=h, params={"q": frag.upper()})
        assert r2.status_code == 200
        filtered = r2.json()
        assert any(u["user_id"] == user_session["user_id"] for u in filtered)

    def test_get_user_detail(self, api, base_url, admin_session, user_session):
        h = admin_session["headers"]
        r = api.get(f"{base_url}/api/admin/users/{user_session['user_id']}", headers=h)
        assert r.status_code == 200
        u = r.json()
        for k in ["points", "total_earned", "total_withdrawn", "email", "name"]:
            assert k in u

    def test_get_user_404(self, api, base_url, admin_session):
        r = api.get(f"{base_url}/api/admin/users/does_not_exist", headers=admin_session["headers"])
        assert r.status_code == 404

    def test_adjust_points_add(self, api, base_url, admin_session, user_session):
        h = admin_session["headers"]
        before = api.get(f"{base_url}/api/admin/users/{user_session['user_id']}", headers=h).json()
        r = api.post(
            f"{base_url}/api/admin/users/{user_session['user_id']}/adjust-points",
            headers=h, json={"delta": 200, "reason": "TEST_bonus_grant"},
        )
        assert r.status_code == 200, r.text
        after = api.get(f"{base_url}/api/admin/users/{user_session['user_id']}", headers=h).json()
        assert after["points"] == before["points"] + 200
        assert after["total_earned"] == before["total_earned"] + 200
        # transaction created
        txns = api.get(f"{base_url}/api/wallet/transactions", headers=user_session["headers"]).json()
        admin_txn = next((t for t in txns if t["source"] == "admin" and t["points"] == 200), None)
        assert admin_txn is not None
        assert "TEST_bonus_grant" in admin_txn["note"]

    def test_adjust_points_negative_ok(self, api, base_url, admin_session, user_session):
        h = admin_session["headers"]
        before = api.get(f"{base_url}/api/admin/users/{user_session['user_id']}", headers=h).json()
        r = api.post(
            f"{base_url}/api/admin/users/{user_session['user_id']}/adjust-points",
            headers=h, json={"delta": -100, "reason": "TEST_penalty"},
        )
        assert r.status_code == 200
        after = api.get(f"{base_url}/api/admin/users/{user_session['user_id']}", headers=h).json()
        assert after["points"] == before["points"] - 100

    def test_adjust_points_below_zero_blocked(self, api, base_url, admin_session, user_session):
        h = admin_session["headers"]
        u = api.get(f"{base_url}/api/admin/users/{user_session['user_id']}", headers=h).json()
        r = api.post(
            f"{base_url}/api/admin/users/{user_session['user_id']}/adjust-points",
            headers=h, json={"delta": -(u["points"] + 1), "reason": "TEST_overdraw"},
        )
        assert r.status_code == 400


# ---------- Admin Campaign Completions ----------
class TestAdminCampaignCompletions:
    def test_list_and_approve_credits(self, api, base_url, admin_session, user_session):
        camps = api.get(f"{base_url}/api/campaigns").json()
        cid = camps[0]["id"]
        reward = camps[0]["reward_points"]
        r = api.post(f"{base_url}/api/tasks/campaign/{cid}/submit",
                     headers=user_session["headers"], json={})
        assert r.status_code == 200
        completion_id = r.json()["completion_id"]

        before = api.get(f"{base_url}/api/auth/me", headers=user_session["headers"]).json()["points"]

        # admin lists
        items = api.get(f"{base_url}/api/admin/campaign-completions",
                        headers=admin_session["headers"]).json()
        assert any(c["id"] == completion_id and c["status"] == "pending" for c in items)

        # approve
        r2 = api.put(
            f"{base_url}/api/admin/campaign-completions/{completion_id}",
            headers=admin_session["headers"],
            json={"status": "approved", "admin_note": "ok"},
        )
        assert r2.status_code == 200

        after = api.get(f"{base_url}/api/auth/me", headers=user_session["headers"]).json()["points"]
        assert after == before + reward

        # transaction with source=campaign
        txns = api.get(f"{base_url}/api/wallet/transactions", headers=user_session["headers"]).json()
        assert any(t["source"] == "campaign" and t["points"] == reward for t in txns)

        # second update returns 400
        r3 = api.put(
            f"{base_url}/api/admin/campaign-completions/{completion_id}",
            headers=admin_session["headers"],
            json={"status": "rejected"},
        )
        assert r3.status_code == 400

    def test_reject_no_credit(self, api, base_url, admin_session, user_session):
        camps = api.get(f"{base_url}/api/campaigns").json()
        cid = camps[0]["id"]
        r = api.post(f"{base_url}/api/tasks/campaign/{cid}/submit",
                     headers=user_session["headers"], json={})
        completion_id = r.json()["completion_id"]
        before = api.get(f"{base_url}/api/auth/me", headers=user_session["headers"]).json()["points"]

        r2 = api.put(
            f"{base_url}/api/admin/campaign-completions/{completion_id}",
            headers=admin_session["headers"],
            json={"status": "rejected", "admin_note": "TEST_reject"},
        )
        assert r2.status_code == 200
        after = api.get(f"{base_url}/api/auth/me", headers=user_session["headers"]).json()["points"]
        assert after == before


# ---------- Admin Withdraw Settings ----------
class TestAdminWithdrawSettings:
    def test_get_and_put(self, api, base_url, admin_session):
        h = admin_session["headers"]
        r = api.get(f"{base_url}/api/admin/withdraw-settings", headers=h)
        assert r.status_code == 200
        new_amounts = [100, 5000, 20000, 60000]
        r2 = api.put(f"{base_url}/api/admin/withdraw-settings", headers=h,
                     json={"amounts": new_amounts})
        assert r2.status_code == 200
        # public reflects
        pub = api.get(f"{base_url}/api/withdraw-settings").json()
        assert pub["amounts"] == new_amounts
        # restore default
        api.put(f"{base_url}/api/admin/withdraw-settings", headers=h,
                json={"amounts": [100, 10000, 30000, 50000]})


# ---------- Admin Banners (link_url) ----------
class TestAdminBannersLinkUrl:
    def test_create_with_link_url(self, api, base_url, admin_session):
        h = admin_session["headers"]
        payload = {"title": "TEST_Bnr", "subtitle": "x", "image_url": "https://x/y.jpg",
                   "link_url": "https://example.com/promo", "active": True}
        r = api.post(f"{base_url}/api/admin/banners", headers=h, json=payload)
        assert r.status_code == 200
        bid = r.json()["id"]
        assert r.json()["link_url"] == "https://example.com/promo"
        # cleanup
        api.delete(f"{base_url}/api/admin/banners/{bid}", headers=h)


# ---------- Admin Campaigns (link_url) ----------
class TestAdminCampaignsLinkUrl:
    def test_create_with_link_url(self, api, base_url, admin_session):
        h = admin_session["headers"]
        payload = {"name": "TEST_Camp", "note": "n", "logo_url": "https://x/l.jpg",
                   "link_url": "https://app.link/install", "reward_points": 1000, "active": True}
        r = api.post(f"{base_url}/api/admin/campaigns", headers=h, json=payload)
        assert r.status_code == 200
        cid = r.json()["id"]
        assert r.json()["link_url"] == "https://app.link/install"
        assert r.json()["reward_inr"] == 10.0
        # update link
        r2 = api.put(f"{base_url}/api/admin/campaigns/{cid}", headers=h,
                     json={**payload, "link_url": "https://app.link/v2"})
        assert r2.status_code == 200
        items = api.get(f"{base_url}/api/admin/campaigns", headers=h).json()
        assert any(c["id"] == cid and c["link_url"] == "https://app.link/v2" for c in items)
        api.delete(f"{base_url}/api/admin/campaigns/{cid}", headers=h)


# ---------- Admin Links (telegram_contact) ----------
class TestAdminLinksTelegramContact:
    def test_telegram_contact_field(self, api, base_url, admin_session):
        h = admin_session["headers"]
        payload = {
            "telegram": "https://t.me/taskmint",
            "telegram_contact": "https://t.me/altafsupport",
            "whatsapp": "https://wa/test",
            "customer_support": "mailto:t@t.com",
            "privacy_policy": "https://p", "terms": "https://t",
        }
        r = api.put(f"{base_url}/api/admin/links", headers=h, json=payload)
        assert r.status_code == 200
        pub = api.get(f"{base_url}/api/links").json()
        assert pub.get("telegram_contact") == "https://t.me/altafsupport"


# ---------- Admin Stats DAU + pending_campaigns ----------
class TestAdminStats:
    def test_stats_includes_dau_and_pending_campaigns(self, api, base_url, admin_session, user_session):
        h = admin_session["headers"]
        # ensure user activity today
        api.get(f"{base_url}/api/auth/me", headers=user_session["headers"])
        # create a pending campaign
        camps = api.get(f"{base_url}/api/campaigns").json()
        api.post(f"{base_url}/api/tasks/campaign/{camps[0]['id']}/submit",
                 headers=user_session["headers"], json={})

        r = api.get(f"{base_url}/api/admin/stats", headers=h)
        assert r.status_code == 200
        d = r.json()
        for k in ["users", "pending_withdrawals", "successful_withdrawals",
                  "active_today", "pending_campaigns"]:
            assert k in d, f"Missing stat key: {k}"
            assert isinstance(d[k], int)
        assert d["active_today"] >= 1
        assert d["pending_campaigns"] >= 1
