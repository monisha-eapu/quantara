#!/usr/bin/env python3
"""
Q-SHIELD AP: Comprehensive Enterprise Andhra Pradesh Dataset Generator
Generates a multi-domain synthetic dataset across 10,000 transactions for:
  1. AP Land Revenue Records (Bhudhaar / Webland / Pattadar Passbook)
  2. Agricultural & Pharma Cold-Chain Provenance (Vizianagaram Jute, Guntur Mirchi, Chittoor Mangoes)
  3. Institutional Credentials (Centurion University of Technology and Management, Vizianagaram)

Used to train, validate, and benchmark the Quantum Ledger Intelligence Engine (QLIE).
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

base_dir = Path(__file__).resolve().parent.parent

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

import numpy as np
import pandas as pd

# Comprehensive Andhra Pradesh Geographic Mapping
DISTRICT_MANDAL_MAP = {
    "Vizianagaram": ["Bhogapuram", "Denkada", "Vizianagaram Rural", "Cheepurupalli", "Gantyada", "Kothavalasa", "Gajapathinagaram"],
    "Visakhapatnam": ["Bheemunipatnam", "Anandapuram", "Padmanabham", "Pendurthi", "Gajuwaka", "Maharanipeta"],
    "Srikakulam": ["Etcherla", "Ranastalam", "Laveru", "Ponduru", "Amadalavalasa", "Tekkali"],
    "Guntur": ["Mangalagiri", "Tenali", "Tadepalli", "Guntur Urban", "Amaravati", "Ponnur"],
    "Krishna": ["Machilipatnam", "Vijayawada Rural", "Gannavaram", "Gudivada", "Nuzvid"],
    "Chittoor": ["Tirupati Rural", "Chittoor Urban", "Chandragiri", "Palamaner", "Nagari"],
    "East Godavari": ["Rajahmundry Rural", "Kakinada Urban", "Samalkota", "Anaparthy", "Pithapuram"],
    "Anakapalli": ["Anakapalli Urban", "Kasimkota", "Parawada", "Chodavaram", "Atchutapuram"],
    "Kurnool": ["Kurnool Urban", "Nandyal", "Adoni", "Dhone", "Yemmiganur"],
    "Anantapur": ["Anantapur Urban", "Hindupur", "Dharmavaram", "Guntakal", "Kadiri"]
}

DISTRICTS = list(DISTRICT_MANDAL_MAP.keys())

COMMODITIES = [
    "Vizianagaram Mesta Jute Bales",
    "Guntur Teja Red Chilli (Export Grade)",
    "Chittoor Totapuri Mango Pulp Batch",
    "Banganapalle Geographical Indication Mango",
    "Araku Valley Organic Coffee Beans",
    "Srikakulam Raw Cashew Nut Grade-A",
    "Cold-Chain Oncology Biologics (Serum Institute Transit)",
    "Polavaram Hybrid Paddy Seed Lots"
]

LAND_PROPERTY_TYPES = [
    "Agricultural Wet Land (Pattadar RoR-1B)",
    "Agricultural Dry Land (D-Patta)",
    "Commercial Development Parcel (CRDA Zone)",
    "Industrial Plot (APIIC Vizag Corridor)",
    "Bhogapuram Airport Buffer Zone (Restricted Mutation)",
    "Residential House Site (Gram Kantham)"
]

CERT_TYPES = [
    "B.Tech in Computer Science & Quantum Computing (CUTM)",
    "B.Tech in Agricultural Engineering (CUTM)",
    "M.Tech in Cyber Security & Post-Quantum Cryptography (CUTM)",
    "Diploma in High-Tech Sericulture & Precision Farming",
    "AP State Skill Development Corporation (APSSDC) Certified Ledger Auditor",
    "NIST FIPS 204 Lattice Cryptography Competency Certificate"
]

THREAT_PERSONAS = [
    "RAPID_CHURN_INSIDER",         # Stolen or coerced official registrar credentials; rapid title flipping across distant registrars
    "UNLAWFUL_ACREAGE_INFLATION",   # Area secretly expanded in DB (e.g. 2.4 acres to 24.0 acres)
    "COLD_CHAIN_SPOOFING",          # Sensor timestamps falsified, impossible transit leaps (>300 km/hr)
    "CREDENTIAL_DEGREE_INJECTION",  # Non-matriculated student degree injected with fake CA anchor
    "SECTION_22A_ALIENATION"        # Attempted mutation of protected government assigned land
]


def generate_dataset(num_samples: int = 10000, anomaly_ratio: float = 0.16, seed: int = 42) -> pd.DataFrame:
    """
    Generates realistic, scientifically calibrated transactions across Andhra Pradesh.
    Features:
      0: transaction_frequency (mutations/interactions per month)
      1: transaction_velocity (velocity index [0.0 - 1.0])
      2: transaction_value (appraisal value in Lakhs INR)
      3: ownership_change_frequency (handoffs in past 12 months)
      4: historical_owner_count (depth of chain of title)
      5: time_since_previous_transaction (elapsed days since last anchor)
      6: geographical_distance (km between recording registrar/cold-chain nodes)
      7: timestamp_deviation (offset in minutes between client packet and ledger block)
      8: parcel_acreage_or_units (area in acres or consignment units)
      9: encumbrance_risk_score (computed title/transit liability index [0.0 - 1.0])
    """
    rng = np.random.default_rng(seed)
    num_anomalies = int(num_samples * anomaly_ratio)
    num_normal = num_samples - num_anomalies

    # --------------------------------------------------------------------------
    # 1. Normal (Legitimate) Transactions (84% of population)
    # --------------------------------------------------------------------------
    tx_freq_norm = rng.normal(loc=1.6, scale=0.6, size=num_normal).clip(0.1, 4.2)
    tx_vel_norm = rng.beta(a=2.0, b=8.0, size=num_normal).clip(0.01, 0.38)
    tx_val_norm = rng.lognormal(mean=2.8, sigma=0.7, size=num_normal).clip(1.5, 65.0) # 1.5 to 65 Lakhs INR
    own_freq_norm = rng.poisson(lam=0.35, size=num_normal).clip(0, 2)
    hist_owners_norm = rng.poisson(lam=2.0, size=num_normal).clip(1, 5)
    time_prev_norm = rng.exponential(scale=240.0, size=num_normal).clip(15.0, 1825.0) # Up to 5 years
    geo_dist_norm = rng.exponential(scale=12.0, size=num_normal).clip(0.2, 55.0)
    time_dev_norm = rng.normal(loc=1.1, scale=0.7, size=num_normal).clip(0.05, 3.8)
    acreage_norm = rng.gamma(shape=2.5, scale=1.5, size=num_normal).clip(0.5, 18.0)
    encumbrance_norm = rng.beta(a=1.5, b=9.0, size=num_normal).clip(0.0, 0.35)

    # --------------------------------------------------------------------------
    # 2. Anomalous (Fraudulent / Suspicious) Transactions (16% of population)
    # --------------------------------------------------------------------------
    tx_freq_anom = rng.normal(loc=9.2, scale=2.8, size=num_anomalies).clip(4.5, 24.0)
    tx_vel_anom = rng.beta(a=7.0, b=2.5, size=num_anomalies).clip(0.52, 1.0)
    tx_val_anom = rng.lognormal(mean=4.5, sigma=1.0, size=num_anomalies).clip(15.0, 350.0)
    own_freq_anom = rng.poisson(lam=4.8, size=num_anomalies).clip(3, 10)
    hist_owners_anom = rng.poisson(lam=7.5, size=num_anomalies).clip(4, 15)
    time_prev_anom = rng.exponential(scale=3.2, size=num_anomalies).clip(0.05, 12.0)
    geo_dist_anom = rng.normal(loc=310.0, scale=80.0, size=num_anomalies).clip(110.0, 850.0)
    time_dev_anom = rng.normal(loc=115.0, scale=45.0, size=num_anomalies).clip(25.0, 420.0)
    acreage_anom = rng.gamma(shape=6.0, scale=4.0, size=num_anomalies).clip(2.0, 95.0)
    encumbrance_anom = rng.beta(a=6.0, b=2.0, size=num_anomalies).clip(0.55, 1.0)

    # --------------------------------------------------------------------------
    # Combine quantitative matrices
    # --------------------------------------------------------------------------
    X_norm = np.column_stack([
        tx_freq_norm, tx_vel_norm, tx_val_norm, own_freq_norm,
        hist_owners_norm, time_prev_norm, geo_dist_norm, time_dev_norm,
        acreage_norm, encumbrance_norm
    ])
    y_norm = np.zeros(num_normal, dtype=int)

    X_anom = np.column_stack([
        tx_freq_anom, tx_vel_anom, tx_val_anom, own_freq_anom,
        hist_owners_anom, time_prev_anom, geo_dist_anom, time_dev_anom,
        acreage_anom, encumbrance_anom
    ])
    y_anom = np.ones(num_anomalies, dtype=int)

    X = np.vstack([X_norm, X_anom])
    y = np.hstack([y_norm, y_anom])

    # Deterministic shuffle
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
        "parcel_acreage_or_units",
        "encumbrance_risk_score"
    ]

    df = pd.DataFrame(X, columns=feature_cols)
    df["label"] = y
    df["classification"] = np.where(y == 1, "SUSPICIOUS", "LEGITIMATE")

    # Domain partition: 55% Land, 25% Supply Chain, 20% Certificates
    domains = rng.choice(["LAND_RECORD", "SUPPLY_CHAIN", "CERTIFICATE"], size=len(df), p=[0.55, 0.25, 0.20])
    df["domain"] = domains

    tx_ids = []
    entities = []
    districts = []
    mandals = []
    threat_types = []
    pqc_algorithms = []
    pqc_valid_flags = []
    dlt_valid_flags = []

    for i, (is_fraud, dom) in enumerate(zip(y, domains)):
        dist = rng.choice(DISTRICTS)
        m_list = DISTRICT_MANDAL_MAP[dist]
        man = rng.choice(m_list)
        districts.append(dist)
        mandals.append(man)

        pqc_algorithms.append("ML-DSA-65") # NIST FIPS 204

        if is_fraud:
            threat = rng.choice(THREAT_PERSONAS)
            threat_types.append(threat)
            if threat in ("UNLAWFUL_ACREAGE_INFLATION", "SECTION_22A_ALIENATION"):
                # Hash or signature mismatch
                pqc_valid_flags.append(False)
                dlt_valid_flags.append(False)
            else:
                # Critical novelty scenario: PQC and DLT are valid, but QML catches behavioral fraud!
                pqc_valid_flags.append(True)
                dlt_valid_flags.append(True)
        else:
            threat_types.append("NONE_BENIGN")
            pqc_valid_flags.append(True)
            dlt_valid_flags.append(True)

        if dom == "LAND_RECORD":
            tx_ids.append(f"AP-BHUDHAAR-{dist[:3].upper()}-{20000 + i}")
            p_type = rng.choice(LAND_PROPERTY_TYPES)
            srv_no = f"{rng.integers(12, 580)}/{rng.integers(1, 6)}"
            entities.append(f"Survey No. {srv_no} ({p_type}, {man})")
        elif dom == "SUPPLY_CHAIN":
            tx_ids.append(f"AP-AGRI-LOG-{dist[:3].upper()}-{10000 + i}")
            item = rng.choice(COMMODITIES)
            batch = f"LOT-{rng.integers(100, 999)}-{rng.choice(['EXP', 'DOM', 'BIO'])}"
            entities.append(f"{item} [{batch}]")
        else:
            tx_ids.append(f"CUTM-DEGREE-{2026000 + i}")
            c_type = rng.choice(CERT_TYPES)
            roll = f"2201011{rng.integers(100, 999)}"
            entities.append(f"{c_type} (Reg: {roll})")

    df["transaction_id"] = tx_ids
    df["entity_desc"] = entities
    df["district"] = districts
    df["mandal"] = mandals
    df["threat_scenario"] = threat_types
    df["pqc_algorithm"] = pqc_algorithms
    df["pqc_signature_valid"] = pqc_valid_flags
    df["dlt_integrity_valid"] = dlt_valid_flags

    return df


def main():
    parser = argparse.ArgumentParser(description="Q-SHIELD AP Comprehensive Andhra Pradesh Dataset Generator")
    parser.add_argument("--samples", type=int, default=10000, help="Number of transaction samples (default: 10,000)")
    parser.add_argument("--anomaly-ratio", type=float, default=0.16, help="Ratio of anomalous transactions (default: 0.16)")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility")
    parser.add_argument("--output", type=str, default=str(base_dir / "dataset" / "data.csv"), help="Output CSV path")
    args = parser.parse_args()

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    print("=" * 80)
    print("  Q-SHIELD AP: COMPREHENSIVE ANDHRA PRADESH DATASET GENERATOR")
    print("  Domains: AP Bhudhaar Land, Cold-Chain Provenance, CUTM Credentials")
    print("=" * 80)
    print(f"[+] Generating {args.samples:,} enterprise transactions for Andhra Pradesh (Anomaly ratio: {args.anomaly_ratio:.1%})...")

    df = generate_dataset(num_samples=args.samples, anomaly_ratio=args.anomaly_ratio, seed=args.seed)
    df.to_csv(out_path, index=False)

    print(f"\n[OK] Successfully saved dataset to {out_path}")
    print(f"     Total Records:   {len(df):,}")
    print(f"     Legitimate:      {(df['label'] == 0).sum():,} ({((df['label'] == 0).sum()/len(df)):.1%})")
    print(f"     Suspicious:      {(df['label'] == 1).sum():,} ({((df['label'] == 1).sum()/len(df)):.1%})")
    print(f"     Districts:       {df['district'].nunique()} Andhra Pradesh Districts")
    print(f"     Mandals:         {df['mandal'].nunique()} Mandals")
    print(f"     Feature Columns: 10 quantitative telemetry features + metadata")


if __name__ == "__main__":
    main()
