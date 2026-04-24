import json

import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression

CSV_PATH = "../public/data/enriched_baby_monitoring_data.csv"
MODEL_PATH = "forecast_model.pkl"
RESULT_PATH = "forecast_result.json"


def main():
    df = pd.read_csv(CSV_PATH)
    print("Columns:", list(df.columns))

    df["cry"] = (pd.to_numeric(df["cry_duration"], errors="coerce").fillna(0) > 0).astype(int)
    df["day"] = pd.to_datetime(df["start_timestamp"], errors="coerce").dt.date
    daily = df.dropna(subset=["day"]).groupby("day", as_index=False)["cry"].sum()
    daily = daily.sort_values("day")

    y = daily["cry"].to_numpy(dtype=float)
    X = np.arange(len(y), dtype=float).reshape(-1, 1)

    model = LinearRegression()
    model.fit(X, y)
    joblib.dump(model, MODEL_PATH)

    next_idx = np.array([[len(y)]], dtype=float)
    pred = float(model.predict(next_idx)[0])
    slope = float(model.coef_[0])

    if slope > 0.5:
        trend = "increasing"
    elif slope < -0.5:
        trend = "decreasing"
    else:
        trend = "stable"

    result = {
        "next_day_predicted_cries": int(round(max(0, pred))),
        "trend": trend,
        "last_7_days": [int(v) for v in daily["cry"].tail(7).tolist()],
    }

    with open(RESULT_PATH, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)

    print("Prediction:", result)
    print("Forecast model trained and saved successfully")


if __name__ == "__main__":
    main()
