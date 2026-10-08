import { Factory, FlaskConical, Store, Truck, Warehouse, Building2 } from "lucide-react";
import type { ReactNode } from "react";

export const STAGES = ["MANUFACTURED", "QUALITY_CHECK", "WAREHOUSE", "TRANSPORT", "DISTRIBUTOR", "RETAILER"] as const;

export const STAGE_META: Record<string, { label: string; icon: ReactNode }> = {
  MANUFACTURED: { label: "Manufactured", icon: <Factory className="h-4 w-4" /> },
  QUALITY_CHECK: { label: "Quality Check", icon: <FlaskConical className="h-4 w-4" /> },
  WAREHOUSE: { label: "Warehouse", icon: <Warehouse className="h-4 w-4" /> },
  TRANSPORT: { label: "Transport", icon: <Truck className="h-4 w-4" /> },
  DISTRIBUTOR: { label: "Distributor", icon: <Building2 className="h-4 w-4" /> },
  RETAILER: { label: "Retailer", icon: <Store className="h-4 w-4" /> },
};
