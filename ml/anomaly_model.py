import joblib
import pandas as pd
from sklearn.ensemble import IsolationForest

CSV_PATH = "../public/data/enriched_baby_monitoring_data.csv"
MODEL_PATH = "anomaly_model.pkl"


def main():
    df = pd.read_csv(CSV_PATH)
    print("Columns:", list(df.columns))

    temp_col = "temperature"
    humidity_col = "humidity" if "humidity" in df.columns else None
    if humidity_col is None:
        # Fallback because current enriched CSV has no humidity column.
        # Creates a stable proxy so anomaly endpoint remains available.
        df["humidity_proxy"] = 50 + (df[temp_col].astype(float) - 22.0) * 2.5
        humidity_col = "humidity_proxy"

    X = df[[temp_col, humidity_col]].astype(float).fillna(method="ffill").fillna(method="bfill")

    model = IsolationForest(contamination=0.1, random_state=42)
    model.fit(X)
    joblib.dump(model, MODEL_PATH)

    print("Anomaly model trained and saved successfully")


if __name__ == "__main__":
    main()
