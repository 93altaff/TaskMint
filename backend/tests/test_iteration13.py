"""Iteration 13 backend tests — version endpoint, admin password rotation,
6h admin session, mobile_number gating, referral history, multi-tier referral payout,
admin user search by mobile.

Auth model:
- Non-admin user is created via POST /api/auth/device (anonymous, no password)
- Admin is promoted via POST /api/auth/admin-login (password = 9372@Altaf93)
"""
import os
import uuid
import time
import pytest
import requests
from datetime import datetime, timezone, timedelta
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
OLD_PASS = "TaskMint@2026"


@pytest.fixture(scope="session")
def db():
    return MongoClient(MONGO)[DBN]


def _device_login(api):
    did = f"TEST_dev_{uuid.uuid4().hex[:12]}"
    # Use a fresh session per device login so cookies don't leak across users
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE}/api/auth/device", json={"device_id": did})
    assert r.status_code == 200, r.text
    d = r.json()
    return d["session_token"], d["user"]["user_id"]


@pytest.fixture
def api():
    # Use a fresh requests instance with NO persistent cookies for per-call testing
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    # Disable cookie jar so device cookies from one fixture don't override another's Bearer
    s.cookies.clear()
    return s


@pytest.fixture
def user(api, db):
    tok, uid = _device_login(api)
    yield {"token": tok, "user_id": uid, "headers": {"Authorization": f"Bearer {tok}"}}
    db.users.delete_one({"user_id": uid})
    db.user_sessions.delete_one({"session_token": tok})
    db.transactions.delete_many({"user_id": uid})


