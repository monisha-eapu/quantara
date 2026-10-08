import { useEffect, useState } from "react";
import { api } from "./api";

export interface SystemStatus {
  loaded: boolean;
  apiOnline: boolean;
  cryptoOnline: boolean;
  ledgerValid: boolean;
  alerts: number;
  quantumOnline: boolean;
  ibmConfigured: boolean;
}

const initial: SystemStatus = { loaded: false, apiOnline: true, cryptoOnline: true, ledgerValid: true, alerts: 0, quantumOnline: false, ibmConfigured: false };

/** Polls the dashboard endpoint for the live state shown in the shell (top bar and sidebar). */
export function useSystemStatus(intervalMs = 20000): SystemStatus {
  const [s, setS] = useState<SystemStatus>(initial);
  useEffect(() => {
    let alive = true;
    const load = () =>
      api.get<{ metrics: { tamperAlerts: number }; system: { cryptoEngine: { online: boolean }; ledgerIntegrity: { valid: boolean }; quantumService: { online: boolean; ibmConfigured?: boolean } } }>("/dashboard")
        .then((d) => alive && setS({ loaded: true, apiOnline: true, cryptoOnline: d.system.cryptoEngine.online, ledgerValid: d.system.ledgerIntegrity.valid, alerts: d.metrics.tamperAlerts, quantumOnline: d.system.quantumService.online, ibmConfigured: Boolean(d.system.quantumService.ibmConfigured) }))
        .catch(() => alive && setS((p) => ({ ...p, loaded: true, apiOnline: false })));
    load();
    const t = setInterval(load, intervalMs);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => { alive = false; clearInterval(t); window.removeEventListener("focus", onFocus); };
  }, [intervalMs]);
  return s;
}
