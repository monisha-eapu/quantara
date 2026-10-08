import { config } from "./config.js";
import { db, transaction } from "./db.js";
import { ensureSigners } from "./crypto/keystore.js";
import { logAudit } from "./services/audit.js";
import { runIntegrityScan } from "./services/integrity.js";
import { createLandRecord, landRecordId, type LandRecordInput } from "./services/land.js";
import { ensureGenesis } from "./services/ledger.js";
import { tamperRecord } from "./services/records.js";
import { addEvent, createProduct, type EventType } from "./services/supplyChain.js";

/*
 * ALL DEMO DATA IS FICTIONAL. Names, survey numbers, property IDs, companies and batches are
 * invented for demonstration and do not correspond to real people, parcels or products.
 */

const DAY = 864e5;
const HOUR = 36e5;

const AUTHORITY: Record<string, { authority: string; signerId: string }> = {
  "Andhra Pradesh": { authority: "Revenue Department", signerId: "revenue-ap" },
  Telangana: { authority: "Registration & Stamps Department", signerId: "subregistrar-ts" },
  Karnataka: { authority: "Survey Settlement & Land Records", signerId: "land-registry-ka" },
};

export const DEMO_RECORD_ID = "LAND-AP-VZM-10293";

const FEATURED: LandRecordInput[] = [
  { propertyId: "AP-VZM-10293", ownerName: "Ravi Kumar", surveyNumber: "184/2", district: "Vizianagaram", state: "Andhra Pradesh", area: "2.4 acres", propertyType: "Agricultural", registrationDate: "2021-03-15", status: "Active", issuingAuthority: "Revenue Department", signerId: "revenue-ap" },
  { propertyId: "AP-VSP-20417", ownerName: "Lakshmi Devi Peddireddy", surveyNumber: "77/1A", district: "Visakhapatnam", state: "Andhra Pradesh", area: "1,200 sq.yd", propertyType: "Residential", registrationDate: "2018-11-02", status: "Active", issuingAuthority: "Revenue Department", signerId: "revenue-ap" },
  { propertyId: "AP-GNT-31108", ownerName: "Venkata Subba Rao Kolli", surveyNumber: "312/4", district: "Guntur", state: "Andhra Pradesh", area: "5.75 acres", propertyType: "Agricultural", registrationDate: "2016-06-21", status: "Mortgaged", issuingAuthority: "Revenue Department", signerId: "revenue-ap" },
  { propertyId: "AP-SKL-11852", ownerName: "Padmavathi Tummala", surveyNumber: "45/3B", district: "Srikakulam", state: "Andhra Pradesh", area: "3.1 acres", propertyType: "Agricultural", registrationDate: "2020-01-09", status: "Active", issuingAuthority: "Revenue Department", signerId: "revenue-ap" },
  { propertyId: "TS-HYD-40921", ownerName: "Mohammed Irfan Siddiqui", surveyNumber: "1123/A", district: "Hyderabad", state: "Telangana", area: "450 sq.yd", propertyType: "Commercial", registrationDate: "2019-08-30", status: "Active", issuingAuthority: "Registration & Stamps Department", signerId: "subregistrar-ts" },
  { propertyId: "TS-WGL-22310", ownerName: "Sravanthi Reddy Gaddam", surveyNumber: "9/12", district: "Warangal", state: "Telangana", area: "1.8 acres", propertyType: "Agricultural", registrationDate: "2017-04-14", status: "Under Dispute", issuingAuthority: "Registration & Stamps Department", signerId: "subregistrar-ts" },
  { propertyId: "KA-MYS-50114", ownerName: "Shivakumar Gowda", surveyNumber: "221/7", district: "Mysuru", state: "Karnataka", area: "2,400 sq.ft", propertyType: "Residential", registrationDate: "2022-02-11", status: "Active", issuingAuthority: "Survey Settlement & Land Records", signerId: "land-registry-ka" },
  { propertyId: "AP-KRS-17765", ownerName: "Anjali Bandaru", surveyNumber: "66/2C", district: "Krishna", state: "Andhra Pradesh", area: "0.9 acres", propertyType: "Industrial", registrationDate: "2023-05-26", status: "Active", issuingAuthority: "Revenue Department", signerId: "revenue-ap" },
  { propertyId: "AP-EGD-26031", ownerName: "Suresh Babu Chintalapudi", surveyNumber: "508/1", district: "East Godavari", state: "Andhra Pradesh", area: "12.0 acres", propertyType: "Agricultural", registrationDate: "2015-09-18", status: "Transferred", issuingAuthority: "Revenue Department", signerId: "revenue-ap" },
  { propertyId: "KA-DWD-30872", ownerName: "Fatima Begum Shaikh", surveyNumber: "14/5", district: "Dharwad", state: "Karnataka", area: "3,000 sq.ft", propertyType: "Commercial", registrationDate: "2021-12-03", status: "Active", issuingAuthority: "Survey Settlement & Land Records", signerId: "land-registry-ka" },
];

