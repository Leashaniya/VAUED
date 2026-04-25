import json
import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, r2_score, mean_squared_error

CSV_PATH = "../public/data/enriched_baby_monitoring_data.csv"
MODEL_PATH = "forecast_model.pkl"
RESULT_PATH = "forecast_result.json"

def main():
    df = pd.read_csv(CSV_PATH)
    print("Columns:", list(df.columns))

    # Create cry label
    df["cry"] = (pd.to_numeric(df["cry_duration"], errors="coerce").fillna(0) > 0).astype(int)
    df["wetness"] = (df["wet_status"].astype(str).str.strip().str.lower() == "yes").astype(int)
    df["date"] = pd.to_datetime(df["start_timestamp"], errors="coerce").dt.date

    # Group by day — get daily cry count, avg temperature, wet event count
    daily = df.groupby("date").agg(
        cry_count=("cry", "sum"),
        avg_temperature=("temperature", "mean"),
        wet_count=("wetness", "sum")
    ).reset_index().sort_values("date")

    # Features: previous day's avg_temperature and wet_count to predict next day's cry_count
    daily["prev_temp"] = daily["avg_temperature"].shift(1)
    daily["prev_wet"] = daily["wet_count"].shift(1)
    daily = daily.dropna()

    X = daily[["prev_temp", "prev_wet"]].values
    y = daily["cry_count"].values.astype(float)

    model = LinearRegression()
    model.fit(X, y)

    # Predict tomorrow using today's values
    today_temp = float(daily["avg_temperature"].iloc[-1])
    today_wet = float(daily["wet_count"].iloc[-1])
    next_pred = float(model.predict([[today_temp, today_wet]])[0])
    next_pred = max(0, round(next_pred))
    pred = next_pred

    # Trend based on last 7 days cry count direction
    last_7_df = daily.tail(7)
    last_7 = last_7_df["cry_count"].tolist()
    last_7_days_series = []
    for _, r in last_7_df.iterrows():
        d = pd.Timestamp(r["date"])
        last_7_days_series.append(
            {
                "date": d.strftime("%Y-%m-%d"),
                "cry_count": int(r["cry_count"]),
                "avg_temperature": round(float(r["avg_temperature"]), 1),
            }
        )

    if len(last_7) >= 2:
        slope = np.polyfit(range(len(last_7)), last_7, 1)[0]
        if slope > 0.5:
            trend = "increasing"
        elif slope < -0.5:
            trend = "decreasing"
        else:
            trend = "stable"
    else:
        trend = "stable"

    last_date = pd.Timestamp(daily["date"].iloc[-1])
    next_day_date = (last_date + pd.Timedelta(days=1)).strftime("%Y-%m-%d")

    # Next-day average °C: extrapolate from the same 7-day window (not in CSV — simple linear trend)
    last_7_temps = last_7_df["avg_temperature"].astype(float).tolist()
    if len(last_7_temps) >= 2:
        t_slope, t_intercept = np.polyfit(range(len(last_7_temps)), last_7_temps, 1)
        next_temp_pred = float(t_slope * len(last_7_temps) + t_intercept)
    else:
        next_temp_pred = float(last_7_temps[0]) if last_7_temps else today_temp
    next_temp_pred = round(next_temp_pred, 1)

    # Evaluation on 80/20 split
    split = int(len(y) * 0.8)
    X_train, X_test = X[:split], X[split:]
    y_train, y_test = y[:split], y[split:]

    eval_model = LinearRegression()
    eval_model.fit(X_train, y_train)
    y_pred = eval_model.predict(X_test)

    mae = mean_absolute_error(y_test, y_pred)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    r2 = r2_score(y_test, y_pred)

    print("=" * 40)
    print("FORECAST MODEL EVALUATION")
    print("=" * 40)
    print(f"MAE  (Mean Absolute Error) : {mae:.2f} cry episodes")
    print(f"RMSE (Root Mean Sq Error)  : {rmse:.2f} cry episodes")
    print(f"R²   (Explained Variance)  : {r2:.4f}")
    print(f"Trend detected             : {trend}")
    print(f"Next day prediction        : {int(round(max(0, pred)))} cry episodes")
    print(f"Based on today temp        : {today_temp:.1f}°C")
    print(f"Based on today wet events  : {int(today_wet)}")
    print("=" * 40)

    joblib.dump(model, MODEL_PATH)

    result = {
        "next_day_predicted_cries": int(next_pred),
        "next_day_predicted_avg_temperature": next_temp_pred,
        "next_day_date": next_day_date,
        "trend": trend,
        "last_7_days": [int(v) for v in last_7],
        "last_7_days_series": last_7_days_series,
        "based_on": {
            "today_avg_temperature": round(today_temp, 1),
            "today_wet_events": int(today_wet),
        },
    }

    with open(RESULT_PATH, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)

    print("Prediction:", result)
    print("Forecast model trained and saved successfully")

if __name__ == "__main__":
    main()