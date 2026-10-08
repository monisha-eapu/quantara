import { clearDemoData, seedDemoData } from "./seed.js";
import { assertPqcAvailable } from "./crypto/schemes.js";

assertPqcAvailable();
console.log("Resetting QuantumShield demo data…");
clearDemoData();
seedDemoData();
console.log("Done.");
