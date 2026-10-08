export const STAGES = ["MANUFACTURED", "QUALITY_CHECK", "WAREHOUSE", "TRANSPORT", "DISTRIBUTOR", "RETAILER"] as const;

export const STAGE_LABEL: Record<string, string> = {
  MANUFACTURED: "Manufactured",
  QUALITY_CHECK: "Quality check",
  WAREHOUSE: "Warehouse",
  TRANSPORT: "Transport",
  DISTRIBUTOR: "Distributor",
  RETAILER: "Retailer",
};
