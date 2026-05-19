"""Iteration 17 — Admin canonical account + admin user drill-down endpoints."""
import os
import uuid
import time
import pytest
import requests

from dotenv import dotenv_values

_FE_ENV = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL")
            or _FE_ENV.get("EXPO_PUBLIC_BACKEND_URL")
            or "http://localhost:8001").rstrip("/")

ADMIN_EMAIL = "93altaff@gmail.com"
ADMIN_PASSWORD = "9372@Altaf93"
ADMIN_USER_ID = "admin_altaff"


# --------------- Helpers -----------------

def _device_login():
    """Create a fresh anonymous device user + session token."""
    device_id = f"TEST_dev_{uuid.uuid4().hex[:16]}"
    r = requests.post(f"{BASE_URL}/api/auth/device", json={"device_id": device_id}, timeout=15)
    assert r.status_code == 200, f"device login failed: {r.status_code} {r.text}"
    data = r.json()
    return {
        "device_id": device_id,
        "token": data["session_token"],
        "user": data["user"],
        "headers": {"Authorization": f"Bearer {data['session_token']}"},
    }


def _admin_login(headers):
    r = requests.post(
        f"{BASE_URL}/api/auth/admin-login",
        headers=headers,
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    return r


def _admin_logout(headers):
    r = requests.post(f"{BASE_URL}/api/auth/admin-logout", headers=headers, timeout=15)
    return r


def _me(headers):
    return requests.get(f"{BASE_URL}/api/auth/me", headers=headers, timeout=15)


# --------------- Tests -----------------

class TestSmokeBasics:
    """Public/public-ish endpoints should keep responding."""

    def test_banners(self):
        r = requests.get(f"{BASE_URL}/api/banners", timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_campaigns(self):
        r = requests.get(f"{BASE_URL}/api/campaigns", timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_links(self):
        r = requests.get(f"{BASE_URL}/api/links", timeout=15)
        assert r.status_code == 200

    def test_admob_settings(self):
        r = requests.get(f"{BASE_URL}/api/admob-settings", timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert isinstance(body, dict)

    def test_auth_me_with_device(self):
        sess = _device_login()
        r = _me(sess["headers"])
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["user_id"] == sess["user"]["user_id"]


class TestAdminCanonicalAccount:
    """Iteration 17 — admin login/logout must not create extra admin users."""

    def test_admin_login_remaps_session_no_extra_user(self):
        sess = _device_login()
        original_uid = sess["user"]["user_id"]
        original_name = sess["user"]["name"]
        original_ref = sess["user"].get("referral_code")

        r1 = _admin_login(sess["headers"])
        assert r1.status_code == 200, r1.text
        body = r1.json()
        assert body["ok"] is True
        assert body["user"]["user_id"] == ADMIN_USER_ID
        assert body["user"]["is_admin"] is True

        # auth/me on this session now reports the admin
        me = _me(sess["headers"])
        assert me.status_code == 200
        assert me.json()["user_id"] == ADMIN_USER_ID

        # Device-user row must be untouched -> fetch it via admin listing
        users = requests.get(
            f"{BASE_URL}/api/admin/users", headers=sess["headers"], timeout=15
        )
        assert users.status_code == 200
        ulist = users.json()
        original_row = next((u for u in ulist if u.get("user_id") == original_uid), None)
        assert original_row is not None, "original device-user row missing from /admin/users"
        assert original_row.get("name") == original_name, "device-user name was mutated"
        if original_ref is not None:
            assert original_row.get("referral_code") == original_ref, "device-user referral_code mutated"
        assert original_row.get("is_admin") in (False, None)

    def test_repeat_admin_login_does_not_create_duplicate(self):
        sess = _device_login()
        r1 = _admin_login(sess["headers"])
        assert r1.status_code == 200
        r2 = _admin_login(sess["headers"])
        assert r2.status_code == 200
        assert r2.json()["user"]["user_id"] == ADMIN_USER_ID

        # Exactly one user named "Altaf (Admin)" across the whole list.
        users = requests.get(
            f"{BASE_URL}/api/admin/users", headers=sess["headers"], timeout=15
        ).json()
        admin_rows = [u for u in users if (u.get("name") or "") == "Altaf (Admin)"]
        assert len(admin_rows) == 1, f"expected exactly 1 admin row, got {len(admin_rows)}: {[r.get('user_id') for r in admin_rows]}"
        assert admin_rows[0].get("user_id") == ADMIN_USER_ID

        # Also: no other user should hold the ALTAF referral code.
        altaf_rows = [u for u in users if (u.get("referral_code") or "").upper() == "ALTAF"]
        assert len(altaf_rows) == 1
        assert altaf_rows[0]["user_id"] == ADMIN_USER_ID

    def test_admin_logout_restores_device_user(self):
        sess = _device_login()
        original_uid = sess["user"]["user_id"]

        # promote
        assert _admin_login(sess["headers"]).status_code == 200
        # me => admin
        assert _me(sess["headers"]).json()["user_id"] == ADMIN_USER_ID

        # logout
        r = _admin_logout(sess["headers"])
        assert r.status_code == 200, r.text
        # me => original device user, is_admin=False
        me = _me(sess["headers"])
        assert me.status_code == 200
        body = me.json()
        assert body["user_id"] == original_uid, f"session not restored to device user, got {body['user_id']}"
        assert body.get("is_admin") in (False, None)

    def test_repeat_login_logout_keeps_single_admin(self):
        # full round-trip; admin row count should stay at 1 throughout.
        sess = _device_login()
        for _ in range(2):
            assert _admin_login(sess["headers"]).status_code == 200
            users = requests.get(
                f"{BASE_URL}/api/admin/users", headers=sess["headers"], timeout=15
            ).json()
            admins = [u for u in users if u.get("user_id") == ADMIN_USER_ID]
            assert len(admins) == 1
            assert _admin_logout(sess["headers"]).status_code == 200


class TestAdminUsersListing:
    def test_admin_users_filtered_active(self):
        sess = _device_login()
        assert _admin_login(sess["headers"]).status_code == 200
        r = requests.get(
            f"{BASE_URL}/api/admin/users?active=1", headers=sess["headers"], timeout=15
        )
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        _admin_logout(sess["headers"])

    def test_admin_users_unauth(self):
        # No bearer => must be 401/403
        r = requests.get(f"{BASE_URL}/api/admin/users", timeout=15)
        assert r.status_code in (401, 403)


class TestAdminUserDrillDowns:
    """New per-card drill endpoints."""

    @pytest.fixture(scope="class")
    def admin_sess(self):
        sess = _device_login()
        r = _admin_login(sess["headers"])
        assert r.status_code == 200, r.text
        yield sess
        _admin_logout(sess["headers"])

    def test_withdrawals_endpoint(self, admin_sess):
        r = requests.get(
            f"{BASE_URL}/api/admin/users/{ADMIN_USER_ID}/withdrawals",
            headers=admin_sess["headers"], timeout=15,
        )
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)

    def test_completions_endpoint(self, admin_sess):
        r = requests.get(
            f"{BASE_URL}/api/admin/users/{ADMIN_USER_ID}/completions",
            headers=admin_sess["headers"], timeout=15,
        )
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)

    def test_checkins_endpoint(self, admin_sess):
        r = requests.get(
            f"{BASE_URL}/api/admin/users/{ADMIN_USER_ID}/checkins",
            headers=admin_sess["headers"], timeout=15,
        )
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)

    def test_referrals_endpoint_still_works(self, admin_sess):
        r = requests.get(
            f"{BASE_URL}/api/admin/users/{ADMIN_USER_ID}/referrals",
            headers=admin_sess["headers"], timeout=15,
        )
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)

    def test_transactions_endpoint_still_works(self, admin_sess):
        r = requests.get(
            f"{BASE_URL}/api/admin/users/{ADMIN_USER_ID}/transactions",
            headers=admin_sess["headers"], timeout=15,
        )
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)

    def test_drilldowns_require_admin_auth(self):
        # No bearer
        for path in ("withdrawals", "completions", "checkins"):
            r = requests.get(
                f"{BASE_URL}/api/admin/users/{ADMIN_USER_ID}/{path}", timeout=15
            )
            assert r.status_code in (401, 403), f"{path}: expected 401/403, got {r.status_code}"

    def test_drilldowns_reject_non_admin(self):
        # Device session (non-admin) => must be 403
        sess = _device_login()
        for path in ("withdrawals", "completions", "checkins"):
            r = requests.get(
                f"{BASE_URL}/api/admin/users/{ADMIN_USER_ID}/{path}",
                headers=sess["headers"], timeout=15,
            )
            assert r.status_code in (401, 403), f"{path}: expected 401/403 for non-admin, got {r.status_code}"