const LEGACY: LandRecordInput[] = [
  { propertyId: "AP-VZM-00412", ownerName: "Appala Naidu Kandregula", surveyNumber: "92/1", district: "Vizianagaram", state: "Andhra Pradesh", area: "4.2 acres", propertyType: "Agricultural", registrationDate: "2009-07-12", status: "Active", issuingAuthority: "Revenue Department (digitised 2019)", signerId: "legacy-ca" },
  { propertyId: "AP-GNT-00977", ownerName: "Nagamani Vemuri", surveyNumber: "301/6", district: "Guntur", state: "Andhra Pradesh", area: "800 sq.yd", propertyType: "Residential", registrationDate: "2011-02-28", status: "Active", issuingAuthority: "Revenue Department (digitised 2019)", signerId: "legacy-ca" },
  { propertyId: "TS-NLG-00153", ownerName: "Yadagiri Rao Bollam", surveyNumber: "17/4A", district: "Nalgonda", state: "Telangana", area: "6.5 acres", propertyType: "Agricultural", registrationDate: "2006-10-05", status: "Mortgaged", issuingAuthority: "Registration & Stamps Department (digitised 2019)", signerId: "legacy-ca" },
];

interface ProductSeed {
  product: { productId: string; productName: string; batchId: string; manufacturer: string; origin: string; certification: string; category: string; initialLocation: string };
  startDaysAgo: number;
  firstMeta: Record<string, string>;
  events: { type: EventType; afterHours: number; location: string; custodian: string; metadata: Record<string, string> }[];
}

