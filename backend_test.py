"""
TaskMint backend tests focused on the 4 high-priority flows requested:
1) Permanently delete user (admin) — DELETE /api/admin/users/{user_id}
2) Reject withdrawal with admin_note — PUT /api/admin/withdrawals/{id}
3) Watch & Earn — POST /api/tasks/watch
4) Campaign completion review — PUT /api/admin/campaign-completions/{id} + DELETE reset
Plus smoke checks: /api/links business_contact, /api/auth/me, /api/auth/admin-login bad password.
"""
import os
import sys
import uuid
import json
import time
import requests
from pathlib import Path

# Read backend URL from frontend/.env per system rules
ENV_FILE = Path("/app/frontend/.env")
BACKEND_URL = None
for line in ENV_FILE.read_text().splitlines():
    if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
        BACKEND_URL = line.split("=", 1)[1].strip().strip('"')
        break

if not BACKEND_URL:
    print("FATAL: EXPO_PUBLIC_BACKEND_URL not found in /app/frontend/.env")
    sys.exit(1)

API = f"{BACKEND_URL}/api"
print(f"[setup] API base: {API}")

results = []  # list of (name, ok, detail)


def log(name, ok, detail=""):
    icon = "PASS" if ok else "FAIL"
    print(f"[{icon}] {name} :: {detail}")
    results.append((name, ok, detail))


def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def device_login(device_id):
    r = requests.post(f"{API}/auth/device", json={"device_id": device_id}, timeout=20)
    r.raise_for_status()
    j = r.json()
    return j["user"], j["session_token"]


def set_mobile(token, num="9876543210"):
    """Set mobile number for user (required for withdrawal)."""
    r = requests.post(
        f"{API}/profile/mobile",
        headers=auth_headers(token),
        json={"mobile_number": num, "confirm_mobile_number": num},
        timeout=20,
    )
    return r


def admin_login(token):
    r = requests.post(
        f"{API}/auth/admin-login",
        headers=auth_headers(token),
        json={"email": "93altaff@gmail.com", "password": "9372@Altaf93"},
        timeout=20,
    )
    return r


# ---------- Smoke: bad admin password ----------
def smoke_bad_admin_password():
    # need a valid session first
    _, tok = device_login(f"smoke_{uuid.uuid4().hex[:12]}")
    r = requests.post(
        f"{API}/auth/admin-login",
        headers=auth_headers(tok),
        json={"email": "93altaff@gmail.com", "password": "WRONG_PASS"},
        timeout=20,
    )
    log(
        "Smoke: admin login with bad password returns 401",
        r.status_code == 401,
        f"status={r.status_code}, body={r.text[:200]}",
    )


def smoke_links_has_business_contact():
    r = requests.get(f"{API}/links", timeout=20)
    ok = r.status_code == 200 and "business_contact" in r.json()
    log(
        "Smoke: GET /api/links returns business_contact field",
        ok,
        f"status={r.status_code}, keys={list(r.json().keys()) if r.status_code == 200 else r.text[:200]}",
    )


def smoke_auth_me():
    _, tok = device_login(f"smoke_me_{uuid.uuid4().hex[:12]}")
    r = requests.get(f"{API}/auth/me", headers=auth_headers(tok), timeout=20)
    ok = r.status_code == 200 and r.json().get("user_id", "").startswith("user_")
    log(
        "Smoke: GET /api/auth/me returns the user",
        ok,
        f"status={r.status_code}, user_id={r.json().get('user_id') if r.status_code == 200 else r.text[:200]}",
    )


# ---------- Build admin context ----------
def build_admin():
    device_id = f"admin_dev_{uuid.uuid4().hex[:12]}"
    user, tok = device_login(device_id)
    r = admin_login(tok)
    if r.status_code != 200:
        raise RuntimeError(f"Admin login failed: {r.status_code} {r.text}")
    me = requests.get(f"{API}/auth/me", headers=auth_headers(tok), timeout=20).json()
    print(f"[setup] admin user_id={me['user_id']}, is_admin={me.get('is_admin')}")
    return me, tok


