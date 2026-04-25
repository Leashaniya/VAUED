# HOW TO RUN:
# 1. cd ml
# 2. pip install -r requirements.txt
# 3. python anomaly_model.py     (train anomaly model - run once)
# 4. python cry_model.py         (train cry model - run once)
# 5. python forecast_model.py    (train forecast model - run once)
# 6. python ml_server.py         (start Flask API on port 5001)
# Keep this running while Node backend is running

import json
import os

import joblib
import numpy as np
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

anomaly_model = None
cry_model = None
forecast_model = None


def load_models():
    global anomaly_model, cry_model, forecast_model

    try:
        anomaly_model = joblib.load("anomaly_model.pkl")
        print("[OK] anomaly_model.pkl loaded")
    except Exception as err:
        print(f"[WARN] anomaly_model.pkl not loaded: {err}")

    try:
        cry_model = joblib.load("cry_model.pkl")
        print("[OK] cry_model.pkl loaded")
    except Exception as err:
        print(f"[WARN] cry_model.pkl not loaded: {err}")

    try:
        forecast_model = joblib.load("forecast_model.pkl")
        print("[OK] forecast_model.pkl loaded")
    except Exception as err:
        print(f"[WARN] forecast_model.pkl not loaded: {err}")


@app.route("/detect-anomaly", methods=["POST"])
def detect_anomaly():
    if anomaly_model is None:
        return jsonify({"error": "Model not trained yet"}), 503

    data = request.get_json(silent=True) or {}

    # Temperature only — the only true environmental room condition
    temperature = float(data.get("temperature", 0.0))

    X = np.array([[temperature]])
    pred = int(anomaly_model.predict(X)[0])
    score = float(anomaly_model.decision_function(X)[0])

    # Determine reason
    if pred == -1:
        if temperature >= 30:
            reason = "Room temperature is too high for baby"
        elif temperature <= 15:
            reason = "Room temperature is too low for baby"
        else:
            reason = "Temperature reading is outside normal range"
    else:
        reason = "Room temperature is within normal range"

    return jsonify({
        "isAnomaly": pred == -1,
        "score": round(score, 4),
        "temperature": temperature,
        "reason": reason
    })


@app.route("/feature-importance", methods=["GET"])
def feature_importance():
    path = "feature_importance.json"
    if not os.path.exists(path):
        return jsonify({"error": "Model not trained yet"}), 503
    with open(path, "r", encoding="utf-8") as f:
        return jsonify(json.load(f))


@app.route("/forecast", methods=["GET"])
def forecast():
    path = "forecast_result.json"
    if not os.path.exists(path):
        return jsonify({"error": "Model not trained yet"}), 503
    with open(path, "r", encoding="utf-8") as f:
        return jsonify(json.load(f))


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "models": {
            "anomaly": anomaly_model is not None,
            "cry": cry_model is not None,
            "forecast": forecast_model is not None
        }
    })


if __name__ == "__main__":
    load_models()
    print("[ML Server] Starting on port 5001...")
    app.run(host="0.0.0.0", port=5001, debug=False)