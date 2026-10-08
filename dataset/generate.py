#!/usr/bin/env python3
"""
Q-SHIELD AP: Synthetic Dataset Generator
Generates reproducible transaction datasets for AP Land Records, Agricultural Supply Chains, and Certificates.
Used to train and benchmark the Quantum Ledger Intelligence Engine (QLIE).
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

base_dir = Path(__file__).resolve().parent.parent
venv_py = base_dir / "quantum-service" / ".venv" / ("Scripts" if os.name == "nt" else "bin") / ("python.exe" if os.name == "nt" else "python")
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

import numpy as np
import pandas as pd

DISTRICTS = ["Vizianagaram", "Visakhapatnam", "Srikakulam", "Anakapalli", "Kakinada", "East Godavari"]
MANDALS = {
    "Vizianagaram": ["Vizianagaram Rural", "Gantyada", "Bhogapuram", "Denkada", "Cheepurupalli"],
    "Visakhapatnam": ["Bheemunipatnam", "Anandapuram", "Padmanabham", "Pendurthi"],
    "Srikakulam": ["Etcherla", "Ranastalam", "Laveru", "Ponduru"],
}
COMMODITIES = ["Banganapalle Mango", "Mesta Jute", "Cashew Raw Nut", "Teja Red Chilli"]
CERT_TYPES = ["B.Tech Degree Certificate", "Skill Competency Credential", "Land Title Deed (Pattadar)", "Organic Farming Certification"]


def generate_dataset(num_samples: int = 2000, anomaly_ratio: float = 0.15, seed: int = 42) -> pd.DataFrame:
    """
    Generates synthetic transactions with 8 core quantitative features:
      0: transaction_frequency (tx/month)
      1: transaction_velocity (velocity index 0-1)
      2: transaction_value (normalized monetary / parcel area scale)
      3: ownership_change_frequency (transfers in 12 months)
      4: historical_owner_count (cumulative owner count)
      5: time_since_previous_transaction (normalized elapsed days)
      6: geographical_distance (km transit / location leap)
      7: timestamp_deviation (minutes between local client time and ledger anchor)
    """
    rng = np.random.default_rng(seed)
    num_anomalies = int(num_samples * anomaly_ratio)
    num_normal = num_samples - num_anomalies

    # 1. Normal (Legitimate) Transactions
    # Characteristics: stable ownership, consistent frequency, low geographic jumps, small timestamp deviations
    tx_freq_norm = rng.normal(loc=1.8, scale=0.7, size=num_normal).clip(0.1, 5.0)
    tx_vel_norm = rng.normal(loc=0.15, scale=0.08, size=num_normal).clip(0.01, 0.40)
    tx_val_norm = rng.lognormal(mean=0.8, sigma=0.5, size=num_normal).clip(0.2, 5.0)
    own_freq_norm = rng.poisson(lam=0.4, size=num_normal).clip(0, 2)
    hist_owners_norm = rng.poisson(lam=2.1, size=num_normal).clip(1, 5)
    time_prev_norm = rng.exponential(scale=180.0, size=num_normal).clip(10, 1000)
    geo_dist_norm = rng.exponential(scale=15.0, size=num_normal).clip(0.5, 60.0)
    time_dev_norm = rng.normal(loc=1.2, scale=0.8, size=num_normal).clip(0.1, 4.0)

    # 2. Anomalous (Suspicious) Transactions
    # Characteristics: rapid flips, excessive velocity, huge geographic jumps, abnormal timestamp offsets, rapid ownership churning
    tx_freq_anom = rng.normal(loc=8.5, scale=2.5, size=num_anomalies).clip(4.0, 20.0)
    tx_vel_anom = rng.normal(loc=0.75, scale=0.15, size=num_anomalies).clip(0.50, 1.0)
    tx_val_anom = rng.lognormal(mean=2.2, sigma=0.8, size=num_anomalies).clip(1.5, 15.0)
    own_freq_anom = rng.poisson(lam=4.2, size=num_anomalies).clip(3, 8)
    hist_owners_norm_anom = rng.poisson(lam=6.8, size=num_anomalies).clip(4, 12)
    time_prev_anom = rng.exponential(scale=3.5, size=num_anomalies).clip(0.1, 14.0)
    geo_dist_anom = rng.normal(loc=280.0, scale=75.0, size=num_anomalies).clip(120.0, 800.0)
    time_dev_anom = rng.normal(loc=85.0, scale=30.0, size=num_anomalies).clip(20.0, 300.0)

    # Combine quantitative vectors
    X_norm = np.column_stack([
        tx_freq_norm, tx_vel_norm, tx_val_norm, own_freq_norm,
        hist_owners_norm, time_prev_norm, geo_dist_norm, time_dev_norm
    ])
    y_norm = np.zeros(num_normal, dtype=int)

    X_anom = np.column_stack([
        tx_freq_anom, tx_vel_anom, tx_val_anom, own_freq_anom,
        hist_owners_norm_anom, time_prev_anom, geo_dist_anom, time_dev_anom
    ])
    y_anom = np.ones(num_anomalies, dtype=int)

    X = np.vstack([X_norm, X_anom])
    y = np.hstack([y_norm, y_anom])

    # Shuffle
    idx = rng.permutation(len(X))
    X = X[idx]
    y = y[idx]

    feature_cols = [
        "transaction_frequency",
        "transaction_velocity",
        "transaction_value",
        "ownership_change_frequency",
        "historical_owner_count",
        "time_since_previous_transaction",
        "geographical_distance",
        "timestamp_deviation",
    ]

    df = pd.DataFrame(X, columns=feature_cols)
    df["label"] = y
    df["classification"] = np.where(y == 1, "SUSPICIOUS", "LEGITIMATE")

    # Generate synthetic metadata
    domains = rng.choice(["LAND_RECORD", "SUPPLY_CHAIN", "CERTIFICATE"], size=len(df), p=[0.50, 0.30, 0.20])
    df["domain"] = domains

    ids = []
    entities = []
    districts = []
    mandals = []

    for i, d in enumerate(domains):
        dist = rng.choice(DISTRICTS)
        districts.append(dist)
        m_list = MANDALS.get(dist, ["Mandal 1", "Mandal 2"])
        mandals.append(rng.choice(m_list))

        if d == "LAND_RECORD":
            ids.append(f"AP-{dist[:3].upper()}-LAND-{1000 + i}")
            entities.append(f"Survey No. {rng.integers(10, 450)}/{rng.integers(1, 5)}")
        elif d == "SUPPLY_CHAIN":
            ids.append(f"AP-AGRI-{rng.integers(100, 999)}-BATCH-{i}")
            entities.append(rng.choice(COMMODITIES))
        else:
            ids.append(f"CUTM-CERT-2026-{1000 + i}")
            entities.append(rng.choice(CERT_TYPES))

    df["transaction_id"] = ids
    df["entity_desc"] = entities
    df["district"] = districts
    df["mandal"] = mandals

    return df


def main():
    parser = argparse.ArgumentParser(description="Q-SHIELD AP Synthetic Dataset Generator")
    parser.add_argument("--samples", type=int, default=2000, help="Number of transaction samples")
    parser.add_argument("--anomaly-ratio", type=float, default=0.15, help="Ratio of anomalous/suspicious transactions")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility")
    parser.add_argument("--output", type=str, default=str(base_dir / "dataset" / "data.csv"), help="Output CSV path")
    args = parser.parse_args()

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    print(f"[+] Generating {args.samples} synthetic transactions for Andhra Pradesh (Anomaly ratio: {args.anomaly_ratio:.1%})...")
    df = generate_dataset(num_samples=args.samples, anomaly_ratio=args.anomaly_ratio, seed=args.seed)
    df.to_csv(out_path, index=False)

    print(f"[OK] Saved dataset to {out_path} ({len(df)} rows, {df['label'].sum()} suspicious)")
    print("    Features: transaction_frequency, velocity, value, ownership_change_freq, owner_count, time_prev, geo_dist, timestamp_dev")


if __name__ == "__main__":
    main()