# ---------- Test 1: Permanently delete user ----------
def test_delete_user(admin_user, admin_tok):
    title = "1) Permanently delete user (admin)"

    # fresh user
    fresh_dev = f"deluser_{uuid.uuid4().hex[:12]}"
    fu, ftok = device_login(fresh_dev)
    fid = fu["user_id"]
    print(f"[t1] fresh user_id={fid}")

    # Seed some related data: adjust points + create a withdrawal + create a campaign completion
    # adjust-points (gives them points + transaction)
    r = requests.post(
        f"{API}/admin/users/{fid}/adjust-points",
        headers=auth_headers(admin_tok),
        json={"delta": 200, "reason": "seed for delete test"},
        timeout=20,
    )
    seeded_points_ok = r.status_code == 200
    print(f"[t1] adjust-points status={r.status_code} body={r.text[:200]}")

    # submit a withdraw (creates withdrawal + transaction)
    r = requests.post(
        f"{API}/withdraw",
        headers=auth_headers(ftok),
        json={"method": "upi", "points": 100, "upi_id": "test@upi"},
        timeout=20,
    )
    print(f"[t1] withdraw status={r.status_code} body={r.text[:200]}")

    # Submit a campaign completion: get a campaign first
    cmps = requests.get(f"{API}/campaigns", timeout=20).json()
    if cmps:
        cid = cmps[0]["id"]
        rr = requests.post(
            f"{API}/tasks/campaign/{cid}/submit",
            headers=auth_headers(ftok),
            json={"form_field_1_value": "x", "form_field_2_value": "y"},
            timeout=20,
        )
        print(f"[t1] campaign submit status={rr.status_code} body={rr.text[:200]}")

    # Self-delete should fail
    r = requests.delete(
        f"{API}/admin/users/{admin_user['user_id']}",
        headers=auth_headers(admin_tok),
        timeout=20,
    )
    self_del_ok = r.status_code == 400 and "yourself" in r.text.lower()
    log(
        f"{title} :: cannot delete self (400)",
        self_del_ok,
        f"status={r.status_code}, body={r.text[:200]}",
    )

    # Delete fresh user
    r = requests.delete(
        f"{API}/admin/users/{fid}", headers=auth_headers(admin_tok), timeout=20
    )
    body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
    del_ok = r.status_code == 200 and body.get("ok") is True and body.get("deleted_user_id") == fid
    log(
        f"{title} :: DELETE returns 200 and deleted_user_id",
        del_ok,
        f"status={r.status_code}, body={r.text[:200]}",
    )

    # GET /api/admin/users/{id} should now 404
    r = requests.get(f"{API}/admin/users/{fid}", headers=auth_headers(admin_tok), timeout=20)
    not_found_ok = r.status_code == 404
    log(
        f"{title} :: user no longer found (404)",
        not_found_ok,
        f"status={r.status_code}",
    )

    # /admin/users list should not contain the user
    r = requests.get(f"{API}/admin/users", headers=auth_headers(admin_tok), timeout=20)
    ids = [u.get("user_id") for u in r.json()] if r.status_code == 200 else []
    list_ok = fid not in ids
    log(
        f"{title} :: user excluded from /admin/users",
        list_ok,
        f"present={fid in ids}, total_users={len(ids)}",
    )

    # cascade: transactions for that user should be empty
    r = requests.get(
        f"{API}/admin/users/{fid}/transactions", headers=auth_headers(admin_tok), timeout=20
    )
    txn_count = len(r.json()) if r.status_code == 200 else -1
    cascade_txn_ok = txn_count == 0
    log(
        f"{title} :: transactions cascade-cleared",
        cascade_txn_ok,
        f"txn_count={txn_count}, status={r.status_code}",
    )

    # cascade: no withdrawal for user remains
    r = requests.get(f"{API}/admin/withdrawals", headers=auth_headers(admin_tok), timeout=20)
    wd_match = [w for w in r.json() if w.get("user_id") == fid] if r.status_code == 200 else []
    log(
        f"{title} :: withdrawals cascade-cleared",
        len(wd_match) == 0,
        f"remaining_withdrawals_for_user={len(wd_match)}",
    )

    # cascade: no campaign completion remains
    r = requests.get(
        f"{API}/admin/campaign-completions", headers=auth_headers(admin_tok), timeout=20
    )
    cc_match = [c for c in r.json() if c.get("user_id") == fid] if r.status_code == 200 else []
    log(
        f"{title} :: campaign completions cascade-cleared",
        len(cc_match) == 0,
        f"remaining_completions_for_user={len(cc_match)}",
    )

    # session invalid: GET /auth/me should be 401
    r = requests.get(f"{API}/auth/me", headers=auth_headers(ftok), timeout=20)
    sess_ok = r.status_code == 401
    log(
        f"{title} :: deleted user's session no longer valid (401)",
        sess_ok,
        f"status={r.status_code}",
    )


