"""Iteration 18 backend tests.

Covers:
1) /tasks/spin, /tasks/spin/claim -> reward in [30,100] (x5)
2) /tasks/scratch, /tasks/scratch/claim -> reward in [30,100] (x5)
3) /tasks/survey -> reward in [30,100] (x5)
4) /tasks/quiz   -> reward in [30,100] (x5)
5) /tasks/visit  -> first completion reward in [30,100]
6) /tasks/surveys/random -> every reward in [30,100]
7) /tasks/watch  -> 20 successes (reward 20-50) + 21st returns HTTP 400
   detail.code='watch_cooldown' & future resets_at ISO
8) /auth/me      -> exposes watch_cycle_started_at, watch_cycle_used
"""
import os
import uuid
from datetime import datetime, timezone
from typing import Tuple, Dict

import pytest
import requests
from dotenv import dotenv_values
from pymongo import MongoClient

_FE = dotenv_values("/app/frontend/.env")
_BE = dotenv_values("/app/backend/.env")
BASE = (os.environ.get("EXPO_PUBLIC_BACKEND_URL")
        or _FE.get("EXPO_PUBLIC_BACKEND_URL")).rstrip("/")
MONGO = os.environ.get("MONGO_URL") or _BE.get("MONGO_URL")
DBN = os.environ.get("DB_NAME") or _BE.get("DB_NAME")

ADMIN_EMAIL = "93altaff@gmail.com"
ADMIN_PASS = "9372@Altaf93"


# ----------------- fixtures / helpers -----------------
@pytest.fixture(scope="session")
def db():
    return MongoClient(MONGO)[DBN]


