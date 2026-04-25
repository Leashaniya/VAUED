import joblib
import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest

CSV_PATH = "../public/data/enriched_baby_monitoring_data.csv"
MODEL_PATH = "anomaly_model.pkl"

def main():
    df = pd.read_csv(CSV_PATH)
    print("Columns:", list(df.columns))

    # Use temperature only
    # wet_status is diaper wetness — unrelated to room environment
    # Temperature is the only true environmental room condition
    X = pd.DataFrame({
        "temperature": pd.to_numeric(df["temperature"], errors="coerce").fillna(0.0)
    })
    X = X.ffill().bfill()

    print(f"Temperature stats:")
    print(f"  Min  : {X['temperature'].min()}°C")
    print(f"  Max  : {X['temperature'].max()}°C")
    print(f"  Mean : {X['temperature'].mean():.1f}°C")

    model = IsolationForest(contamination=0.1, random_state=42)
    model.fit(X)

    # Evaluation
    predictions = model.predict(X)
    scores = model.decision_function(X)

    total = len(predictions)
    anomalies = (predictions == -1).sum()
    normal = (predictions == 1).sum()
    anomaly_pct = (anomalies / total) * 100

    print("=" * 40)
    print("ANOMALY MODEL EVALUATION")
    print("=" * 40)
    print(f"Total records analysed     : {total}")
    print(f"Normal records             : {normal} ({100 - anomaly_pct:.1f}%)")
    print(f"Anomalies detected         : {anomalies} ({anomaly_pct:.1f}%)")
    print(f"Contamination setting      : 10%")
    print(f"Mean anomaly score         : {scores.mean():.4f}")
    print(f"Min score (most anomalous) : {scores.min():.4f}")
    print(f"Max score (most normal)    : {scores.max():.4f}")
    print("=" * 40)

    # Test with realistic baby room temperatures
    test_cases = [10, 15, 18, 20, 22, 25, 28, 30, 35, 38]
    print("\nSample temperature predictions:")
    print(f"{'Temp':>6} {'Result':>15} {'Score':>8}")
    print("-" * 35)
    for temp in test_cases:
        pred = model.predict([[temp]])[0]
        score = model.decision_function([[temp]])[0]
        result = "ANOMALY" if pred == -1 else "Normal"
        print(f"{temp:>5}°C {result:>15} {score:>8.4f}")
    print("=" * 40)

    joblib.dump(model, MODEL_PATH)
    print(f"Trained on {len(X)} rows")
    print("Anomaly model trained and saved successfully")

if __name__ == "__main__":
    main()