# ---------- Test 2: Reject withdrawal with admin_note ----------
def test_reject_withdrawal(admin_tok):
    title = "2) Reject withdrawal with admin_note"

    # Fresh user; seed 200 pts so we can do a 100-pt withdraw twice
    dev = f"wd_{uuid.uuid4().hex[:12]}"
    fu, ftok = device_login(dev)
    fid = fu["user_id"]

    # Seed enough for two withdrawals. Note: after the first successful submission,
    # has_first_withdrawal flips to True and minimum becomes 10000.
    r = requests.post(
        f"{API}/admin/users/{fid}/adjust-points",
        headers=auth_headers(admin_tok),
        json={"delta": 10100, "reason": "seed for withdraw test"},
        timeout=20,
    )
    print(f"[t2] adjust-points status={r.status_code} body={r.text[:200]}")
    assert r.status_code == 200, r.text

    # Set mobile number (required for withdrawals)
    mr = set_mobile(ftok)
    print(f"[t2] set_mobile status={mr.status_code} body={mr.text[:200]}")
    assert mr.status_code == 200, mr.text

    # Submit withdrawal #1 (will be REJECTED). Min for first withdrawal is 100.
    pts1 = 100
    r = requests.post(
        f"{API}/withdraw",
        headers=auth_headers(ftok),
        json={"method": "upi", "points": pts1, "upi_id": "rejtest@upi"},
        timeout=20,
    )
    print(f"[t2] withdraw#1 status={r.status_code} body={r.text[:200]}")
    assert r.status_code == 200, r.text
    wid1 = r.json()["id"]

    # Capture user points after withdraw deduction
    me1 = requests.get(f"{API}/auth/me", headers=auth_headers(ftok), timeout=20).json()
    pts_after_wd = me1.get("points", 0)
    print(f"[t2] points after withdraw#1 deduction = {pts_after_wd}")

    # Reject as admin
    r = requests.put(
        f"{API}/admin/withdrawals/{wid1}",
        headers=auth_headers(admin_tok),
        json={"status": "rejected", "admin_note": "Test reason"},
        timeout=20,
    )
    log(
        f"{title} :: reject endpoint returns 200",
        r.status_code == 200,
        f"status={r.status_code}, body={r.text[:200]}",
    )

    # Verify withdrawal record updated
    wlist = requests.get(f"{API}/admin/withdrawals", headers=auth_headers(admin_tok), timeout=20).json()
    wd1 = next((w for w in wlist if w.get("id") == wid1), None)
    rec_ok = wd1 is not None and wd1.get("status") == "rejected" and wd1.get("admin_note") == "Test reason"
    log(
        f"{title} :: record now status=rejected with admin_note",
        rec_ok,
        f"wd1_status={wd1 and wd1.get('status')}, note={wd1 and wd1.get('admin_note')}",
    )

    # Verify points refunded
    me2 = requests.get(f"{API}/auth/me", headers=auth_headers(ftok), timeout=20).json()
    refund_ok = me2.get("points", 0) == pts_after_wd + pts1
    log(
        f"{title} :: points refunded after rejection",
        refund_ok,
        f"before={pts_after_wd}, after={me2.get('points')}, expected={pts_after_wd + pts1}",
    )

    # Verify a refund transaction exists
    txns = requests.get(
        f"{API}/admin/users/{fid}/transactions", headers=auth_headers(admin_tok), timeout=20
    ).json()
    refund_txn = [t for t in txns if t.get("source") == "withdraw" and t.get("points", 0) > 0]
    log(
        f"{title} :: refund transaction logged",
        len(refund_txn) >= 1,
        f"refund_txns={[t.get('note') for t in refund_txn][:3]}",
    )

    # Submit withdrawal #2 (will be APPROVED -> successful, points NOT refunded)
    # Min is now 10000 because has_first_withdrawal flipped True after #1 submission.
    pts2 = 10000
    r = requests.post(
        f"{API}/withdraw",
        headers=auth_headers(ftok),
        json={"method": "upi", "points": pts2, "upi_id": "okt@upi"},
        timeout=20,
    )
    print(f"[t2] withdraw#2 status={r.status_code} body={r.text[:200]}")
    assert r.status_code == 200, r.text
    wid2 = r.json()["id"]

    me3 = requests.get(f"{API}/auth/me", headers=auth_headers(ftok), timeout=20).json()
    pts_before_approval = me3.get("points", 0)

    r = requests.put(
        f"{API}/admin/withdrawals/{wid2}",
        headers=auth_headers(admin_tok),
        json={"status": "successful", "admin_note": "OK"},
        timeout=20,
    )
    log(
        f"{title} :: approve endpoint returns 200",
        r.status_code == 200,
        f"status={r.status_code}, body={r.text[:200]}",
    )

    me4 = requests.get(f"{API}/auth/me", headers=auth_headers(ftok), timeout=20).json()
    no_refund_ok = me4.get("points", 0) == pts_before_approval
    log(
        f"{title} :: approval does NOT refund points",
        no_refund_ok,
        f"before={pts_before_approval}, after={me4.get('points')}",
    )


