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
    except Exception as err:
        print(f"[WARN] anomaly_model.pkl not loaded: {err}")

    try:
        cry_model = joblib.load("cry_model.pkl")
    except Exception as err:
        print(f"[WARN] cry_model.pkl not loaded: {err}")

    try:
        forecast_model = joblib.load("forecast_model.pkl")
    except Exception as err:
        print(f"[WARN] forecast_model.pkl not loaded: {err}")


@app.post("/detect-anomaly")
def detect_anomaly():
    if anomaly_model is None:
        return jsonify({"error": "Model not trained yet"}), 503

    data = request.get_json(silent=True) or {}
    temperature = float(data.get("temperature", 0.0))
    humidity = float(data.get("humidity", 0.0))

    X = np.array([[temperature, humidity]], dtype=float)
    pred = int(anomaly_model.predict(X)[0])  # -1 anomaly, 1 normal
    score = float(anomaly_model.decision_function(X)[0])

    return jsonify({"isAnomaly": pred == -1, "score": score})


@app.get("/feature-importance")
def feature_importance():
    path = "feature_importance.json"
    if not os.path.exists(path):
        return jsonify({"error": "Model not trained yet"}), 503
    with open(path, "r", encoding="utf-8") as f:
        return jsonify(json.load(f))


@app.get("/forecast")
def forecast():
    path = "forecast_result.json"
    if not os.path.exists(path):
        return jsonify({"error": "Model not trained yet"}), 503
    with open(path, "r", encoding="utf-8") as f:
        return jsonify(json.load(f))


if __name__ == "__main__":
    load_models()
    app.run(host="0.0.0.0", port=5001, debug=False)
