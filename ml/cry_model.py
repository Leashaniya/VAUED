import json

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier

CSV_PATH = "../public/data/enriched_baby_monitoring_data.csv"
MODEL_PATH = "cry_model.pkl"
FEATURE_IMPORTANCE_PATH = "feature_importance.json"


def main():
    df = pd.read_csv(CSV_PATH)
    print("Columns:", list(df.columns))

    cry_duration_col = "cry_duration"
    timestamp_col = "start_timestamp"
    temperature_col = "temperature"
    wetness_col = "wet_status"

    df["cry"] = (pd.to_numeric(df[cry_duration_col], errors="coerce").fillna(0) > 0).astype(int)

    # Extract hour from timestamp.
    dt = pd.to_datetime(df[timestamp_col], errors="coerce")
    df["hour"] = dt.dt.hour.fillna(0).astype(int)

    # Map wet status text to numeric.
    wet_map = {"yes": 1, "wet": 1, "true": 1, "1": 1, "no": 0, "dry": 0, "false": 0, "0": 0}
    wet_series = (
        df[wetness_col]
        .astype(str)
        .str.strip()
        .str.lower()
        .map(wet_map)
        .fillna(0)
        .astype(float)
    )

    # Fallback humidity feature because enriched CSV currently has no humidity column.
    if "humidity" in df.columns:
        humidity_series = pd.to_numeric(df["humidity"], errors="coerce").fillna(0.0)
    else:
        humidity_series = 50 + (pd.to_numeric(df[temperature_col], errors="coerce").fillna(22.0) - 22.0) * 2.5

    X = pd.DataFrame(
        {
            "temperature": pd.to_numeric(df[temperature_col], errors="coerce").fillna(0.0),
            "humidity": pd.to_numeric(humidity_series, errors="coerce").fillna(0.0),
            "wetness": wet_series,
            "hour": df["hour"].astype(float),
        }
    )
    y = df["cry"].astype(int)

    model = RandomForestClassifier(random_state=42)
    model.fit(X, y)
    joblib.dump(model, MODEL_PATH)

    feature_importance = {
        "temperature": float(model.feature_importances_[0]),
        "humidity": float(model.feature_importances_[1]),
        "wetness": float(model.feature_importances_[2]),
        "hour": float(model.feature_importances_[3]),
    }

    with open(FEATURE_IMPORTANCE_PATH, "w", encoding="utf-8") as f:
        json.dump(feature_importance, f, indent=2)

    print("Feature importances:", feature_importance)
    print("Cry model trained and saved successfully")


if __name__ == "__main__":
    main()