# ---------- Test 3: Watch & Earn ----------
def test_watch_earn():
    title = "3) Watch & Earn (POST /api/tasks/watch)"
    dev = f"watch_{uuid.uuid4().hex[:12]}"
    fu, ftok = device_login(dev)

    me0 = requests.get(f"{API}/auth/me", headers=auth_headers(ftok), timeout=20).json()
    p0 = me0.get("points", 0)
    earned0 = me0.get("total_earned", 0)
    print(f"[t3] starting points={p0}, total_earned={earned0}")

    rewards = []
    remainings = []
    last_status = None
    last_body = None
    # Spec (iter 17+): 6-hour cycle, 20 successes then 21st returns
    # HTTP 400 with detail.code='watch_cooldown' and future resets_at ISO.
    CYCLE_LIMIT = 20
    max_attempts = CYCLE_LIMIT + 1
    successful_calls = 0
    limit_reached_at = None
    last_json = None
    for i in range(max_attempts):
        r = requests.post(f"{API}/tasks/watch", headers=auth_headers(ftok), timeout=20)
        last_status = r.status_code
        last_body = r.text
        try:
            last_json = r.json()
        except Exception:
            last_json = None
        if r.status_code == 200:
            j = last_json or {}
            rewards.append(j.get("reward"))
            remainings.append(j.get("remaining"))
            successful_calls += 1
        else:
            limit_reached_at = i + 1
            break

    # Each successful call: reward int 20-50
    rewards_in_range = all(isinstance(x, int) and 20 <= x <= 50 for x in rewards)
    log(
        f"{title} :: each successful response has reward in [20,50]",
        rewards_in_range and len(rewards) > 0,
        f"successful_calls={successful_calls}, sample_rewards={rewards[:7]}",
    )

    # remaining counter present in every successful response
    remaining_ok = all(isinstance(x, int) for x in remainings) and len(remainings) == successful_calls
    log(
        f"{title} :: every successful response includes 'remaining' counter",
        remaining_ok,
        f"sample_remainings={remainings[:7]}",
    )

    # SPEC (iter 17+): 20 successful, 21st returns 400 with cycle_cooldown
    spec_match = successful_calls == CYCLE_LIMIT and limit_reached_at == CYCLE_LIMIT + 1
    log(
        f"{title} :: SPEC — 20 successful then 21st returns 400",
        spec_match,
        f"successful_calls={successful_calls}, limit_reached_at_call={limit_reached_at}, "
        f"final_status={last_status}, final_body={last_body[:160] if last_body else ''}",
    )

    # 6-hour cycle: 400 must carry detail.code=='watch_cooldown' and future resets_at ISO
    detail = (last_json or {}).get("detail") if isinstance(last_json, dict) else None
    cooldown_ok = (
        last_status == 400
        and isinstance(detail, dict)
        and detail.get("code") == "watch_cooldown"
        and bool(detail.get("resets_at"))
    )
    log(
        f"{title} :: 400 carries detail.code='watch_cooldown' + resets_at",
        cooldown_ok,
        f"final_status={last_status}, detail={detail}",
    )

    # Verify points + total_earned increased by sum(rewards)
    me1 = requests.get(f"{API}/auth/me", headers=auth_headers(ftok), timeout=20).json()
    p1 = me1.get("points", 0)
    earned1 = me1.get("total_earned", 0)
    expected_delta = sum(rewards)
    points_ok = (p1 - p0) == expected_delta and (earned1 - earned0) == expected_delta
    log(
        f"{title} :: user points and total_earned increased by sum of rewards",
        points_ok,
        f"delta_points={p1 - p0}, delta_total_earned={earned1 - earned0}, expected={expected_delta}",
    )

    # Transactions logged with source='watch'
    txns = requests.get(f"{API}/wallet/transactions", headers=auth_headers(ftok), timeout=20).json()
    watch_txns = [t for t in txns if t.get("source") == "watch"]
    txn_ok = len(watch_txns) == successful_calls
    log(
        f"{title} :: transactions logged with source='watch'",
        txn_ok,
        f"watch_txn_count={len(watch_txns)}, expected={successful_calls}",
    )


