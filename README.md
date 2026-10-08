# QuantumShield

**Post-Quantum Trust for Critical Digital Records**

Hackathon prototype for *Use Case 02: Quantum-safe DLT for Land Records & Supply Chains*. It combines a tamper-evident, append-only ledger with **ML-DSA (NIST FIPS 204)** post-quantum signatures to protect land ownership records and supply-chain provenance. A separate **Quantum Threat Lab** runs real Qiskit circuits on **IBM Quantum** hardware to illustrate the threat model.

> ⚠️ **This is a hackathon prototype.** All records, people, companies and batches are fictional. Production use would require proper key management (HSM/KMS), identity infrastructure, distributed consensus, access control, independent auditing and a security review.

---

## 1. Problem

Land titles, certificates and regulated provenance records must stay authentic and verifiable for **decades**. Today they are typically protected by RSA or elliptic-curve (ECDSA) signatures. A sufficiently large, fault-tolerant quantum computer running Shor's algorithm could forge such signatures. A record signed today with RSA/ECC could then no longer prove its authenticity, even though it is still legally relevant.

## 2. Solution

QuantumShield signs every record and every custody event with **ML-DSA-65** and anchors it on a hash-chained ledger:

```
USER CREATES RECORD
      ↓
CANONICAL RECORD DATA         sorted-key JSON, so identical records give identical bytes
      ↓
SHA-256 HASH                  content fingerprint
      ↓
ML-DSA-65 SIGNATURE           post-quantum digital signature (FIPS 204) by the issuing authority
      ↓
LEDGER BLOCK                  commits to hash + signature + signer + previous block hash
      ↓
VERIFICATION                  recompute hash · verify signature · check anchor · walk chain
      ↓
AUTHENTIC / TAMPERED
```

Each component does one job:

| Component | Job | Quantum outlook |
|---|---|---|
| SHA-256 | Content fingerprint | Grover gives only a quadratic speed-up (~2^128 work for preimages), so it remains sound |
| **ML-DSA-65** | Digital signature (authenticity, non-repudiation) | Designed to resist quantum attacks; replaces RSA/ECDSA |
| Ledger | Tamper-evident history and provenance | Hash links are not "quantum-safe magic". The blockchain itself is not what makes this post-quantum; the signatures are |

## 3. Why quantum computing matters

Shor's algorithm turns factoring and discrete logarithms, the problems behind RSA and ECC, into **period finding**, which a quantum computer can do efficiently. No machine large enough exists today. Published estimates (e.g. Gidney, 2025) suggest RSA-2048 would need on the order of a million noisy physical qubits running error-corrected for days. Records with multi-decade lifetimes nonetheless need protection now, before such machines exist.

## 4. Why PQC is needed

Signatures made today with RSA/ECC can be forged once a cryptographically relevant quantum computer exists, and long-lived records cannot wait for that point. Post-quantum cryptography runs on **ordinary classical computers**, so it can be deployed today. NIST published FIPS 203/204/205 in August 2024. The initial public draft of NIST IR 8547 proposes deprecating quantum-vulnerable algorithms after 2030 and disallowing them after 2035.

## 5. Why ML-DSA

- NIST-standardised (FIPS 204, Module-Lattice-Based Digital Signature Algorithm, formerly CRYSTALS-Dilithium).
- General-purpose signature scheme with fast signing and verification (sub-millisecond here).
- ML-DSA-65 targets NIST security category 3.
- Available **natively** in OpenSSL 3.5, and therefore in Node.js 24's `crypto` module. QuantumShield does **not** implement any cryptography itself.
- Trade-off: larger artefacts than ECDSA (1,952-byte public key vs 91 B; 3,309-byte signature vs ~71 B). The Migration page measures this live.

## 6. Architecture

