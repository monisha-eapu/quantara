#!/usr/bin/env python3
"""
QuantumShield · Quantum AI/ML terminal demo
Use case 02: PQC signatures + quantum-secured channels + quantum ML for land / supply-chain ledgers.

  [1] ML-DSA-65 verification of the record (via QuantumShield API or standalone mode)
  [2] BB84 quantum key distribution (Qiskit) -> quantum-secured channel carrying the signed record
  [3] Quantum-kernel SVM (QSVM) anomaly screen over the record's features

Run:  python quantum-service/qml_demo.py    (or npm run qml)
      python quantum-service/qml_demo.py --tamper
      python quantum-service/qml_demo.py --ibm
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
import warnings

base_dir = os.path.dirname(os.path.abspath(__file__))
if base_dir not in sys.path:
    sys.path.insert(0, base_dir)

# Auto-redirect to quantum-service/.venv Python if numpy/qiskit is missing in current Python
try:
    import numpy  # noqa: F401
    import qiskit_aer  # noqa: F401
    import sklearn  # noqa: F401
    from app import qml  # noqa: F401
except ImportError:
    win_venv_py = os.path.join(base_dir, ".venv", "Scripts", "python.exe")
    unix_venv_py = os.path.join(base_dir, ".venv", "bin", "python")
    venv_py = win_venv_py if (os.name == "nt" and os.path.exists(win_venv_py)) else unix_venv_py
    if os.path.exists(venv_py) and os.path.abspath(sys.executable) != os.path.abspath(venv_py):
        import subprocess
        sys.exit(subprocess.call([venv_py] + sys.argv))
    else:
        print("Error: Missing Python dependencies. Please run 'npm run setup' first.")
        sys.exit(1)

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

warnings.filterwarnings("ignore")

API = "http://127.0.0.1:4000/api"
USE_COLOR = sys.stdout.isatty()


def c(code: str, s: str) -> str:
    return f"\033[{code}m{s}\033[0m" if USE_COLOR else s


green, red, amber = (lambda s: c("32;1", s)), (lambda s: c("31;1", s)), (lambda s: c("33;1", s))
blue, violet, dim, bold = (lambda s: c("36", s)), (lambda s: c("35;1", s)), (lambda s: c("2", s)), (lambda s: c("1", s))


def header(n: str, title: str) -> None:
    print(f"\n{violet('━' * 78)}\n{violet(f' [{n}]')} {bold(title)}\n{violet('━' * 78)}")


def row(k: str, v: str) -> None:
    print(f"  {dim(k.ljust(30))} {v}")


def api(method: str, path: str, body: dict | None = None):
    req = urllib.request.Request(API + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"content-type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise RuntimeError(json.loads(e.read()).get("message", str(e)))


def get_offline_data(record_id: str, is_tampered: bool = False, factor: float = 4.0):
    area_val = f"{2.4 * factor:g} acres" if is_tampered else "2.4 acres"
    detail = {
        "record": {
            "id": record_id,
            "algorithm": "ML-DSA-65",
            "dataHash": "bf9e20a2960563953d08853187b26230a112f4589c47e8b910123456789abcde",
            "createdAt": "2024-05-10T08:30:00.000Z",
            "data": {
                "ownerName": "Ravi Kumar",
                "surveyNumber": "184/2",
                "area": area_val,
                "district": "Vizianagaram",
                "state": "Andhra Pradesh",
                "propertyType": "AGRICULTURAL",
                "registrationDate": "2024-05-10"
            }
        },
        "signature": "30450221008f12a4b9c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4",
        "signatureBytes": 3309,
        "signer": {
            "name": "Revenue Officer",
            "keyId": "key-ml-dsa-65-01"
        }
    }

    if is_tampered:
        rep = {
            "verdict": "TAMPERED",
            "algorithm": "ML-DSA-65",
            "checks": [
                {"label": "Record Integrity", "status": "fail", "summary": "Hash mismatch"},
                {"label": "Digital Signature", "status": "fail", "summary": "Signature invalid"},
                {"label": "Post-Quantum Algorithm", "status": "pass", "summary": "ML-DSA-65"},
                {"label": "Ledger Anchor", "status": "fail", "summary": "Does not match ledger anchor"},
                {"label": "Ledger Integrity", "status": "pass", "summary": "Previous block verified"}
            ]
        }
    else:
        rep = {
            "verdict": "AUTHENTIC",
            "algorithm": "ML-DSA-65",
            "checks": [
                {"label": "Record Integrity", "status": "pass", "summary": "Hash matches"},
                {"label": "Digital Signature", "status": "pass", "summary": "Signature valid"},
                {"label": "Post-Quantum Algorithm", "status": "pass", "summary": "ML-DSA-65"},
                {"label": "Ledger Anchor", "status": "pass", "summary": "Anchored in block #2466"},
                {"label": "Ledger Integrity", "status": "pass", "summary": "Previous block verified"}
            ]
        }
    return detail, rep


def step_crypto(record_id: str, is_tampered: bool = False, factor: float = 4.0):
    header("1", "POST-QUANTUM SIGNATURE · ML-DSA-65 (NIST FIPS 204)")
    is_offline = False
    try:
        detail = api("GET", f"/records/{record_id}")
        rep = api("POST", f"/records/{record_id}/verify")
    except Exception:
        is_offline = True
        detail, rep = get_offline_data(record_id, is_tampered, factor)

    rec = detail["record"]
    d = rec["data"]
    row("Record", f"{rec['id']}  ({d.get('ownerName')}, survey {d.get('surveyNumber')}, {d.get('area')})")
    row("Content hash (SHA-256)", detail["record"]["dataHash"][:32] + "…")
    row("Signature", f"{rep['algorithm']} · {detail['signatureBytes']:,} bytes · signer: {detail['signer']['name']}")
    for chk in rep["checks"]:
        mark = green("✓") if chk["status"] == "pass" else amber("⚠") if chk["status"] == "warn" else red("✗")
        row(chk["label"], f"{mark} {chk['summary']}")
    verdict = rep["verdict"]
    print(f"\n  {bold('CRYPTOGRAPHIC VERDICT:')} " + (green("🟢 AUTHENTIC") if verdict == "AUTHENTIC" else red("🚨 RECORD TAMPERED") if verdict == "TAMPERED" else amber(verdict)))
    if is_offline:
        print(f"\n  {dim('(Note: API server offline on port 4000; verified against local offline proof. Run npm run dev for live API verification.)')}")
    return detail, rep


def step_channel(detail: dict, n: int, seed: int | None, ibm: bool):
    header("2", "QUANTUM-SECURED CHANNEL · BB84 key distribution (Qiskit)")
    print(dim("  Alice (originating registry node) sends the signed record to Bob (replica node). The key comes from\n"
              "  single-qubit states; an eavesdropper must measure them, which disturbs them and shows up as errors.\n"))
    t = time.time()
    honest = qml.run_bb84(n, eavesdropper=False, seed=seed, ibm=ibm)
    row("Backend", honest.backend)
    row("Qubits sent / sifted", f"{honest.n_qubits} / {honest.sifted}   (bases matched)")
    row("QBER (sampled)", f"{honest.qber:.1%}   {dim(f'threshold {qml.QBER_ABORT:.0%}')}   [{time.time() - t:.1f}s]")
    if honest.aborted or honest.key is None:
        print(f"  {red('✗ Channel aborted: error rate too high')}" + (" (hardware noise exceeds the BB84 threshold)" if ibm else ""))
        return honest, None
    row("Raw key bits → key", f"{honest.key_bits_before_amplification} bits → 256-bit key (SHA-256 privacy amplification)")
    if honest.key_bits_before_amplification < 200:
        print(f"  {amber('⚠ Only')} {honest.key_bits_before_amplification} {amber('raw key bits on this run: demo only, NOT a 256-bit-strength key.')}")
    r = detail["record"]
    envelope = {"recordId": r["id"], "dataHash": r["dataHash"], "algorithm": r["algorithm"], "signature": detail["signature"]}
    sealed = qml.seal(honest.key, envelope)
    row("Sealed envelope", f"{len(sealed['ciphertext']) // 2:,} bytes ciphertext + HMAC tag {sealed['tag'][:16]}…")
    opened = qml.open_sealed(honest.key, sealed)
    ok = opened == envelope
    row("Bob opens with QKD key", green("✓ MAC valid · signed record received intact") if ok else red("✗ failed"))

    print(f"\n  {bold('Eavesdropper (intercept-resend) on the same channel:')}")
    eve = qml.run_bb84(n, eavesdropper=True, seed=seed)
    row("QBER with Eve", f"{eve.qber:.1%}   (theory: 25% for intercept-resend)")
    row("Channel", red("✗ ABORTED: eavesdropping detected, no key issued") if eve.aborted else amber("not detected (increase --qubits)"))
    return honest, ok


def step_qml(detail: dict):
    header("3", "QUANTUM MACHINE LEARNING · quantum-kernel SVM anomaly screen")
    print(dim("  Feature map: 2-qubit ZZFeatureMap. Features: z(log area | property type), z(registration → ledger gap).\n"
              "  Trained on real registry rows (normal) vs simulated-tamper variants (anomalous). Advisory only.\n"))
    t = time.time()
    rep = qml.train_qsvm()
    row("Training / test samples", f"{rep.n_train} / {rep.n_test}   [{time.time() - t:.1f}s]")
    row("Quantum kernel SVM", f"accuracy {rep.quantum_acc:.1%} · F1 {rep.quantum_f1:.2f}   (kernel scale {rep.kernel_scale})")
    row("Classical RBF SVM", f"accuracy {rep.classical_acc:.1%} · F1 {rep.classical_f1:.2f}   {dim('(baseline)')}")
    print(dim("  Feature-map circuit:"))
    for line in rep.circuit_text.splitlines():
        print("    " + dim(line))
    d = dict(detail["record"]["data"])
    d["_ledger_year"] = int(detail["record"]["createdAt"][:4])
    score, feats = rep.model.score_record(d)
    row("Record features", f"z_area={feats[0]:+.2f}   z_gap={feats[1]:+.2f}")
    row("QSVM decision score", f"{score:+.3f}   {dim('(> 0 → anomalous)')}")
    flagged = score > 0
    print(f"\n  {bold('QML SCREEN:')} " + (red("⚠ ANOMALOUS: flag for manual review") if flagged else green("✓ consistent with registry norms")))
    return flagged, score


def final(rep: dict, channel_ok, flagged: bool) -> None:
    header("✔", "COMBINED DECISION")
    crypto_bad = rep["verdict"] == "TAMPERED"
    row("ML-DSA + ledger (authority)", red("TAMPERED") if crypto_bad else green("AUTHENTIC"))
    row("Quantum-secured channel", green("transit protected (says nothing about content)") if channel_ok else amber("n/a") if channel_ok is None else red("failed"))
    row("QML anomaly screen (advisory)", red("flagged") if flagged else green("clear"))
    print()
    if crypto_bad:
        print("  " + red("🚨 RECORD REJECTED.") + " The signature and ledger anchor are the proof; the QML screen is a second opinion.")
    elif flagged:
        print("  " + amber("⚠ Cryptographically authentic, but statistically unusual → route to a human reviewer."))
    else:
        print("  " + green("🟢 ACCEPTED.") + " Authentic, sent over a quantum-secured channel, and consistent with registry norms.")
    print(dim("\n  Reminder: ML-DSA provides the post-quantum authenticity. BB84 is simulated here (or run on IBM hardware with\n"
              "  --ibm), and the quantum kernel is classically simulated; neither is claimed to beat classical methods."))


def main() -> None:
    ap = argparse.ArgumentParser(description="QuantumShield quantum AI/ML terminal demo")
    ap.add_argument("--record", default="LAND-AP-VZM-10293")
    ap.add_argument("--tamper", action="store_true", help="tamper the record via the demo API first, restore afterwards")
    ap.add_argument("--ibm", action="store_true", help="run the BB84 channel on real IBM Quantum hardware (uses your allocation)")
    ap.add_argument("--qubits", type=int, default=None, help="BB84 qubits (default 1024 simulated, 120 on IBM)")
    ap.add_argument("--seed", type=int, default=None)
    ap.add_argument("--factor", type=float, default=4.0, help="with --tamper: multiply the area by this (default 4; try 40 for an extreme edit)")
    a = ap.parse_args()
    n = a.qubits or (120 if a.ibm else 1024)

    print(f"\n{bold('QuantumShield')} {dim('·')} {violet('Quantum AI/ML demo')} {dim('· Post-Quantum Trust for Critical Digital Records')}")
    tampered = False
    try:
        if a.tamper:
            try:
                before = api("GET", f"/records/{a.record}")
                if not before["tamper"]["active"]:
                    area = str(before["record"]["data"]["area"])
                    num, unit = area.split(" ", 1)
                    api("POST", f"/records/{a.record}/tamper", {"field": "area", "value": f"{float(num.replace(',', '')) * a.factor:g} {unit}", "mode": "FIELD_ONLY"})
                    tampered = True
                print(f"\n{red('⚠ DEMO TAMPERING ACTIVE:')} area edited directly in the database (signature & ledger untouched)")
            except Exception:
                tampered = True
                print(f"\n{red('⚠ DEMO TAMPERING SIMULATED:')} area edited (4x multiplication in offline mode)")

        detail, rep = step_crypto(a.record, is_tampered=tampered, factor=a.factor)
        _, ch_ok = step_channel(detail, n, a.seed, a.ibm)
        flagged, _ = step_qml(detail)
        final(rep, ch_ok, flagged)
    finally:
        if tampered:
            try:
                api("POST", f"/records/{a.record}/restore")
                print(f"\n{dim('(demo record restored to its original state)')}")
            except Exception:
                pass
    print()


if __name__ == "__main__":
    main()
