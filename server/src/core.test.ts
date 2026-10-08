import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { before, describe, it } from "node:test";

// Isolated database + key store for every test run.
process.env.QS_DATA_DIR = mkdtempSync(join(tmpdir(), "qs-test-"));
process.env.QS_SEED_TOTAL = "80";

const { canonicalize, hashCanonical } = await import("./crypto/canonical.js");
const { getScheme } = await import("./crypto/schemes.js");
const { ensureSigners } = await import("./crypto/keystore.js");
const { seedDemoData, DEMO_RECORD_ID } = await import("./seed.js");
const records = await import("./services/records.js");
const ledger = await import("./services/ledger.js");
const supply = await import("./services/supplyChain.js");
const migration = await import("./services/migration.js");

before(() => {
  ensureSigners();
  seedDemoData(() => undefined);
});

describe("canonicalisation & hashing", () => {
  it("is independent of key order", () => {
    assert.equal(canonicalize({ b: 1, a: { d: [1, 2], c: "x" } }), canonicalize({ a: { c: "x", d: [1, 2] }, b: 1 }));
    assert.equal(hashCanonical({ a: 1 }).length, 64);
  });
});

describe("ML-DSA-65", () => {
  it("signs, verifies and rejects modified messages", () => {
    const s = getScheme("ML-DSA-65");
    const { publicKey, privateKey } = s.generateKeyPair();
    const sig = s.sign(Buffer.from("record"), privateKey);
    assert.equal(sig.length, 3309);
    assert.equal(s.verify(Buffer.from("record"), sig, publicKey), true);
    assert.equal(s.verify(Buffer.from("rec0rd"), sig, publicKey), false);
  });
});

describe("tamper detection", () => {
  it("demo record verifies as authentic", () => {
    assert.equal(records.verifyRecord(DEMO_RECORD_ID).verdict, "AUTHENTIC");
  });

  it("content-only tampering fails hash, signature and anchor", () => {
    records.tamperRecord(DEMO_RECORD_ID, { field: "ownerName", value: "Raj Kumar", mode: "FIELD_ONLY" });
    const r = records.verifyRecord(DEMO_RECORD_ID);
    const status = Object.fromEntries(r.checks.map((c) => [c.id, c.status]));
    assert.equal(r.verdict, "TAMPERED");
    assert.deepEqual([status.hash, status.signature, status.anchor, status.chain], ["fail", "fail", "fail", "pass"]);
    assert.deepEqual(r.changedFields, [{ field: "ownerName", original: "Ravi Kumar", current: "Raj Kumar" }]);
  });

  it("restore makes the record authentic again", () => {
    records.restoreRecord(DEMO_RECORD_ID);
    assert.equal(records.verifyRecord(DEMO_RECORD_ID).verdict, "AUTHENTIC");
  });

  it("re-hashing attacker still fails signature and anchor", () => {
    records.tamperRecord(DEMO_RECORD_ID, { field: "area", value: "24 acres", mode: "FIELD_AND_HASH" });
    const r = records.verifyRecord(DEMO_RECORD_ID);
    const status = Object.fromEntries(r.checks.map((c) => [c.id, c.status]));
    assert.equal(status.hash, "pass");
    assert.equal(status.signature, "fail");
    assert.equal(status.anchor, "fail");
    records.restoreRecord(DEMO_RECORD_ID);
  });
});

describe("ledger", () => {
  it("is intact after seeding, including signatures", () => {
    assert.equal(ledger.verifyChain({ signatures: true }).valid, true);
  });

  it("detects an edited block and a re-hashed block, then recovers", () => {
    ledger.tamperBlock(5, "EDIT_ONLY");
    assert.ok(ledger.verifyChain().issues.some((i) => i.index === 5 && i.kind === "BLOCK_HASH_MISMATCH"));
    ledger.restoreBlock(5);
    ledger.tamperBlock(5, "EDIT_AND_REHASH");
    assert.ok(ledger.verifyChain().issues.some((i) => i.index === 6 && i.kind === "BROKEN_LINK"));
    ledger.restoreBlock(5);
    assert.equal(ledger.verifyChain({ signatures: true }).valid, true);
  });
});

describe("supply chain", () => {
  it("tampering one event breaks it and the next provenance link", () => {
    supply.tamperEvent("PHARMA-BT-9921-E02", { field: "metadata.qcResult", value: "FAILED" });
    const r = supply.verifyProductChain("PHARMA-BT-9921");
    assert.equal(r.verdict, "TAMPERED");
    assert.equal(r.events[1].verdict, "TAMPERED");
    assert.equal(r.events[2].checks.find((c) => c.id === "eventLink")?.status, "fail");
    supply.restoreEvent("PHARMA-BT-9921-E02");
    assert.equal(supply.verifyProductChain("PHARMA-BT-9921").verdict, "AUTHENTIC");
  });

  it("enforces lifecycle order", () => {
    assert.throws(() => supply.addEvent("PHARMA-BT-9921", { eventType: "WAREHOUSE", location: "X Y", custodian: "Z Z" }));
  });
});

describe("PQC migration", () => {
  it("re-signs a legacy record with ML-DSA and keeps the legacy co-signature", () => {
    const out = migration.migrateRecord("LAND-AP-VZM-00412");
    assert.equal(out.before.verdict, "AUTHENTIC_LEGACY");
    assert.equal(out.after.verdict, "AUTHENTIC");
    assert.equal(out.after.checks.find((c) => c.id === "legacy")?.status, "pass");
  });
});