# ---------- Test 4: Campaign completion review ----------
def test_campaign_review(admin_tok):
    title = "4) Campaign completion review"

    # Create a campaign as admin (using actual model: name, note, logo_url, reward_points, etc.)
    payload = {
        "name": f"Test Campaign {uuid.uuid4().hex[:6]}",
        "note": "Install and complete signup",
        "logo_url": "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=200&h=200&fit=crop",
        "link_url": "https://example.com/install",
        "rules": "1. Install app\n2. Open it\n3. Submit screenshot",
        "telegram_contact_url": "https://t.me/support",
        "form_field_1_label": "App Username",
        "form_field_1_placeholder": "Your username",
        "form_field_2_label": "Phone",
        "form_field_2_placeholder": "10-digit",
        "category": "App Install",
        "difficulty": "Easy",
        "reward_points": 500,
        "active": True,
    }
    r = requests.post(
        f"{API}/admin/campaigns", headers=auth_headers(admin_tok), json=payload, timeout=20
    )
    create_ok = r.status_code == 200 and r.json().get("id", "").startswith("cmp_")
    log(
        f"{title} :: admin can create campaign",
        create_ok,
        f"status={r.status_code}, body={r.text[:200]}",
    )
    if not create_ok:
        return
    campaign = r.json()
    cid = campaign["id"]

    # ----- APPROVE FLOW -----
    dev_a = f"camp_a_{uuid.uuid4().hex[:12]}"
    ua, tok_a = device_login(dev_a)
    fid_a = ua["user_id"]

    # Start (open link) and submit
    r = requests.post(f"{API}/tasks/campaign/{cid}", headers=auth_headers(tok_a), timeout=20)
    log(
        f"{title} :: user can start campaign (open link)",
        r.status_code == 200 and "link_url" in r.json(),
        f"status={r.status_code}, body={r.text[:200]}",
    )

    r = requests.post(
        f"{API}/tasks/campaign/{cid}/submit",
        headers=auth_headers(tok_a),
        json={"form_field_1_value": "alice99", "form_field_2_value": "9876543210"},
        timeout=20,
    )
    submit_ok = r.status_code == 200 and r.json().get("status") == "pending"
    log(
        f"{title} :: user submission creates pending completion",
        submit_ok,
        f"status={r.status_code}, body={r.text[:200]}",
    )
    completion_id_a = r.json().get("completion_id") if submit_ok else None

    # Find via admin list
    comps = requests.get(
        f"{API}/admin/campaign-completions", headers=auth_headers(admin_tok), timeout=20
    ).json()
    found = next((c for c in comps if c.get("id") == completion_id_a), None)
    log(
        f"{title} :: completion appears in /admin/campaign-completions as pending",
        bool(found and found.get("status") == "pending"),
        f"found={'yes' if found else 'no'}, status={found and found.get('status')}",
    )

    me_a0 = requests.get(f"{API}/auth/me", headers=auth_headers(tok_a), timeout=20).json()
    pts_before = me_a0.get("points", 0)

    # Approve
    r = requests.put(
        f"{API}/admin/campaign-completions/{completion_id_a}",
        headers=auth_headers(admin_tok),
        json={"status": "approved", "admin_note": "good"},
        timeout=20,
    )
    log(
        f"{title} :: approve completion returns 200",
        r.status_code == 200,
        f"status={r.status_code}, body={r.text[:200]}",
    )

    me_a1 = requests.get(f"{API}/auth/me", headers=auth_headers(tok_a), timeout=20).json()
    delta = me_a1.get("points", 0) - pts_before
    log(
        f"{title} :: approval credits user with campaign.reward_points",
        delta == campaign["reward_points"],
        f"delta={delta}, expected={campaign['reward_points']}",
    )

    # ----- REJECT FLOW -----
    dev_b = f"camp_b_{uuid.uuid4().hex[:12]}"
    ub, tok_b = device_login(dev_b)
    fid_b = ub["user_id"]

    r = requests.post(
        f"{API}/tasks/campaign/{cid}/submit",
        headers=auth_headers(tok_b),
        json={"form_field_1_value": "bob77", "form_field_2_value": "8888888888"},
        timeout=20,
    )
    submit_ok2 = r.status_code == 200
    log(
        f"{title} :: 2nd user submission ok",
        submit_ok2,
        f"status={r.status_code}, body={r.text[:200]}",
    )
    completion_id_b = r.json().get("completion_id")

    me_b0 = requests.get(f"{API}/auth/me", headers=auth_headers(tok_b), timeout=20).json()
    pts_b_before = me_b0.get("points", 0)

    # Reject
    r = requests.put(
        f"{API}/admin/campaign-completions/{completion_id_b}",
        headers=auth_headers(admin_tok),
        json={"status": "rejected", "admin_note": "low quality"},
        timeout=20,
    )
    log(
        f"{title} :: reject completion returns 200",
        r.status_code == 200,
        f"status={r.status_code}, body={r.text[:200]}",
    )

    # Verify status=rejected, no points credited
    comps2 = requests.get(
        f"{API}/admin/campaign-completions", headers=auth_headers(admin_tok), timeout=20
    ).json()
    found_b = next((c for c in comps2 if c.get("id") == completion_id_b), None)
    log(
        f"{title} :: rejected completion has status=rejected & note saved",
        bool(found_b and found_b.get("status") == "rejected" and found_b.get("admin_note") == "low quality"),
        f"status={found_b and found_b.get('status')}, note={found_b and found_b.get('admin_note')}",
    )

    me_b1 = requests.get(f"{API}/auth/me", headers=auth_headers(tok_b), timeout=20).json()
    log(
        f"{title} :: rejection does NOT credit points",
        me_b1.get("points", 0) == pts_b_before,
        f"before={pts_b_before}, after={me_b1.get('points')}",
    )

    # ----- RESET (delete) FLOW: after rejection, user can re-submit only after admin deletes -----
    # First confirm user CAN'T re-submit while a rejected completion exists?
    # Per code: submit_campaign deletes prior rejected before creating new (so user can retry directly).
    # The review test asks: DELETE /api/admin/campaign-completions/{id} -> 200, then user can submit again.
    r = requests.delete(
        f"{API}/admin/campaign-completions/{completion_id_b}",
        headers=auth_headers(admin_tok),
        timeout=20,
    )
    log(
        f"{title} :: DELETE rejected completion returns 200",
        r.status_code == 200 and r.json().get("ok") is True,
        f"status={r.status_code}, body={r.text[:200]}",
    )

    # User submits again
    r = requests.post(
        f"{API}/tasks/campaign/{cid}/submit",
        headers=auth_headers(tok_b),
        json={"form_field_1_value": "bob77_v2", "form_field_2_value": "8888888888"},
        timeout=20,
    )
    log(
        f"{title} :: user can re-submit campaign after admin reset",
        r.status_code == 200 and r.json().get("status") == "pending",
        f"status={r.status_code}, body={r.text[:200]}",
    )


# ---------- main ----------
def main():
    print("=" * 80)
    print("TaskMint backend tests")
    print("=" * 80)
    smoke_links_has_business_contact()
    smoke_auth_me()
    smoke_bad_admin_password()

    admin_user, admin_tok = build_admin()

    test_delete_user(admin_user, admin_tok)
    test_reject_withdrawal(admin_tok)
    test_watch_earn()
    test_campaign_review(admin_tok)

    print()
    print("=" * 80)
    passed = sum(1 for _, ok, _ in results if ok)
    failed = sum(1 for _, ok, _ in results if not ok)
    print(f"SUMMARY: {passed} passed / {failed} failed (total {len(results)})")
    print("=" * 80)
    for name, ok, detail in results:
        if not ok:
            print(f"FAIL :: {name}\n   -> {detail}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
