import json
import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

CSV_PATH = "../public/data/enriched_baby_monitoring_data.csv"
MODEL_PATH = "cry_model.pkl"
FEATURE_IMPORTANCE_PATH = "feature_importance.json"

def main():
    df = pd.read_csv(CSV_PATH)
    print("Columns:", list(df.columns))

    # Label
    df["cry"] = (pd.to_numeric(df["cry_duration"], errors="coerce").fillna(0) > 0).astype(int)

    # Features — NO cry_severity (data leakage)
    df["wetness"] = (df["wet_status"].astype(str).str.strip().str.lower() == "yes").astype(int)
    df["temp"] = pd.to_numeric(df["temperature"], errors="coerce").fillna(0.0)
    df["hour"] = df["hour_of_day"].astype(int)

    day_map = {"Mon": 0, "Tue": 1, "Wed": 2, "Thu": 3, "Fri": 4, "Sat": 5, "Sun": 6}
    df["day_encoded"] = df["day_of_week"].map(day_map).fillna(0).astype(int)

    time_map = {"Morning": 0, "Afternoon": 1, "Evening": 2, "Night": 3}
    df["time_encoded"] = df["time_of_day"].map(time_map).fillna(0).astype(int)

    temp_map = {"Low": 0, "Normal": 1, "High": 2}
    df["temp_cat_encoded"] = df["temp_category"].map(temp_map).fillna(1).astype(int)

    X = pd.DataFrame({
        "temperature":   df["temp"],
        "wetness":       df["wetness"].astype(float),
        "hour":          df["hour"].astype(float),
        "day_of_week":   df["day_encoded"].astype(float),
        "time_of_day":   df["time_encoded"].astype(float),
        "temp_category": df["temp_cat_encoded"].astype(float),
    })
    y = df["cry"].astype(int)

    print(f"Training on {len(X)} rows — cry=1: {y.sum()}, cry=0: {(y==0).sum()}")

    # Evaluation on 80/20 split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    eval_model = RandomForestClassifier(n_estimators=200, max_depth=10, random_state=42)
    eval_model.fit(X_train, y_train)
    y_pred = eval_model.predict(X_test)

    accuracy = accuracy_score(y_test, y_pred)

    print("=" * 40)
    print("CRY MODEL EVALUATION")
    print("=" * 40)
    print(f"Accuracy       : {accuracy * 100:.2f}%")
    print(f"Test samples   : {len(y_test)}")
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred, target_names=["No Cry", "Cry"]))
    print("Confusion Matrix:")
    print(confusion_matrix(y_test, y_pred))
    print("=" * 40)
    print("NOTE: Low accuracy reflects natural unpredictability")
    print("of infant crying. Key value is feature importance.")
    print("=" * 40)

    # Retrain on full data before saving
    model = RandomForestClassifier(n_estimators=200, max_depth=10, random_state=42)
    model.fit(X, y)
    joblib.dump(model, MODEL_PATH)

    feature_importance = {
        "temperature":   round(float(model.feature_importances_[0]), 4),
        "wetness":       round(float(model.feature_importances_[1]), 4),
        "hour":          round(float(model.feature_importances_[2]), 4),
        "day_of_week":   round(float(model.feature_importances_[3]), 4),
        "time_of_day":   round(float(model.feature_importances_[4]), 4),
        "temp_category": round(float(model.feature_importances_[5]), 4),
    }

    with open(FEATURE_IMPORTANCE_PATH, "w", encoding="utf-8") as f:
        json.dump(feature_importance, f, indent=2)

    print("Feature importances:", feature_importance)
    print("Cry model trained and saved successfully")

if __name__ == "__main__":
    main()