```
┌─────────────────────────── Browser (React + Vite + Tailwind) ───────────────────────────┐
│ Dashboard · Land Registry · Supply Chain · Verify · Ledger · Audit · Migration · Quantum │
└───────────────────────────────────────────┬─────────────────────────────────────────────┘
                                            │ /api  (no private keys ever sent)
┌───────────────────────────────────────────▼─────────────────────────────────────────────┐
│ SECURITY LAYER — Node.js 24 / Express / TypeScript                       server/         │
│  crypto/schemes.ts   SignatureScheme abstraction (ML-DSA-65 default; ECDSA legacy only)  │
│  crypto/keystore.ts  signer registry; private keys in data/keys (0600), public keys in DB│
│  services/ledger.ts  append-only hash chain, chain verification, tamper simulation       │
│  services/verification.ts   independent 5-check verification engine                      │
│  services/records|land|supplyChain|migration|integrity|audit.ts                          │
│  SQLite (node:sqlite): signers · records · supply_chain_events · ledger_blocks · audit   │
└───────────────────────────────────────────┬─────────────────────────────────────────────┘
                                            │ /api/quantum/* (thin proxy, audit-logged)
┌───────────────────────────────────────────▼─────────────────────────────────────────────┐
│ QUANTUM LAYER — Python / FastAPI / Qiskit 2.2 + qiskit-ibm-runtime   quantum-service/    │
│  Threat demonstration ONLY. Never receives records, signatures or keys.                  │
│  Targets: Aer ideal sim · Aer + FakeTorino noise model · IBM Quantum hardware (SamplerV2)│
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

The two layers are separate processes. If the quantum service is off, every security feature keeps working.

## 7. Data flow

**Create a land record** (`POST /api/records`): validate (zod) → `canonicalize(data)` → `SHA-256` → sign `QuantumShield/v1|LAND_RECORD|<id>|<hash>` with the authority's ML-DSA-65 key → in one transaction, append ledger block and insert record → audit `CREATE_RECORD`. The response includes a full signing trace with per-step timings.

**Verify** (`POST /api/records/:id/verify`). No stored status flag is trusted; every check recomputes from the current database bytes:

1. **Record integrity**: SHA-256 of the current canonical data equals the stored hash.
2. **Digital signature**: ML-DSA verification over the *current* content hash with the signer's registered public key.
3. **Post-quantum algorithm**: ML-DSA (pass) or legacy classical (warning).
4. **Ledger anchor**: the anchoring block commits to the same hash and signature.
5. **Ledger integrity**: every block hash recomputed and every previous-hash link checked.
6. *(hybrid records)* Legacy co-signature still valid.
7. *(supply-chain events)* **Provenance link**: `previousEventHash` equals the recomputed hash of the previous step.

**Tampering simulation** (`POST /api/records/:id/tamper`): a *controlled demo* that edits record content directly in the database, as an insider would, without the private key and without touching the ledger. Two attacker modes are available:
- `FIELD_ONLY`: hash, signature and anchor all fail.
- `FIELD_AND_HASH`: the attacker also rewrites the stored hash. The naive hash check passes, but the **signature and ledger anchor still fail**, which shows why a hash alone is not enough.

The original row is snapshotted so `POST /restore` can reset the demo.

## 8. Ledger design

Single-node permissioned append-only ledger. There is no mining, proof-of-work or token.

```json
{
  "index": 2466, "timestamp": "…", "recordId": "LAND-AP-VZM-10293", "recordType": "LAND_RECORD",
  "action": "CREATE", "dataHash": "<sha256>", "signature": "<ML-DSA-65, 3309 B>", "algorithm": "ML-DSA-65",
  "signerId": "revenue-ap", "signer": "Revenue Officer", "previousHash": "<blockHash of #2465>",
  "blockHash": "SHA-256(canonical(all fields above))"
}
```

- Block hashes commit to the whole header, including the signature and previous hash.
- `GET /api/ledger/verify` recomputes all hashes and links and re-verifies **every** block signature (~2,500 blocks in about 200 ms).
- Supply-chain events form a second, per-product hash chain (`previousEventHash`) on top of the global ledger.
- Migrations append a `MIGRATE` block; history is never rewritten.
- Ledger tamper demo: edit a block with its hash left stale (`BLOCK_HASH_MISMATCH`), or edit and re-hash it (`BROKEN_LINK` at the next block, plus an invalid signature).

## 9. Security model

| Property | How |
|---|---|
| Authenticity | ML-DSA-65 signature by the accountable authority over a domain-separated message |
| Integrity | SHA-256 over canonical data; re-checked on every verification |
| Tamper evidence | Hash-chained blocks; record ↔ block anchor; event ↔ event links |
| Post-quantum readiness | All new signatures ML-DSA; `SignatureScheme` abstraction for crypto-agility; hybrid migration path |
| Key secrecy | Private keys are server-side only (`server/data/keys`, mode 0600) and never returned by any API |
| Accountability | Audit log of creates, verifications, tamper attempts, detections, migrations and quantum jobs |
| Honesty | The quantum lab never claims to break RSA/ECC; quantum and security layers are explicitly separated in UI and code |

**Not provided** (prototype): authentication/RBAC, HSM-backed keys, key rotation/revocation, multi-party consensus, trusted timestamping, audit-log signing, encryption at rest.

## 10. Installation

Requirements:
- **Node.js ≥ 24**. Must be built with OpenSSL ≥ 3.5 for native ML-DSA; official Node 24 builds are. The server refuses to start otherwise; it never silently falls back.
- **Python 3.9+** for the quantum service. 3.10+ is recommended because Qiskit is dropping 3.9.

```bash
npm run setup      # npm install + Python venv + pip install -r quantum-service/requirements.txt + creates .env
```

## 11. Environment variables

See [.env.example](.env.example).

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | 4000 | API port |
| `QS_DATA_DIR` | `data` | SQLite DB + private keys (relative to `server/`) |
| `QS_SEED_TOTAL` | 2481 | Size of the fictional demo dataset |
| `QUANTUM_SERVICE_URL` | `http://127.0.0.1:8001` | Quantum service location |
| `IBM_QUANTUM_TOKEN` | — | IBM Quantum API key (enables real hardware) |
| `IBM_QUANTUM_INSTANCE` | — | IBM Cloud instance CRN |
| `IBM_QUANTUM_CHANNEL` | `ibm_quantum_platform` | Qiskit Runtime channel |
| `IBM_QUANTUM_BACKEND` | — | Fixed backend (otherwise least busy) |

