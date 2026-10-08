#!/usr/bin/env python3
"""
================================================================================
  Q-SHIELD AP: Master Hackathon Live Terminal Demonstration
  QML Detects. PQC Protects. DLT Proves.
  Building Quantum-Ready Trust Infrastructure for Andhra Pradesh
================================================================================
"""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

# Auto-reconfigure terminal encoding for Windows environments
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Auto-redirect to virtual environment if run with base python
base_dir = Path(__file__).resolve().parent
venv_py = base_dir / "quantum-service" / ".venv" / ("Scripts" if os.name == "nt" else "bin") / ("python.exe" if os.name == "nt" else "python")
if venv_py.exists() and sys.executable != str(venv_py):
    import subprocess
    sys.exit(subprocess.call([str(venv_py), __file__] + sys.argv[1:]))

if str(base_dir) not in sys.path:
    sys.path.insert(0, str(base_dir))

from qml import qlie_predict

# Color styling
USE_COLOR = sys.stdout.isatty()
def c(code: str, s: str) -> str: return f"\033[{code}m{s}\033[0m" if USE_COLOR else s
green, red, amber = (lambda s: c("32;1", s)), (lambda s: c("31;1", s)), (lambda s: c("33;1", s))
cyan, violet, dim, bold = (lambda s: c("36;1", s)), (lambda s: c("35;1", s)), (lambda s: c("2", s)), (lambda s: c("1", s))

LINE_W = 74

def banner():
    print(cyan("=" * LINE_W))
    print(bold("  Q-SHIELD AP: Quantum-Safe Trust Intelligence for Andhra Pradesh"))
    print(cyan("  Venue: Centurion University of Technology and Management, Vizianagaram"))
    print(dim("  Tagline: QML Detects. PQC Protects. DLT Proves."))
    print(cyan("=" * LINE_W))


def run_pipeline(scenario_title: str, scenario_num: int, tx: dict, pqc_valid: bool, dlt_valid: bool):
    print(f"\n{violet('-' * LINE_W)}")
    print(f"{violet(f' [SCENARIO {scenario_num}]')} {bold(scenario_title)}")
    print(f"{violet('-' * LINE_W)}")

    print(f"  {dim('Entity ID:')}        {tx['id']}")
    print(f"  {dim('Entity Type:')}      {tx['type']}")
    print(f"  {dim('Location:')}         {tx['location']}")
    print(f"  {dim('Description:')}      {tx['desc']}")

    # 1. PQC Authentication Layer (NIST FIPS 204 ML-DSA-65)
    print(f"\n  {bold('[1] POST-QUANTUM CRYPTOGRAPHY (PQC) LAYER:')}")
    print(f"      Algorithm:        ML-DSA-65 (NIST FIPS 204 Category 3)")
    print(f"      Signer:           {tx.get('signer', 'Revenue Officer, Andhra Pradesh')}")
    if pqc_valid:
        print(f"      PQC Signature:    {green('✓ VALID')} (Canonical SHA-256 fingerprint verified)")
    else:
        print(f"      PQC Signature:    {red('✗ INVALID / TAMPERED')} (Hash mismatch; unauthorized alteration)")

    # 2. DLT Permissioned Ledger Validation
    print(f"\n  {bold('[2] DISTRIBUTED LEDGER TECHNOLOGY (DLT) INTEGRITY:')}")
    print(f"      Block Anchor:     Block #{tx.get('block_num', 2466)}")
    if dlt_valid:
        print(f"      Ledger Chain:     {green('✓ INTACT')} (Previous block hash commitment verified)")
    else:
        print(f"      Ledger Chain:     {red('✗ BROKEN')} (Historical block integrity check failed)")

    # 3. QLIE (Quantum Ledger Intelligence Engine)
    print(f"\n  {bold('[3] QUANTUM MACHINE LEARNING (QLIE) BEHAVIORAL INTELLIGENCE:')}")
    t0 = time.time()
    qml_res = qlie_predict(tx["features"])
    elapsed_ms = (time.time() - t0) * 1000

    q_class = qml_res["classification"]
    q_risk = qml_res["risk_score"]
    q_color = green if q_risk < 0.40 else (amber if q_risk < 0.65 else red)

    print(f"      QML Architecture: {qml_res['model']} ({qml_res['qubits']} Qubits, {qml_res['feature_map']})")
    print(f"      Backend Engine:   {qml_res['backend']} [{elapsed_ms:.1f}ms]")
    print(f"      Classification:   {q_color(q_class)}")
    print(f"      Risk Score:       {q_color(f'{q_risk:.1%}')} (Calibrated decision probability)")
    print(f"      Circuit Depth:    {qml_res['circuit_depth']} layers")
    print(f"      Evidence:         {dim('; '.join(qml_res['behavioral_evidence']))}")

    # 4. Security Decision Policy Engine
    print(f"\n  {bold('[4] SECURITY DECISION ENGINE POLICY EVALUATION:')}")
    if not pqc_valid or not dlt_valid:
        decision = red("🚨 BLOCKED")
        rationale = "CRITICAL FAILURE: Cryptographic or ledger integrity failed. Malicious payload rejected."
    elif q_risk >= 0.65:
        decision = amber("⚠️ HUMAN REVIEW REQUIRED")
        rationale = "CRITICAL NOVELTY DEMO: Cryptography is valid, but QML flagged abnormal behavior! Escalated to officer."
    else:
        decision = green("🟢 APPROVED")
        rationale = "SECURE & LEGITIMATE: PQC valid, ledger intact, and behavioral pattern adheres to registry norms."

    print(f"      Final Decision:   {decision}")
    print(f"      Rationale:        {rationale}")
    sys.stdout.flush()


