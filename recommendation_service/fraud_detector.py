import os
import pickle
import json
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score
import xgboost as xgb

LOCATION_MAP = {
    "usa": 1,
    "us": 1,
    "united states": 1,
    "india": 2,
    "in": 2,
    "nigeria": 3,
    "ng": 3,
    "romania": 4,
    "ro": 4,
    "unknown": 5,
}

DEVICE_MAP = {
    "desktop": 1,
    "windows": 1,
    "mac": 1,
    "linux": 1,
    "mobile": 2,
    "ios": 2,
    "android": 2,
    "bot": 3,
    "script": 3,
    "curl": 3,
    "wget": 3,
    "unknown": 4,
}

MODEL_PATH = os.path.join(os.path.dirname(__file__), "fraud_model.pkl")
METRICS_PATH = os.path.join(os.path.dirname(__file__), "fraud_metrics.json")

def parse_location(loc_str: str) -> int:
    loc_lower = str(loc_str).lower().strip()
    for key, code in LOCATION_MAP.items():
        if key in loc_lower:
            return code
    return 5

def parse_device(dev_str: str) -> int:
    dev_lower = str(dev_str).lower().strip()
    for key, code in DEVICE_MAP.items():
        if key in dev_lower:
            return code
    return 4

def train_fraud_model(n_samples=2500):
    """Generates synthetic dataset and trains XGBoost Classifier."""
    print("Training XGBoost Fraud Detection model on synthetic data...")
    rng = np.random.default_rng(42)

    # 1. Generate synthetic features
    order_amounts = rng.uniform(10.0, 25000.0, n_samples)
    frequencies = rng.integers(1, 25, n_samples)
    location_codes = rng.choice([1, 2, 3, 4, 5], n_samples, p=[0.4, 0.3, 0.1, 0.1, 0.1])
    device_codes = rng.choice([1, 2, 3, 4], n_samples, p=[0.4, 0.45, 0.1, 0.05])

    # 2. Labeling rules (non-linear interactions)
    labels = []
    for i in range(n_samples):
        amount = order_amounts[i]
        freq = frequencies[i]
        loc = location_codes[i]
        dev = device_codes[i]

        p = 0.03 # base baseline fraud rate

        # Bot device check
        if dev == 3:
            p += 0.45
        # High frequency check
        if freq > 5:
            p += 0.10
        if freq > 12:
            p += 0.25
        # High amount check
        if amount > 8000:
            p += 0.12
        if amount > 18000:
            p += 0.25
        # Location risk
        if loc == 3: # Nigeria
            p += 0.28
        elif loc == 4: # Romania
            p += 0.18

        # Compound rules
        if dev == 3 and amount > 5000:
            p += 0.20
        if dev == 3 and freq > 8:
            p += 0.15
        if loc == 5 and dev == 4: # unknown location + unknown device
            p += 0.15
        if amount > 15000 and freq > 10:
            p += 0.25

        p = min(0.98, max(0.01, p))
        is_fraud = int(rng.random() < p)
        labels.append(is_fraud)

    # 3. Create DataFrame
    df = pd.DataFrame({
        "order_amount": order_amounts,
        "frequency": frequencies,
        "location_code": location_codes,
        "device_code": device_codes,
        "is_fraud": labels
    })

    X = df[["order_amount", "frequency", "location_code", "device_code"]]
    y = df["is_fraud"]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # 4. Fit XGBoost Model
    model = xgb.XGBClassifier(
        n_estimators=60,
        max_depth=4,
        learning_rate=0.1,
        eval_metric="logloss",
        random_state=42
    )
    model.fit(X_train, y_train)

    # 5. Evaluate Model
    preds = model.predict(X_test)
    accuracy = float(accuracy_score(y_test, preds))
    f1 = float(f1_score(y_test, preds))
    precision = float(precision_score(y_test, preds))
    recall = float(recall_score(y_test, preds))

    # Feature Importance
    importances = model.feature_importances_
    feature_names = ["order_amount", "frequency", "location_code", "device_code"]
    feature_importances = {name: float(imp) for name, imp in zip(feature_names, importances)}

    # Save metrics
    metrics = {
        "model_type": "XGBoost Classifier",
        "n_samples": n_samples,
        "test_size": len(y_test),
        "accuracy": round(accuracy, 4),
        "f1_score": round(f1, 4),
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "feature_importances": feature_importances
    }

    # Save to files
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(model, f)
    with open(METRICS_PATH, "w") as f:
        json.dump(metrics, f, indent=2)

    print(f"Model trained successfully. Accuracy: {accuracy:.4f}, F1: {f1:.4f}")
    return model, metrics