Instead of setting the token in `.env`, you can save an account once with `QiskitRuntimeService.save_account(...)`. The service picks it up from `~/.qiskit`. Tokens are never returned by any endpoint.

## 12. Running locally

```bash
npm run dev        # API :4000 + web :5173 + quantum service :8001
open http://localhost:5173
```

Other commands:

```bash
npm test           # server tests (node:test) + quantum-service tests (unittest)
npm run typecheck
npm run seed       # wipe & re-seed fictional demo data (keys are kept)
npm run build && npm start   # production: API serves web/dist on :4000
```

On first start the database is seeded automatically. The seed creates 2,481 signed entities: 2,450 land records (10 featured, 3 legacy ECDSA), 5 product batches and 26 provenance events. It also runs a seeded red-team scenario with 4 tampered historical records, so the dashboard shows real detected alerts.

## 13. Demo instructions (3–5 minutes)

1. **Dashboard**: "2,481 protected records", "Post-quantum (ML-DSA) verification online", system status panel.
2. **Land Registry** → open **LAND-AP-VZM-10293** (Ravi Kumar · Survey 184/2 · 2.4 acres). The cryptographic seal shows ML-DSA-65, signature VALID, hash VERIFIED, ledger VERIFIED.
3. **VERIFY RECORD** → 🟢 AUTHENTIC RECORD (five checks pass).
4. **SIMULATE TAMPERING** → owner *Ravi Kumar* → *Raj Kumar* (pre-filled).
5. **VERIFY AGAIN** → ❌ Hash mismatch · ❌ Signature invalid · ❌ Ledger anchor mismatch → 🚨 **RECORD TAMPERED**. The original vs current hash and the altered field are shown. *Optional:* repeat with "recompute the stored hash" to show the signature still catches it.
6. **RESTORE ORIGINAL** → **VERIFY AGAIN** → 🟢 AUTHENTIC.
7. **Supply Chain** → *Organic Pharmaceutical Ingredient* (PHARMA-BT-9921) → **VERIFY PROVENANCE CHAIN**: Manufactured → Quality Check → Warehouse → Transport → Distributor → Retailer, each step with ✓ signature / hash / link. *Optional:* tamper the QC result and watch the next step's link break too.
8. **PQC Migration** → *Compare* (live ECDSA vs ML-DSA sizes and timings) → *Migrate to ML-DSA* on a legacy record (verify legacy → re-sign → hybrid → MIGRATE block).
9. **Quantum Threat Lab** → *Shor Order-Finding (N = 15)* → run on the noisy IBM-device simulator, or on **IBM Quantum hardware** if a token is set. Point out the "Reality check" box and the separation banner.
10. *(Optional)* **Ledger Explorer** → open a block → "Edit block and recompute its hash" → **Verify entire ledger** → FAILED at the next block → restore.

