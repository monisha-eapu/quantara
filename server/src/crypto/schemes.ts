import { createPublicKey, generateKeyPairSync, sign, verify, type KeyObject } from "node:crypto";

/**
 * Crypto-agility abstraction: every signature in the system goes through a SignatureScheme.
 * Swapping the algorithm (e.g. ML-DSA-65 -> ML-DSA-87, or a hybrid) is a registry change,
 * not a rewrite.
 */
export interface SignatureScheme {
  /** Identifier stored alongside every signature. */
  id: AlgorithmId;
  displayName: string;
  family: "POST_QUANTUM" | "CLASSICAL";
  standard: string;
  securityNote: string;
  generateKeyPair(): { publicKey: KeyObject; privateKey: KeyObject };
  sign(message: Buffer, privateKey: KeyObject): Buffer;
  verify(message: Buffer, signature: Buffer, publicKey: KeyObject): boolean;
}

export type AlgorithmId = "ML-DSA-65" | "ECDSA-P256-SHA256";

/** ML-DSA (FIPS 204, formerly CRYSTALS-Dilithium) via Node's OpenSSL 3.5 provider. */
const mlDsa65: SignatureScheme = {
  id: "ML-DSA-65",
  displayName: "ML-DSA-65",
  family: "POST_QUANTUM",
  standard: "NIST FIPS 204 (Module-Lattice-Based Digital Signature Standard)",
  securityNote: "NIST security category 3. Designed to resist attacks by both classical and quantum computers.",
  generateKeyPair: () => generateKeyPairSync("ml-dsa-65"),
  // ML-DSA signs the message directly (hashing is internal), so the digest arg is null.
  sign: (message, privateKey) => sign(null, message, privateKey),
  verify: (message, signature, publicKey) => {
    try {
      return verify(null, message, publicKey, signature);
    } catch {
      return false;
    }
  },
};

/** Classical ECDSA, used ONLY to model legacy records and the migration path. Not quantum-resistant. */
const ecdsaP256: SignatureScheme = {
  id: "ECDSA-P256-SHA256",
  displayName: "ECDSA P-256 (legacy)",
  family: "CLASSICAL",
  standard: "FIPS 186-5 / SEC 1 (elliptic-curve)",
  securityNote: "Classical. A large fault-tolerant quantum computer running Shor's algorithm could forge these signatures.",
  generateKeyPair: () => generateKeyPairSync("ec", { namedCurve: "P-256" }),
  sign: (message, privateKey) => sign("sha256", message, privateKey),
  verify: (message, signature, publicKey) => {
    try {
      return verify("sha256", message, publicKey, signature);
    } catch {
      return false;
    }
  },
};

const registry: Record<AlgorithmId, SignatureScheme> = {
  "ML-DSA-65": mlDsa65,
  "ECDSA-P256-SHA256": ecdsaP256,
};

/** The algorithm used for all new signatures. */
export const DEFAULT_ALGORITHM: AlgorithmId = "ML-DSA-65";

export function getScheme(id: string): SignatureScheme {
  const scheme = registry[id as AlgorithmId];
  if (!scheme) throw new Error(`Unsupported signature algorithm: ${id}`);
  return scheme;
}

export function listSchemes(): SignatureScheme[] {
  return Object.values(registry);
}

export function isPostQuantum(id: string): boolean {
  return registry[id as AlgorithmId]?.family === "POST_QUANTUM";
}

/** Fails fast at boot if the runtime's OpenSSL lacks ML-DSA, instead of silently degrading. */
export function assertPqcAvailable(): void {
  try {
    const { publicKey, privateKey } = mlDsa65.generateKeyPair();
    const msg = Buffer.from("self-test");
    if (!mlDsa65.verify(msg, mlDsa65.sign(msg, privateKey), publicKey)) throw new Error("self-test signature failed to verify");
    createPublicKey(publicKey.export({ type: "spki", format: "pem" }));
  } catch (err) {
    throw new Error(
      `ML-DSA is not available in this Node.js runtime (${process.versions.openssl}). ` +
        `QuantumShield requires Node >= 24 built with OpenSSL >= 3.5. Cause: ${(err as Error).message}`,
    );
  }
}