def load_fraud_model():
    """Loads the model and metrics, training if not exist."""
    if not os.path.exists(MODEL_PATH) or not os.path.exists(METRICS_PATH):
        return train_fraud_model()
    try:
        with open(MODEL_PATH, "rb") as f:
            model = pickle.load(f)
        with open(METRICS_PATH, "r") as f:
            metrics = json.load(f)
        return model, metrics
    except Exception as e:
        print(f"Error loading model: {e}. Retraining...")
        return train_fraud_model()

def check_order_fraud(order_amount: float, location: str, frequency: int, device: str):
    """Runs prediction on transaction features and returns detailed probability."""
    model, metrics = load_fraud_model()

    loc_code = parse_location(location)
    dev_code = parse_device(device)

    # Format features for prediction
    # Feature columns must match order: order_amount, frequency, location_code, device_code
    features = np.array([[order_amount, frequency, loc_code, dev_code]])

    # Inference
    prob = float(model.predict_proba(features)[0][1])

    # Determine risk level
    if prob >= 0.70:
        risk_level = "High"
    elif prob >= 0.30:
        risk_level = "Medium"
    else:
        risk_level = "Low"

    # Explain reasons dynamically
    reasons = []
    if prob >= 0.30:
        if order_amount > 12000:
            reasons.append("Elevated order amount exceeds standard thresholds")
        if frequency > 8:
            reasons.append("High transaction frequency observed within 24 hours")
        if dev_code == 3:
            reasons.append("Transaction initiated from suspicious scripting agent/bot")
        if loc_code in [3, 4]:
            reasons.append("Transaction originates from a high-risk geo-location zone")
        if loc_code == 5 and dev_code == 4:
            reasons.append("Suspicious profile: unclassified location and device parameters")
        
        # Fallback if no specific rule matched but probability is still high due to interaction
        if not reasons:
            reasons.append("Complex multi-feature interaction flagged by XGBoost ensemble")
    else:
        reasons.append("No suspicious behaviors detected; metrics fall within normal operating bounds")

    # Dynamic explanation values for a SHAP-like breakdown
    # Make sure they add up to the probability roughly for UI visuals
    base_val = 0.03
    explain_factors = {
        "baseline": base_val,
        "order_amount": max(0.0, (0.2 if order_amount > 8000 else (0.45 if order_amount > 18000 else 0.05))),
        "frequency": max(0.0, (0.35 if frequency > 12 else (0.15 if frequency > 5 else 0.02))),
        "location": max(0.0, (0.3 if loc_code == 3 else (0.2 if loc_code == 4 else 0.05))),
        "device": max(0.0, (0.45 if dev_code == 3 else 0.05))
    }

    # Normalize SHAP values to sum up to probability
    sum_factors = sum(explain_factors.values())
    if sum_factors > 0:
        factor_ratio = prob / sum_factors
        for key in explain_factors:
            explain_factors[key] = round(explain_factors[key] * factor_ratio, 3)

    return {
        "success": True,
        "fraud_probability": round(prob, 4),
        "fraud_probability_pct": f"{int(round(prob * 100))}%",
        "risk_level": risk_level,
        "reasons": reasons,
        "explain_factors": explain_factors,
        "metrics": metrics
    }