@pytest.fixture
def admin(api, db):
    """Promote a fresh device user to admin via the admin-login endpoint with NEW password."""
    tok, uid = _device_login(api)
    h = {"Authorization": f"Bearer {tok}"}
    r = api.post(f"{BASE}/api/auth/admin-login", headers=h,
                 json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    yield {"token": tok, "user_id": uid, "headers": h}
    # Cleanup — demote and delete
    db.users.delete_one({"user_id": uid})
    db.user_sessions.delete_one({"session_token": tok})


# ---------- Version ----------
class TestVersion:
    def test_public_version(self, api):
        r = api.get(f"{BASE}/api/version")
        assert r.status_code == 200
        d = r.json()
        for k in ("latest_version", "min_supported_version", "play_store_url", "force_update"):
            assert k in d, f"Missing key {k}"
        assert isinstance(d["force_update"], bool)

    def test_admin_version_put(self, api, admin):
        new = {"latest_version": "9.9.9", "min_supported_version": "1.0.0",
               "play_store_url": "https://play.google.com/store/apps/details?id=test",
               "force_update": True}
        r = api.put(f"{BASE}/api/admin/version", headers=admin["headers"], json=new)
        assert r.status_code == 200, r.text
        # verify persistence via public endpoint
        pub = api.get(f"{BASE}/api/version").json()
        assert pub["latest_version"] == "9.9.9"
        assert pub["force_update"] is True
        # restore
        api.put(f"{BASE}/api/admin/version", headers=admin["headers"], json={
            "latest_version": "1.0.0", "min_supported_version": "1.0.0",
            "play_store_url": "", "force_update": False
        })

    def test_admin_version_put_forbidden_for_user(self, api, user):
        r = api.put(f"{BASE}/api/admin/version", headers=user["headers"], json={
            "latest_version": "2", "min_supported_version": "1",
            "play_store_url": "", "force_update": False
        })
        assert r.status_code == 403


# ---------- Admin login password rotation ----------
class TestAdminLoginPassword:
    def test_old_password_rejected(self, api):
        tok, uid = _device_login(api)
        h = {"Authorization": f"Bearer {tok}"}
        r = api.post(f"{BASE}/api/auth/admin-login", headers=h,
                     json={"email": ADMIN_EMAIL, "password": OLD_PASS})
        assert r.status_code == 401

    def test_new_password_accepted_sets_altaf_and_6h_expiry(self, api, db):
        tok, uid = _device_login(api)
        h = {"Authorization": f"Bearer {tok}"}
        r = api.post(f"{BASE}/api/auth/admin-login", headers=h,
                     json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
        assert r.status_code == 200, r.text
        me = api.get(f"{BASE}/api/auth/me", headers=h).json()
        assert me.get("is_admin") is True
        assert me.get("referral_code") == "ALTAF"
        exp = me.get("admin_session_expires_at")
        assert exp, "admin_session_expires_at missing"
        exp_dt = datetime.fromisoformat(exp)
        now = datetime.now(timezone.utc)
        delta_h = (exp_dt - now).total_seconds() / 3600
        assert 5.5 < delta_h < 6.5, f"expected ~6h, got {delta_h}"
        # cleanup
        db.users.delete_one({"user_id": uid})
        db.user_sessions.delete_one({"session_token": tok})


# ---------- Admin session expiry demotion ----------
class TestAdminSessionExpiry:
    def test_expired_session_demotes_on_me(self, api, db):
        tok, uid = _device_login(api)
        h = {"Authorization": f"Bearer {tok}"}
        api.post(f"{BASE}/api/auth/admin-login", headers=h,
                 json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
        # push expiry to past
        past = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
        db.users.update_one({"user_id": uid}, {"$set": {"admin_session_expires_at": past}})
        me = api.get(f"{BASE}/api/auth/me", headers=h).json()
        assert me.get("is_admin") is False
        # cleanup
        db.users.delete_one({"user_id": uid})
        db.user_sessions.delete_one({"session_token": tok})


# ---------- Mobile number flow ----------
class TestMobileFlow:
    def test_set_mobile_validation(self, api, user):
        # mismatched
        r = api.post(f"{BASE}/api/profile/mobile", headers=user["headers"],
                     json={"mobile_number": "9999999999", "confirm_mobile_number": "8888888888"})
        assert r.status_code == 400
        # too short
        r = api.post(f"{BASE}/api/profile/mobile", headers=user["headers"],
                     json={"mobile_number": "12345", "confirm_mobile_number": "12345"})
        assert r.status_code == 400
        # success
        r = api.post(f"{BASE}/api/profile/mobile", headers=user["headers"],
                     json={"mobile_number": "9876543210", "confirm_mobile_number": "9876543210"})
        assert r.status_code == 200, r.text
        assert r.json().get("mobile_number") == "9876543210"
        # second call rejected
        r = api.post(f"{BASE}/api/profile/mobile", headers=user["headers"],
                     json={"mobile_number": "1234567890", "confirm_mobile_number": "1234567890"})
        assert r.status_code == 400

    def test_withdraw_blocked_without_mobile(self, api, user, db):
        # set enough points
        db.users.update_one({"user_id": user["user_id"]}, {"$set": {"points": 5000, "mobile_number": None}})
        r = api.post(f"{BASE}/api/withdraw", headers=user["headers"],
                     json={"method": "upi", "points": 100, "upi_id": "x@upi"})
        # Expected 400 with hint to add mobile number
        assert r.status_code == 400, f"Expected 400 (mobile gating), got {r.status_code}: {r.text}"
        msg = (r.json().get("detail") or "").lower()
        assert "mobile" in msg, f"Expected 'mobile' in error msg, got: {r.text}"

    def test_withdraw_succeeds_after_mobile_set(self, api, user, db):
        db.users.update_one({"user_id": user["user_id"]},
                            {"$set": {"points": 5000, "mobile_number": "9876543210"}})
        r = api.post(f"{BASE}/api/withdraw", headers=user["headers"],
                     json={"method": "upi", "points": 100, "upi_id": "x@upi"})
        assert r.status_code == 200, r.text


# ---------- Admin search by mobile ----------
class TestAdminUserSearchMobile:
    def test_search_by_mobile_substring(self, api, admin, user, db):
        unique_mob = "777" + str(int(time.time() * 1000))[-7:]
        db.users.update_one({"user_id": user["user_id"]}, {"$set": {"mobile_number": unique_mob}})
        r = api.get(f"{BASE}/api/admin/users", headers=admin["headers"],
                    params={"q": unique_mob[3:9]})
        assert r.status_code == 200
        items = r.json()
        assert any(u["user_id"] == user["user_id"] for u in items), \
            f"User not found by mobile substring; got {len(items)} results"


# ---------- Referrals ----------
class TestReferrals:
    def test_history_requires_auth(self, api):
        r = api.get(f"{BASE}/api/referrals/history")
        assert r.status_code == 401

    def test_history_shape(self, api, user):
        r = api.get(f"{BASE}/api/referrals/history", headers=user["headers"])
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        # may be empty for fresh user; create a referee to populate
        # (just shape-check if any)
        for it in items:
            for k in ("user_id", "name", "streak", "last_checkin", "joined_at", "rewards_paid"):
                assert k in it

    def test_admin_user_referrals(self, api, admin, user):
        r = api.get(f"{BASE}/api/admin/users/{user['user_id']}/referrals",
                    headers=admin["headers"])
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_user_referrals_forbidden_for_user(self, api, user):
        r = api.get(f"{BASE}/api/admin/users/{user['user_id']}/referrals",
                    headers=user["headers"])
        assert r.status_code == 403

    def test_referral_settings_tiers_and_sharing_text(self, api, admin, user):
        new = {
            "streak_7_reward_points": 0,
            "streak_15_reward_points": 0,
            "tiers": [{"streak_days": 3, "points": 500}],
            "sharing_text": "TEST share with code {code}",
        }
        r = api.put(f"{BASE}/api/admin/referral-settings", headers=admin["headers"], json=new)
        assert r.status_code == 200, r.text
        me = api.get(f"{BASE}/api/referrals/me", headers=user["headers"]).json()
        assert "TEST share with code" in (me.get("sharing_text") or "")
        tiers = me.get("tiers") or []
        assert any(int(t.get("streak_days", 0)) == 3 and int(t.get("points", 0)) == 500
                   for t in tiers)


# ---------- Multi-tier referral payout ----------
class TestTieredReferralPayout:
    def test_3day_streak_pays_referrer_500(self, api, admin, db):
        # Ensure tiers configured
        api.put(f"{BASE}/api/admin/referral-settings", headers=admin["headers"], json={
            "streak_7_reward_points": 0, "streak_15_reward_points": 0,
            "tiers": [{"streak_days": 3, "points": 500}],
            "sharing_text": "Join with {code}",
        })
        # Create referrer + referee
        ref_tok, ref_uid = _device_login(api)
        ree_tok, ree_uid = _device_login(api)
        ref_h = {"Authorization": f"Bearer {ref_tok}"}
        ree_h = {"Authorization": f"Bearer {ree_tok}"}

        # Get referrer code
        ref_me = api.get(f"{BASE}/api/referrals/me", headers=ref_h).json()
        code = ref_me["referral_code"]

        # Apply code on referee
        r = api.post(f"{BASE}/api/referrals/apply", headers=ree_h, json={"code": code})
        assert r.status_code == 200, r.text

        # Capture starting points of referrer
        before = api.get(f"{BASE}/api/auth/me", headers=ref_h).json()["points"]

        # Force the referee to streak progression by manually setting last_checkin
        # to two days ago, streak=2; then check-in today -> streak=3 -> tier hit
        two_days_ago = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
        # We bypass the day-by-day loop by setting streak=2 with last_checkin=yesterday
        db.users.update_one({"user_id": ree_uid},
                            {"$set": {"streak": 2, "last_checkin": two_days_ago}})
        r = api.post(f"{BASE}/api/tasks/checkin", headers=ree_h)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["streak"] == 3, f"expected streak 3, got {body}"

        # Referrer should have gained 500
        after = api.get(f"{BASE}/api/auth/me", headers=ref_h).json()["points"]
        assert after - before == 500, f"Expected +500 referral bonus; got {after - before}"

        # referee.referral_rewards_paid should contain 3
        ree_doc = db.users.find_one({"user_id": ree_uid}, {"_id": 0, "referral_rewards_paid": 1})
        assert 3 in (ree_doc.get("referral_rewards_paid") or [])

        # cleanup
        for t, u in [(ref_tok, ref_uid), (ree_tok, ree_uid)]:
            db.users.delete_one({"user_id": u})
            db.user_sessions.delete_one({"session_token": t})
            db.transactions.delete_many({"user_id": u})