const PRODUCTS: ProductSeed[] = [
  {
    product: { productId: "PRD-OPI-4410", productName: "Organic Pharmaceutical Ingredient", batchId: "PHARMA-BT-9921", manufacturer: "Example Pharma Ltd.", origin: "Andhra Pradesh", certification: "WHO-GMP · Organic (demo)", category: "Pharmaceutical", initialLocation: "Example Pharma Ltd. Plant, Visakhapatnam" },
    startDaysAgo: 9,
    firstMeta: { quantity: "500 kg", notes: "Batch manufactured and sealed" },
    events: [
      { type: "QUALITY_CHECK", afterHours: 20, location: "Accredited QC Laboratory, Hyderabad", custodian: "Example Pharma Ltd.", metadata: { qcResult: "PASSED", assay: "99.4%", certificateNo: "QC-2026-08812" } },
      { type: "WAREHOUSE", afterHours: 44, location: "Bonded Warehouse, Visakhapatnam", custodian: "Coastal Bonded Warehousing", metadata: { storage: "15–25 °C", bay: "B-14" } },
      { type: "TRANSPORT", afterHours: 70, location: "NH-16 Visakhapatnam → Vijayawada", custodian: "Deccan Cold-Chain Logistics", metadata: { vehicle: "AP-31-TX-4471", temperature: "18 °C avg" } },
      { type: "DISTRIBUTOR", afterHours: 96, location: "Southern Medical Distributors, Vijayawada", custodian: "Southern Medical Distributors", metadata: { invoice: "SMD-INV-77120" } },
      { type: "RETAILER", afterHours: 140, location: "CityCare Pharmacy, Vizianagaram", custodian: "CityCare Pharmacy", metadata: { shelfLot: "CC-VZM-0091" } },
    ],
  },
  {
    product: { productId: "PRD-ARK-2210", productName: "Araku Valley Arabica Coffee (Green Beans)", batchId: "COFFEE-AR-5530", manufacturer: "Araku Tribal Farmers Cooperative", origin: "Araku Valley, Andhra Pradesh", certification: "GI-tagged origin · Organic (demo)", category: "Agri-produce", initialLocation: "Cooperative Pulping Unit, Araku Valley" },
    startDaysAgo: 24,
    firstMeta: { quantity: "2,400 kg", harvest: "2025–26 main crop" },
    events: [
      { type: "QUALITY_CHECK", afterHours: 30, location: "Coffee Quality Lab, Visakhapatnam", custodian: "Araku Tribal Farmers Cooperative", metadata: { qcResult: "PASSED", grade: "AA", moisture: "11.2%" } },
      { type: "WAREHOUSE", afterHours: 60, location: "Bonded Warehouse, Visakhapatnam", custodian: "Coastal Bonded Warehousing", metadata: { storage: "Ambient, 60% RH", bay: "C-03" } },
      { type: "TRANSPORT", afterHours: 120, location: "Visakhapatnam → Chennai", custodian: "Deccan Cold-Chain Logistics", metadata: { vehicle: "AP-39-TB-1180" } },
      { type: "TRANSPORT", afterHours: 150, location: "Chennai → Bengaluru", custodian: "Deccan Cold-Chain Logistics", metadata: { vehicle: "TN-09-CX-7731" } },
      { type: "DISTRIBUTOR", afterHours: 180, location: "Southern Specialty Foods, Bengaluru", custodian: "Southern Specialty Foods", metadata: { invoice: "SSF-55102" } },
      { type: "RETAILER", afterHours: 230, location: "Roastery Café, Indiranagar, Bengaluru", custodian: "Roastery Café (fictional)", metadata: { roastDate: "On arrival" } },
    ],
  },
  {
    product: { productId: "PRD-GSC-0874", productName: "Guntur Sannam Chilli (S4)", batchId: "CHILLI-GT-8812", manufacturer: "Guntur Spice Growers FPO", origin: "Guntur, Andhra Pradesh", certification: "AGMARK grade (demo)", category: "Agri-produce", initialLocation: "FPO Collection Centre, Guntur" },
    startDaysAgo: 16,
    firstMeta: { quantity: "8,000 kg", lots: "32 bags × 250 kg" },
    events: [
      { type: "QUALITY_CHECK", afterHours: 18, location: "Spice Testing Laboratory, Guntur", custodian: "Guntur Spice Growers FPO", metadata: { qcResult: "PASSED", aflatoxin: "Below limit", pungency: "35,000 SHU" } },
      { type: "WAREHOUSE", afterHours: 40, location: "Cold Storage Unit 7, Guntur", custodian: "Coastal Bonded Warehousing", metadata: { storage: "4 °C cold store" } },
      { type: "TRANSPORT", afterHours: 200, location: "Guntur → Hyderabad", custodian: "Deccan Cold-Chain Logistics", metadata: { vehicle: "AP-07-TU-3302" } },
      { type: "DISTRIBUTOR", afterHours: 230, location: "Deccan Wholesale Spices, Hyderabad", custodian: "Deccan Wholesale Spices", metadata: { invoice: "DWS-90417" } },
    ],
  },
  {
    product: { productId: "PRD-INS-3301", productName: "Insulin Cartridges (Cold-chain)", batchId: "VACC-CD-3340", manufacturer: "Example Biologics Ltd.", origin: "Genome Valley, Hyderabad, Telangana", category: "Pharmaceutical", certification: "Licensed biologic (demo)", initialLocation: "Example Biologics Fill-Finish Unit, Hyderabad" },
    startDaysAgo: 4,
    firstMeta: { quantity: "12,000 cartridges", storage: "2–8 °C" },
    events: [
      { type: "QUALITY_CHECK", afterHours: 12, location: "Accredited QC Laboratory, Hyderabad", custodian: "Example Biologics Ltd.", metadata: { qcResult: "PASSED", sterility: "Pass", certificateNo: "QC-2026-09140" } },
      { type: "WAREHOUSE", afterHours: 30, location: "GDP Cold Room, Shamshabad", custodian: "Coastal Bonded Warehousing", metadata: { storage: "2–8 °C", dataLogger: "DL-55821" } },
      { type: "TRANSPORT", afterHours: 60, location: "Hyderabad → Vijayawada (reefer)", custodian: "Deccan Cold-Chain Logistics", metadata: { vehicle: "TS-08-RF-2204", temperature: "5.1 °C avg" } },
    ],
  },
  {
    product: { productId: "PRD-TUR-1187", productName: "Organic Turmeric Powder", batchId: "TURMERIC-NZ-2219", manufacturer: "Nizamabad Organic Farmers Collective", origin: "Nizamabad, Telangana", certification: "Organic certified (demo)", category: "Agri-produce", initialLocation: "Collective Processing Unit, Nizamabad" },
    startDaysAgo: 12,
    firstMeta: { quantity: "1,500 kg", curcumin: "4.8%" },
    events: [
      { type: "QUALITY_CHECK", afterHours: 26, location: "Food Testing Laboratory, Hyderabad", custodian: "Nizamabad Organic Farmers Collective", metadata: { qcResult: "PASSED", leadContent: "Not detected" } },
      { type: "WAREHOUSE", afterHours: 50, location: "Agri Warehouse, Nizamabad", custodian: "Coastal Bonded Warehousing", metadata: { storage: "Dry, ambient" } },
      { type: "TRANSPORT", afterHours: 100, location: "Nizamabad → Hyderabad", custodian: "Deccan Cold-Chain Logistics", metadata: { vehicle: "TS-16-TA-6610" } },
    ],
  },
];