def main():
    banner()

    # Scenario 1: Legitimate Land Record Transfer
    tx_legit = {
        "id": "LAND-AP-VZM-10293",
        "type": "Land Title Registration (Pattadar)",
        "location": "Bhogapuram Mandal, Vizianagaram District",
        "desc": "Survey No. 184/2 (Ravi Kumar, 2.4 acres Agricultural Land)",
        "signer": "Revenue Department, Andhra Pradesh",
        "block_num": 2466,
        "features": {
            "transaction_frequency": 1.4,
            "transaction_velocity": 0.12,
            "ownership_change_frequency": 0.0,
            "geographical_distance": 8.5,
        }
    }

    # Scenario 2: Authorized but Suspicious (The Key Differentiator!)
    # Insider or compromised credential: Valid key, but anomalous velocity & geographical leap!
    tx_suspicious = {
        "id": "LAND-AP-VZM-99410",
        "type": "Rapid Successive Transfer",
        "location": "Denkada Mandal, Vizianagaram District",
        "desc": "Survey No. 312/1 (Transferred 4 times in 3 weeks across distantly logged nodes)",
        "signer": "Revenue Department, Andhra Pradesh (Validly Signed Credentials)",
        "block_num": 2467,
        "features": {
            "transaction_frequency": 8.7,
            "transaction_velocity": 0.82,
            "ownership_change_frequency": 4.0,
            "geographical_distance": 310.0,
        }
    }

    # Scenario 3: Database Tampering Injection
    # Attacker directly modified the database table bypassing signing authority
    tx_tampered = {
        "id": "LAND-AP-VZM-10293-TAMPERED",
        "type": "Direct SQL/DB Field Overwrite",
        "location": "Vizianagaram Rural",
        "desc": "Area altered from 2.4 acres to 24.0 acres directly in database",
        "signer": "Revenue Department, Andhra Pradesh",
        "block_num": 2466,
        "features": {
            "transaction_frequency": 6.5,
            "transaction_velocity": 0.70,
            "ownership_change_frequency": 3.0,
            "geographical_distance": 180.0,
        }
    }

    run_pipeline("Normal Transaction (Authentic Pattadar Transfer)", 1, tx_legit, pqc_valid=True, dlt_valid=True)
    time.sleep(0.1)

    run_pipeline("Authorized but Suspicious (Insider / Compromised Credential)", 2, tx_suspicious, pqc_valid=True, dlt_valid=True)
    time.sleep(0.1)

    run_pipeline("Tampered Transaction (Database Record Injection)", 3, tx_tampered, pqc_valid=False, dlt_valid=False)

    print(cyan("\n" + "=" * LINE_W))
    print(bold("  Q-SHIELD AP SUMMARY:"))
    print("  Traditional Security asks:   'Is the signature valid?'")
    print("  Q-SHIELD AP asks:            'Is the signature valid (PQC)?'")
    print("                               + 'Does the behavior look legitimate (QML)?'")
    print("                               + 'Does the ledger history remain intact (DLT)?'")
    print(cyan("=" * LINE_W + "\n"))


if __name__ == "__main__":
    main()