@pytest.fixture
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _device(api) -> Tuple[str, str]:
    device_id = f"TEST-iter18-{uuid.uuid4().hex[:14]}"
    r = api.post(f"{BASE}/api/auth/device", json={"device_id": device_id}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["session_token"], r.json()["user"]["user_id"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _admin(api) -> str:
    tok, _ = _device(api)
    r = api.post(
        f"{BASE}/api/auth/admin-login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASS},
        headers=_auth(tok),
        timeout=20,
    )
    assert r.status_code == 200, r.text
    return tok


# ----------------- spin -----------------
class TestSpinRewardRange:
    def test_5_spins_in_30_to_100(self, api, db):
        tok, uid = _device(api)
        try:
            for i in range(5):
                r = api.post(f"{BASE}/api/tasks/spin", headers=_auth(tok), timeout=20)
                assert r.status_code == 200, r.text
                rwd = r.json()["reward"]
                assert isinstance(rwd, int) and 30 <= rwd <= 100, f"spin reward out of range: {rwd}"
                c = api.post(f"{BASE}/api/tasks/spin/claim", headers=_auth(tok), timeout=20)
                assert c.status_code == 200, c.text
                assert c.json()["reward"] == rwd
        finally:
            db.users.delete_one({"user_id": uid})


# ----------------- scratch -----------------
class TestScratchRewardRange:
    def test_5_scratches_in_30_to_100(self, api, db):
        tok, uid = _device(api)
        try:
            for i in range(5):
                r = api.post(f"{BASE}/api/tasks/scratch", headers=_auth(tok), timeout=20)
                assert r.status_code == 200, r.text
                rwd = r.json()["reward"]
                assert isinstance(rwd, int) and 30 <= rwd <= 100, f"scratch reward out of range: {rwd}"
                c = api.post(f"{BASE}/api/tasks/scratch/claim", headers=_auth(tok), timeout=20)
                assert c.status_code == 200, c.text
                assert c.json()["reward"] == rwd
        finally:
            db.users.delete_one({"user_id": uid})


# ----------------- survey -----------------
class TestSurveyRewardRange:
    def test_5_surveys_in_30_to_100(self, api, db):
        tok, uid = _device(api)
        try:
            for i in range(5):
                r = api.post(f"{BASE}/api/tasks/survey", headers=_auth(tok), timeout=20)
                assert r.status_code == 200, r.text
                rwd = r.json()["reward"]
                assert isinstance(rwd, int) and 30 <= rwd <= 100, f"survey reward out of range: {rwd}"
        finally:
            db.users.delete_one({"user_id": uid})

    def test_random_surveys_all_in_range(self, api, db):
        tok, uid = _device(api)
        try:
            r = api.get(f"{BASE}/api/tasks/surveys/random?limit=5", headers=_auth(tok), timeout=20)
            assert r.status_code == 200, r.text
            items = r.json()
            assert isinstance(items, list) and len(items) > 0
            for s in items:
                rwd = s.get("reward")
                assert isinstance(rwd, int) and 30 <= rwd <= 100, f"random survey reward out of range: {rwd}"
        finally:
            db.users.delete_one({"user_id": uid})


# ----------------- quiz -----------------
class TestQuizRewardRange:
    def test_5_quizzes_in_30_to_100(self, api, db):
        tok, uid = _device(api)
        try:
            for i in range(5):
                r = api.post(
                    f"{BASE}/api/tasks/quiz",
                    headers=_auth(tok),
                    json={"correct": 5, "total": 5},
                    timeout=20,
                )
                assert r.status_code == 200, r.text
                rwd = r.json()["reward"]
                assert isinstance(rwd, int) and 30 <= rwd <= 100, f"quiz reward out of range: {rwd}"
        finally:
            db.users.delete_one({"user_id": uid})


# ----------------- visit -----------------
class TestVisitRewardRange:
    def test_first_completion_in_30_to_100(self, api, db):
        # Ensure at least one active visit site (seed if missing)
        admin_tok = _admin(api)
        sites = api.get(f"{BASE}/api/visit-sites", timeout=20)
        site_id = None
        seeded_id = None
        if sites.status_code == 200 and sites.json():
            site_id = sites.json()[0]["id"]
        else:
            # Seed via admin
            c = api.post(
                f"{BASE}/api/admin/visit-sites",
                headers=_auth(admin_tok),
                json={"title": "TEST visit", "url": "https://example.com", "active": True},
                timeout=20,
            )
            assert c.status_code == 200, c.text
            seeded_id = c.json()["id"]
            site_id = seeded_id

        tok, uid = _device(api)
        try:
            r = api.post(
                f"{BASE}/api/tasks/visit",
                headers=_auth(tok),
                json={"site_id": site_id},
                timeout=20,
            )
            assert r.status_code == 200, r.text
            rwd = r.json()["reward"]
            assert isinstance(rwd, int) and 30 <= rwd <= 100, f"visit reward out of range: {rwd}"
        finally:
            db.users.delete_one({"user_id": uid})
            if seeded_id:
                api.delete(f"{BASE}/api/admin/visit-sites/{seeded_id}", headers=_auth(admin_tok), timeout=20)


# ----------------- watch 6h cycle -----------------
class TestWatchCycle:
    def test_20_successes_then_21st_400_with_cooldown(self, api, db):
        tok, uid = _device(api)
        try:
            rewards = []
            for i in range(20):
                r = api.post(f"{BASE}/api/tasks/watch", headers=_auth(tok), timeout=20)
                assert r.status_code == 200, f"watch #{i + 1} failed: {r.status_code} {r.text}"
                j = r.json()
                rwd = j["reward"]
                assert isinstance(rwd, int) and 20 <= rwd <= 50, f"watch reward out of range: {rwd}"
                rewards.append(rwd)
                # remaining must be 20 - new_used
                assert j["remaining"] == 20 - (i + 1)
                assert "cycle_resets_at" in j

            # 21st call -> 400 with code='watch_cooldown'
            r21 = api.post(f"{BASE}/api/tasks/watch", headers=_auth(tok), timeout=20)
            assert r21.status_code == 400, f"expected 400 on 21st, got {r21.status_code} {r21.text}"
            body = r21.json()
            detail = body.get("detail") or {}
            assert isinstance(detail, dict), f"detail must be dict, got: {body}"
            assert detail.get("code") == "watch_cooldown", body
            resets_at = detail.get("resets_at")
            assert resets_at, body
            # resets_at must be a future ISO timestamp
            dt = datetime.fromisoformat(resets_at)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            assert dt > datetime.now(timezone.utc), f"resets_at must be in the future, got {resets_at}"
        finally:
            db.users.delete_one({"user_id": uid})


# ----------------- auth/me exposes new fields -----------------
class TestAuthMeExposesWatchCycleFields:
    def test_fields_present_after_one_watch(self, api, db):
        tok, uid = _device(api)
        try:
            # Pre: hit auth/me before any watch
            me0 = api.get(f"{BASE}/api/auth/me", headers=_auth(tok), timeout=20).json()
            # Fields should at minimum be readable (null + 0)
            # (Server may omit watch_cycle_started_at until first watch; accept None/missing
            # but watch_cycle_used should be an int after first watch.)

            # do 1 watch -> fields must reflect
            r = api.post(f"{BASE}/api/tasks/watch", headers=_auth(tok), timeout=20)
            assert r.status_code == 200, r.text

            me1 = api.get(f"{BASE}/api/auth/me", headers=_auth(tok), timeout=20).json()
            assert "watch_cycle_started_at" in me1, f"missing field in /auth/me: {list(me1.keys())}"
            assert "watch_cycle_used" in me1, f"missing field in /auth/me: {list(me1.keys())}"

            wcs = me1["watch_cycle_started_at"]
            assert wcs is None or isinstance(wcs, str)
            if isinstance(wcs, str):
                # parseable ISO
                datetime.fromisoformat(wcs)
            assert isinstance(me1["watch_cycle_used"], int)
            assert me1["watch_cycle_used"] == 1
        finally:
            db.users.delete_one({"user_id": uid})