// Deterministic PRNG so every reset produces the same fictional dataset.
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ["Ramesh", "Sita", "Venkatesh", "Lakshmi", "Srinivas", "Padma", "Narayana", "Anitha", "Prasad", "Kavitha", "Suresh", "Bhavani", "Raghu", "Swathi", "Mahesh", "Durga", "Kiran", "Jyothi", "Ravi", "Manjula", "Gopal", "Sunitha", "Harish", "Radha", "Anil", "Vijaya", "Chandra", "Rekha", "Murali", "Saraswathi", "Imran", "Ayesha", "Joseph", "Mary", "Basavaraj", "Shobha", "Nagaraju", "Pushpa", "Yusuf", "Deepika"];
const LAST = ["Reddy", "Naidu", "Rao", "Varma", "Chowdary", "Goud", "Sharma", "Kumar", "Prasad", "Murthy", "Yadav", "Raju", "Setty", "Patnaik", "Gowda", "Hegde", "Khan", "Begum", "Babu", "Pillai", "Nair", "Achari", "Shetty", "Patil", "Kulkarni", "Desai", "Mudiraj", "Kamma", "Bhat", "Joshi"];
const DISTRICTS: { state: string; district: string; code: string }[] = [
  ...[["Vizianagaram", "VZM"], ["Visakhapatnam", "VSP"], ["Srikakulam", "SKL"], ["Guntur", "GNT"], ["Krishna", "KRS"], ["East Godavari", "EGD"], ["Nellore", "NLR"], ["Kurnool", "KNL"], ["Anantapur", "ATP"], ["Chittoor", "CTR"]].map(([district, code]) => ({ state: "Andhra Pradesh", district, code: `AP-${code}` })),
  ...[["Hyderabad", "HYD"], ["Warangal", "WGL"], ["Karimnagar", "KRM"], ["Nalgonda", "NLG"], ["Khammam", "KMM"]].map(([district, code]) => ({ state: "Telangana", district, code: `TS-${code}` })),
  ...[["Mysuru", "MYS"], ["Belagavi", "BGM"], ["Dharwad", "DWD"], ["Tumakuru", "TMK"]].map(([district, code]) => ({ state: "Karnataka", district, code: `KA-${code}` })),
];

function bulkLandRecord(rand: () => number, used: Set<string>): LandRecordInput {
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const loc = pick(DISTRICTS);
  let propertyId: string;
  do { propertyId = `${loc.code}-${10000 + Math.floor(rand() * 89999)}`; } while (used.has(propertyId));
  used.add(propertyId);
  const r = rand();
  const propertyType = r < 0.58 ? "Agricultural" : r < 0.82 ? "Residential" : r < 0.94 ? "Commercial" : "Industrial";
  const area = propertyType === "Agricultural" || propertyType === "Industrial"
    ? `${(0.3 + rand() * 14).toFixed(1)} acres`
    : propertyType === "Residential" ? `${150 + Math.floor(rand() * 1050)} sq.yd` : `${(800 + Math.floor(rand() * 5200)).toLocaleString("en-IN")} sq.ft`;
  const s = rand();
  const status = s < 0.8 ? "Active" : s < 0.9 ? "Mortgaged" : s < 0.94 ? "Under Dispute" : "Transferred";
  const year = 1995 + Math.floor(rand() * 31);
  const date = `${year}-${String(1 + Math.floor(rand() * 12)).padStart(2, "0")}-${String(1 + Math.floor(rand() * 28)).padStart(2, "0")}`;
  const sub = rand() < 0.3 ? String.fromCharCode(65 + Math.floor(rand() * 4)) : "";
  const { authority, signerId } = AUTHORITY[loc.state];
  return {
    propertyId, ownerName: `${pick(FIRST)} ${pick(LAST)}`, surveyNumber: `${1 + Math.floor(rand() * 998)}/${1 + Math.floor(rand() * 9)}${sub}`,
    district: loc.district, state: loc.state, area, propertyType, registrationDate: date, status, issuingAuthority: authority, signerId,
  };
}

