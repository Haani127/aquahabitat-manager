"""
Flask API backend for Fish Pond Alert System
- User authentication (signup, login, JWT)
- SQLite database for users
- Serves frontend pages (login, signup, dashboard)
- ML model prediction endpoint

Usage:
    pip install flask flask-cors
    python app.py
"""

from flask import Flask, request, jsonify, send_from_directory, redirect
from flask_cors import CORS
import pickle
import numpy as np
import os
import sqlite3
import hashlib
import hmac
import json
import time
import base64

app = Flask(__name__, static_folder=".", static_url_path="/static")
CORS(app)

# ── Secret Key for JWT ───────────────────────────────────
SECRET_KEY = os.environ.get("SECRET_KEY", "pond-alert-secret-key-2026-capstone")
DB_PATH = os.path.join(os.path.dirname(__file__), "users.db")


# ══════════════════════════════════════════════════════════
# DATABASE
# ══════════════════════════════════════════════════════════

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()
    print("✅ Database initialized")


init_db()


# ══════════════════════════════════════════════════════════
# PASSWORD HASHING (hashlib — zero extra deps)
# ══════════════════════════════════════════════════════════

def hash_password(password):
    salt = os.urandom(32)
    key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100000)
    return (salt + key).hex()


def verify_password(password, stored_hash):
    stored_bytes = bytes.fromhex(stored_hash)
    salt = stored_bytes[:32]
    stored_key = stored_bytes[32:]
    key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100000)
    return hmac.compare_digest(key, stored_key)


# ══════════════════════════════════════════════════════════
# SIMPLE JWT (no pyjwt dependency)
# ══════════════════════════════════════════════════════════