To reset everything: **Cryptography → Reset demo data**, or `npm run seed`.

## 14. Quantum Threat Lab (IBM Quantum)

Three real circuits, defined in [quantum-service/app/circuits.py](quantum-service/app/circuits.py):

| Circuit | Qubits | Purpose |
|---|---|---|
| GHZ entanglement | 3 | Hardware sanity check: proves the job ran on a real QPU (noise included) |
| Shor order-finding, N = 15, a = 7 | 7 | The period-finding core of Shor's algorithm; continued fractions recover r = 4 and the factors 3 × 5 |
| Grover search (3 qubits) | 3 | Shows the *quadratic* speed-up, which is why SHA-256 stays |

There are three execution targets: a local ideal simulator (Aer), a local noisy simulator using IBM Torino's calibration snapshot (`FakeTorino`, clearly labelled as simulation), and **real IBM Quantum hardware** via `QiskitRuntimeService` + `SamplerV2`. Hardware jobs are transpiled for the chosen backend, persisted with their IBM job ID, and polled until done. Results include histograms vs ideal, Hellinger fidelity, transpiled depth, two-qubit gate count, physical qubit layout and QPU seconds.

**What it does not claim:** the N = 15 circuit does not threaten RSA/ECC and is not Shor's algorithm at useful scale. Multiplication by constants mod 15 happens to be a bit permutation, so it is written with SWAP/X gates, a shortcut that doesn't exist for general N (see Smolin, Smith & Vargo, *Oversimplifying quantum factoring*, Nature 2013). The quantum service never sees records, signatures or keys.

## 15. Limitations

- Single-node ledger; no BFT consensus, replication or peer authorities.
- No authentication or RBAC; any client can call any endpoint (including the demo tamper endpoints).
- Private keys are PEM files on disk; no HSM/KMS, rotation, revocation or certificate chain.
- Timestamps come from the server clock (no RFC 3161 timestamping authority).
- The tamper and restore endpoints exist purely for demonstration and must not exist in production.
- The ML-DSA implementation is OpenSSL's; it has not been reviewed further here. The app as a whole has had no security review.
- IBM hardware execution was verified end-to-end against Qiskit Runtime's local test channel. A real hardware run needs your IBM Quantum token and consumes your allocation.
- Python 3.9 works but is deprecated by Qiskit; use 3.10+.

## 16. Future production architecture

- **Keys:** FIPS 140-3 HSM / cloud KMS with ML-DSA support; per-officer keys bound to verified identities (PKI with PQC or hybrid certificates); rotation and revocation lists.
- **Ledger:** permissioned DLT (e.g. Hyperledger Fabric/Besu) operated by independent authorities (revenue, registration, courts, auditors) with BFT consensus; block proposals co-signed with ML-DSA.
- **Hybrid signatures:** composite ECDSA + ML-DSA during transition for interoperability, then PQC-only.
- **Identity & access:** OIDC/SAML with role-based policies, maker-checker approval for ownership transfers.
- **Timestamping:** RFC 3161 TSA with PQC signatures; periodic anchoring of the ledger tip to an external transparency log.
- **Privacy:** store personal data off-chain (encrypted, ML-KEM for key exchange); ledger keeps only hashes.
- **Assurance:** signed audit logs, monitoring and alerting, penetration testing, formal security review.

## Repository layout

```
server/            Node.js security layer (ML-DSA, ledger, verification, API)
  src/crypto/      canonicalisation, signature-scheme abstraction, key store
  src/services/    ledger, records, land, supplyChain, verification, migration, integrity, audit
  src/core.test.ts unit tests
web/               React frontend
quantum-service/   Python/Qiskit IBM Quantum threat demonstration
scripts/           setup + quantum launcher
```
