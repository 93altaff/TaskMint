"""
Anti-clone POST /api/auth/device tests.

Covers the 4 scenarios requested for /app/iteration_13:
  1. Same fingerprint + DIFFERENT device_id  => SAME existing user_id (clone path).
  2. New device (different fingerprint)      => NEW user_id.
  3. Exact device_id match still wins        => SAME user_id (returning user).
  4. Backwards compatibility (no fingerprint)=> pure device_id matching still works.

Read base URL from /app/frontend/.env (EXPO_PUBLIC_BACKEND_URL) per system rules.
"""
import os
import uuid
from pathlib import Path

import pytest
import requests

ENV_FILE = Path("/app/frontend/.env")
BACKEND_URL = None
for line in ENV_FILE.read_text().splitlines():
    if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
        BACKEND_URL = line.split("=", 1)[1].strip().strip('"')
        break

assert BACKEND_URL, "EXPO_PUBLIC_BACKEND_URL missing in /app/frontend/.env"
API = f"{BACKEND_URL}/api"


# ---------- helpers ----------
def post_device(device_id, fingerprint=None, device_meta=None):
    body = {"device_id": device_id}
    if fingerprint is not None:
        body["fingerprint"] = fingerprint
    if device_meta is not None:
        body["device_meta"] = device_meta
    r = requests.post(f"{API}/auth/device", json=body, timeout=20)
    return r


# ---------- 1. clone path: same fp, diff device_id ----------
def test_clone_same_fingerprint_diff_device_id_returns_same_user():
    fp = f"FP_{uuid.uuid4().hex}"
    dev1 = f"orig_{uuid.uuid4().hex[:12]}"
    dev2 = f"clone_{uuid.uuid4().hex[:12]}"  # parallel-space gives different ANDROID_ID

    r1 = post_device(dev1, fingerprint=fp, device_meta={"brand": "Pixel", "model": "8a"})
    assert r1.status_code == 200, r1.text
    uid1 = r1.json()["user"]["user_id"]

    r2 = post_device(dev2, fingerprint=fp, device_meta={"brand": "Pixel", "model": "8a"})
    assert r2.status_code == 200, r2.text
    uid2 = r2.json()["user"]["user_id"]

    assert uid1 == uid2, (
        f"Anti-clone failed: same fingerprint should resolve to SAME user. "
        f"uid1={uid1}, uid2={uid2}"
    )

    # And the original device_id should now also resolve to that user (re-stamp).
    r3 = post_device(dev1, fingerprint=fp)
    assert r3.status_code == 200
    assert r3.json()["user"]["user_id"] == uid1


# ---------- 2. new device: different fingerprint -> new user ----------
def test_new_fingerprint_creates_new_user():
    fp_a = f"FP_{uuid.uuid4().hex}"
    fp_b = f"FP_{uuid.uuid4().hex}"
    dev_a = f"a_{uuid.uuid4().hex[:12]}"
    dev_b = f"b_{uuid.uuid4().hex[:12]}"

    ra = post_device(dev_a, fingerprint=fp_a)
    rb = post_device(dev_b, fingerprint=fp_b)
    assert ra.status_code == 200 and rb.status_code == 200

    uid_a = ra.json()["user"]["user_id"]
    uid_b = rb.json()["user"]["user_id"]
    assert uid_a != uid_b, (
        f"Different fingerprints must produce different users. "
        f"uid_a={uid_a}, uid_b={uid_b}"
    )


# ---------- 3. exact device_id match wins ----------
def test_exact_device_id_match_returns_same_user():
    fp = f"FP_{uuid.uuid4().hex}"
    dev = f"ret_{uuid.uuid4().hex[:12]}"

    r1 = post_device(dev, fingerprint=fp)
    assert r1.status_code == 200
    uid1 = r1.json()["user"]["user_id"]

    # second login with same device_id (even with NO fingerprint) returns same user
    r2 = post_device(dev)
    assert r2.status_code == 200
    uid2 = r2.json()["user"]["user_id"]
    assert uid1 == uid2

    # third login with same device_id and a DIFFERENT fingerprint still wins via exact id
    r3 = post_device(dev, fingerprint=f"FP_{uuid.uuid4().hex}")
    assert r3.status_code == 200
    assert r3.json()["user"]["user_id"] == uid1


# ---------- 4. backwards compatibility: no fingerprint ----------
def test_no_fingerprint_still_works_returning_user():
    dev = f"legacy_{uuid.uuid4().hex[:12]}"
    r1 = post_device(dev)  # no fingerprint at all
    assert r1.status_code == 200, r1.text
    uid1 = r1.json()["user"]["user_id"]
    assert "session_token" in r1.json()

    r2 = post_device(dev)  # same device_id again
    assert r2.status_code == 200
    assert r2.json()["user"]["user_id"] == uid1


def test_no_fingerprint_diff_device_ids_create_separate_users():
    """Without fingerprint, the server has no way to know two device_ids are
    the same physical phone — so they must be treated as separate users."""
    d1 = f"nf1_{uuid.uuid4().hex[:12]}"
    d2 = f"nf2_{uuid.uuid4().hex[:12]}"
    r1 = post_device(d1)
    r2 = post_device(d2)
    assert r1.status_code == 200 and r2.status_code == 200
    assert r1.json()["user"]["user_id"] != r2.json()["user"]["user_id"]


# ---------- edge: invalid device_id ----------
def test_invalid_short_device_id_rejected():
    r = post_device("abc")  # < 6 chars
    assert r.status_code == 400
    assert "Invalid device ID" in r.text