export function clearDemoData(): void {
  transaction(() => {
    db.exec("DELETE FROM supply_chain_events; DELETE FROM ledger_blocks; DELETE FROM records; DELETE FROM audit_logs; DELETE FROM system_state;");
  });
}

export function seedDemoData(log: (msg: string) => void = console.log): void {
  const started = performance.now();
  ensureSigners();
  const now = Date.now();
  const iso = (ms: number) => new Date(ms).toISOString();
  const rand = mulberry32(20261008);
  const used = new Set([...FEATURED, ...LEGACY].map((r) => r.propertyId));

  const productEvents = PRODUCTS.reduce((n, p) => n + 1 + 1 + p.events.length, 0); // product + MANUFACTURED + rest
  const bulkCount = Math.max(0, config.seedTargetTotal - FEATURED.length - LEGACY.length - productEvents);

  type Op = { at: number; run: () => void };
  const ops: Op[] = [];
  const genesisAt = now - 700 * DAY;

  LEGACY.forEach((r, i) => ops.push({ at: genesisAt + DAY + i * HOUR, run: () => createLandRecord(r, { timestamp: iso(genesisAt + DAY + i * HOUR), actor: "Legacy import (2019 archive)", allowLegacy: true }) }));

  const bulkStart = now - 690 * DAY, bulkEnd = now - 30 * DAY;
  for (let i = 0; i < bulkCount; i++) {
    const at = bulkStart + ((bulkEnd - bulkStart) * (i + rand() * 0.9)) / bulkCount;
    const rec = bulkLandRecord(rand, used);
    ops.push({ at, run: () => createLandRecord(rec, { timestamp: iso(at) }) });
  }

  for (const p of PRODUCTS) {
    const t0 = now - p.startDaysAgo * DAY;
    ops.push({ at: t0, run: () => createProduct(p.product, { timestamp: iso(t0), metadata: p.firstMeta }) });
    for (const e of p.events) {
      const at = t0 + e.afterHours * HOUR;
      ops.push({ at, run: () => addEvent(p.product.batchId, { eventType: e.type, location: e.location, custodian: e.custodian, metadata: e.metadata }, { timestamp: iso(at) }) });
    }
  }

  // Featured records are the newest so they lead the dashboard; the demo record is the most recent.
  [...FEATURED].reverse().forEach((r, i) => {
    const at = now - (2 * HOUR + i * 13 * HOUR);
    ops.push({ at, run: () => createLandRecord(r, { featured: true, timestamp: iso(at) }) });
  });

  ops.sort((a, b) => a.at - b.at);
  transaction(() => {
    ensureGenesis(iso(genesisAt));
    for (const op of ops) op.run();
  });
  log(`  signed & anchored ${config.seedTargetTotal - Math.max(0, config.seedTargetTotal - FEATURED.length - LEGACY.length - productEvents - bulkCount)} entities in ${Math.round(performance.now() - started)} ms`);

  // Seeded red-team scenario: a few historical records edited directly in the database.
  const victims = (db.prepare("SELECT id, data FROM records WHERE record_type = 'LAND_RECORD' AND featured = 0 AND algorithm = 'ML-DSA-65' ORDER BY created_at DESC LIMIT 4 OFFSET 40").all() as { id: string; data: string }[]);
  const forged = ["Raj Kumar Varma", "Suresh Reddy", "Anil Goud", "Kiran Naidu"];
  victims.forEach((v, i) => {
    const data = JSON.parse(v.data) as { ownerName: string; area: string };
    if (i % 2 === 0) tamperRecord(v.id, { field: "ownerName", value: forged[i], mode: "FIELD_ONLY" }, "Red-team exercise (seeded)");
    else tamperRecord(v.id, { field: "area", value: data.area.replace(/^[\d.,]+/, (n) => String(Number(n.replace(/,/g, "")) * 3)), mode: "FIELD_AND_HASH" }, "Red-team exercise (seeded)");
  });
  logAudit({ actor: "System", action: "SEED_DEMO_DATA", result: "INFO", details: `Fictional demo dataset created: ${ops.length} signed entities` });
  const scan = runIntegrityScan();
  log(`  integrity scan: ${scan.verified} verified · ${scan.tampered} tampered · ${scan.legacy} legacy · ledger ${scan.chainValid ? "intact" : "BROKEN"} (${scan.durationMs} ms)`);
}

export function isSeeded(): boolean {
  return (db.prepare("SELECT COUNT(*) AS n FROM records").get() as { n: number }).n > 0;
}

export { landRecordId };