def base64url_encode(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def base64url_decode(s):
    s += "=" * (4 - len(s) % 4)
    return base64.urlsafe_b64decode(s)


def create_token(payload, expires_hours=24):
    header = {"alg": "HS256", "typ": "JWT"}
    payload["exp"] = int(time.time()) + expires_hours * 3600
    payload["iat"] = int(time.time())

    h = base64url_encode(json.dumps(header).encode())
    p = base64url_encode(json.dumps(payload).encode())
    sig_input = f"{h}.{p}".encode()
    sig = base64url_encode(
        hmac.new(SECRET_KEY.encode(), sig_input, hashlib.sha256).digest()
    )
    return f"{h}.{p}.{sig}"


def verify_token(token):
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        h, p, sig = parts
        sig_input = f"{h}.{p}".encode()
        expected_sig = base64url_encode(
            hmac.new(SECRET_KEY.encode(), sig_input, hashlib.sha256).digest()
        )
        if not hmac.compare_digest(sig, expected_sig):
            return None
        payload = json.loads(base64url_decode(p))
        if payload.get("exp", 0) < time.time():
            return None
        return payload
    except Exception:
        return None


# ══════════════════════════════════════════════════════════
# PAGE ROUTES
# ══════════════════════════════════════════════════════════

@app.route("/")
def root():
    return redirect("/login")


@app.route("/login")
def serve_login():
    return send_from_directory(".", "login.html")


@app.route("/signup")
def serve_signup():
    return send_from_directory(".", "signup.html")


@app.route("/dashboard")
def serve_dashboard():
    return send_from_directory(".", "index.html")


@app.route("/<path:filename>")
def serve_file(filename):
    if os.path.isfile(os.path.join(os.path.dirname(__file__), filename)):
        return send_from_directory(".", filename)
    return "Not found", 404


# ══════════════════════════════════════════════════════════
# AUTH API
# ══════════════════════════════════════════════════════════

@app.route("/api/auth/signup", methods=["POST"])
def signup():
    data = request.json or {}
    first_name = data.get("firstName", "").strip()
    last_name = data.get("lastName", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not all([first_name, last_name, email, password]):
        return jsonify({"error": "All fields are required"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400
    if "@" not in email:
        return jsonify({"error": "Invalid email address"}), 400

    conn = get_db()
    existing = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    if existing:
        conn.close()
        return jsonify({"error": "An account with this email already exists"}), 409

    pw_hash = hash_password(password)
    conn.execute(
        "INSERT INTO users (first_name, last_name, email, password_hash) VALUES (?, ?, ?, ?)",
        (first_name, last_name, email, pw_hash),
    )
    conn.commit()
    conn.close()
    return jsonify({"message": "Account created successfully"}), 201


@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.json or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    conn = get_db()
    user = conn.execute(
        "SELECT id, first_name, last_name, email, password_hash FROM users WHERE email = ?",
        (email,),
    ).fetchone()
    conn.close()

    if not user or not verify_password(password, user["password_hash"]):
        return jsonify({"error": "Invalid email or password"}), 401

    token = create_token({"user_id": user["id"], "email": user["email"]})

    return jsonify({
        "token": token,
        "user": {
            "id": user["id"],
            "firstName": user["first_name"],
            "lastName": user["last_name"],
            "email": user["email"],
        },
    })


@app.route("/api/auth/me", methods=["GET"])
def get_current_user():
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return jsonify({"error": "Unauthorized"}), 401
    payload = verify_token(auth_header[7:])
    if not payload:
        return jsonify({"error": "Token expired or invalid"}), 401
    conn = get_db()
    user = conn.execute(
        "SELECT id, first_name, last_name, email FROM users WHERE id = ?",
        (payload["user_id"],),
    ).fetchone()
    conn.close()
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify({
        "id": user["id"],
        "firstName": user["first_name"],
        "lastName": user["last_name"],
        "email": user["email"],
    })

# ══════════════════════════════════════════════════════════
# ML MODEL LOADING
# ══════════════════════════════════════════════════════════

MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "ML_script")

def load_pickle(filename):
    path = os.path.join(MODEL_DIR, filename)
    if not os.path.exists(path):
        print(f"⚠️  {filename} not found at {path}")
        return None
    with open(path, "rb") as f:
        return pickle.load(f)

rf_model     = load_pickle("rf_model.pkl")
scaler_ml    = load_pickle("scaler_ml.pkl")
fish_encoder = load_pickle("fish_encoder.pkl")

models_loaded = all([rf_model, scaler_ml, fish_encoder])

if models_loaded:
    print("✅ All models loaded successfully")
    print(f"   Fish species: {list(fish_encoder.classes_)}")
else:
    print("⚠️  Some models missing — run the notebook first to generate .pkl files")

# ── Fish-specific safe ranges (fallback) ─────────────────
FISH_RULES = {
    "tilapia":   {"pH": (6.5, 8.5), "temp": (18, 32), "turb": 5},
    "pangas":    {"pH": (6.8, 8.5), "temp": (20, 32), "turb": 5},
    "rui":       {"pH": (6.5, 8.0), "temp": (18, 30), "turb": 5},
    "katla":     {"pH": (6.5, 8.0), "temp": (20, 32), "turb": 5},
    "koi":       {"pH": (6.5, 8.5), "temp": (18, 28), "turb": 6},
    "magur":     {"pH": (6.5, 8.0), "temp": (22, 32), "turb": 5},
    "sing":      {"pH": (6.0, 8.0), "temp": (24, 32), "turb": 6},
    "karpio":    {"pH": (6.5, 8.5), "temp": (18, 28), "turb": 6},
    "silverCup": {"pH": (6.5, 8.0), "temp": (18, 28), "turb": 5},
    "prawn":     {"pH": (6.5, 8.5), "temp": (18, 30), "turb": 5},
    "shrimp":    {"pH": (6.5, 8.5), "temp": (18, 30), "turb": 5},
}
DEFAULT_RULE = {"pH": (6.5, 8.5), "temp": (18, 30), "turb": 5}


def rule_based_predict(fish, pH, temp, turb):
    """Fallback prediction using the same rules as the notebook."""
    rule = FISH_RULES.get(fish, DEFAULT_RULE)
    ph_ok   = rule["pH"][0] <= pH <= rule["pH"][1]
    temp_ok = rule["temp"][0] <= temp <= rule["temp"][1]
    turb_ok = turb <= rule["turb"]
    safe = ph_ok and temp_ok and turb_ok

    reasons = []
    if not ph_ok:
        reasons.append("Low pH" if pH < rule["pH"][0] else "High pH")
    if not temp_ok:
        reasons.append("Low Temperature" if temp < rule["temp"][0] else "High Temperature")
    if not turb_ok:
        reasons.append("High Turbidity")

    prob = 0.0
    if not safe:
        score = 0
        if not ph_ok:
            dist = rule["pH"][0] - pH if pH < rule["pH"][0] else pH - rule["pH"][1]
            score += min(dist / 2, 1) * 0.4
        if not temp_ok:
            dist = rule["temp"][0] - temp if temp < rule["temp"][0] else temp - rule["temp"][1]
            score += min(dist / 10, 1) * 0.35
        if not turb_ok:
            dist = turb - rule["turb"]
            score += min(dist / 10, 1) * 0.25
        prob = min(0.55 + score * 0.45, 1.0)

    return {
        "alert": not safe,
        "probability": round(prob, 4),
        "reasons": reasons,
        "status": {"phOk": ph_ok, "tempOk": temp_ok, "turbOk": turb_ok},
    }


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "models_loaded": models_loaded,
        "species": list(fish_encoder.classes_) if fish_encoder else [],
    })


@app.route("/predict", methods=["POST"])
def predict():
    data = request.json
    fish = data.get("fish", "tilapia")
    pH   = float(data.get("pH", 7.0))
    temp = float(data.get("temperature", 25.0))
    turb = float(data.get("turbidity", 3.0))

    # Try RF model first
    if models_loaded:
        try:
            fish_id = fish_encoder.transform([fish])[0]
            sample = scaler_ml.transform([[pH, temp, turb, fish_id]])
            pred_proba = rf_model.predict_proba(sample)[0][1]
            is_alert = pred_proba > 0.5

            # Still compute rule-based reasons for explanation
            rule = FISH_RULES.get(fish, DEFAULT_RULE)
            ph_ok   = rule["pH"][0] <= pH <= rule["pH"][1]
            temp_ok = rule["temp"][0] <= temp <= rule["temp"][1]
            turb_ok = turb <= rule["turb"]

            reasons = []
            if not ph_ok:
                reasons.append("Low pH" if pH < rule["pH"][0] else "High pH")
            if not temp_ok:
                reasons.append("Low Temperature" if temp < rule["temp"][0] else "High Temperature")
            if not turb_ok:
                reasons.append("High Turbidity")

            return jsonify({
                "alert": bool(is_alert),
                "probability": round(float(pred_proba), 4),
                "reasons": reasons,
                "status": {"phOk": ph_ok, "tempOk": temp_ok, "turbOk": turb_ok},
                "model": "RandomForest",
            })
        except Exception as e:
            print(f"⚠️  RF prediction failed: {e}, using rule-based fallback")

    # Fallback to rule-based
    result = rule_based_predict(fish, pH, temp, turb)
    result["model"] = "RuleBased"
    return jsonify(result)


if __name__ == "__main__":
    print("\n🐟 Fish Pond Alert System — Full Stack")
    print("   http://127.0.0.1:5000/login     (Login)")
    print("   http://127.0.0.1:5000/signup    (Sign Up)")
    print("   http://127.0.0.1:5000/dashboard (Dashboard)")
    print("   http://127.0.0.1:5000/health    (API Health)")
    print("   http://127.0.0.1:5000/predict   (POST Predict)\n")
    app.run(debug=True, port=5000)
