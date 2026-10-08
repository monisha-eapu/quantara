import { useState } from "react";
import { useNavigate } from "react-router";
import { Logo } from "../components/Shell";
import { Btn, cx, Field } from "../components/ui";
import { api } from "../lib/api";
import { useApi } from "../lib/hooks";

const ROLES = [["Registry officer", "Create and sign land records"], ["Supply-chain partner", "Record custody transfers"], ["Auditor", "Read-only, run integrity scans"], ["Verifier", "Banks, courts, citizens"]] as const;
const link = "cursor-pointer text-ink underline decoration-line-4 underline-offset-[3px] hover:decoration-ink";

/**
 * The prototype has no identity provider: these screens do not authenticate anyone.
 * Submitting just opens the workspace and remembers the display name locally.
 */
export default function Auth({ mode }: { mode: "signin" | "signup" | "forgot" }) {
  const nav = useNavigate();
  const [role, setRole] = useState(0);
  const [name, setName] = useState("");
  const [remember, setRemember] = useState(true);
  const dash = useApi(() => api.get<{ metrics: { totalRecords: number }; ledger: { tipIndex: number }; lastScan: { signaturesVerified: number; durationMs: number } | null }>("/dashboard"));
  const enter = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (mode === "signup") localStorage.setItem("qs-user", JSON.stringify({ name: name || "New user", role: ROLES[role][0] }));
    nav("/app");
  };
  const d = dash.data;
  const inputCls = "inp !px-3.5 !py-3 !text-[15px] min-w-0";

  return (
    <div className="grid min-h-screen grid-cols-[repeat(auto-fit,minmax(min(100%,480px),1fr))] bg-paper">
      <div className="flex flex-col gap-8 px-6 py-8 md:px-12">
        <button onClick={() => nav("/")} className="flex w-fit cursor-pointer items-center gap-2.5 border-0 bg-transparent p-0"><Logo /><span className="text-[16px] font-semibold">QuantumShield</span></button>
        <div className="flex flex-1 items-center justify-center">
          <form onSubmit={enter} className="flex w-full max-w-[400px] flex-col gap-7">
            {mode === "signin" && (<>
              <div className="flex flex-col gap-2.5"><h1 className="m-0 font-serif text-[40px] font-normal tracking-[-0.02em]">Sign in</h1><p className="m-0 text-[15px] text-mute">Access your organisation's registry workspace.</p></div>
              <div className="flex flex-col gap-[18px]">
                <Field label="Work email"><input type="email" className={inputCls} placeholder="you@registration.ap.gov.in" /></Field>
                <label className="flex flex-col gap-1.5 text-[13px] font-medium">
                  <span className="flex justify-between"><span>Password</span><button type="button" onClick={() => nav("/forgot")} className="cursor-pointer border-0 bg-transparent p-0 text-[13px] font-normal text-mute underline underline-offset-[3px]">Forgot password?</button></span>
                  <input type="password" className={inputCls} placeholder="••••••••••" />
                </label>
                <label className="flex cursor-pointer items-center gap-2.5 text-[14px] text-body"><input type="checkbox" checked={remember} onChange={() => setRemember(!remember)} className="h-4 w-4 accent-ink" />Keep me signed in on this device</label>
                <Btn type="submit" size="lg" className="mt-1.5">Sign in</Btn>
                <div className="flex items-center gap-3 text-[12px] text-faint"><span className="h-px flex-1 bg-line-2" />or<span className="h-px flex-1 bg-line-2" /></div>
                <Btn type="button" variant="outline" size="lg" className="!border-line !bg-card" onClick={() => enter()}>Continue with organisation SSO</Btn>
              </div>
              <p className="m-0 text-[14px] text-mute">New to QuantumShield? <button type="button" onClick={() => nav("/signup")} className={cx(link, "border-0 bg-transparent p-0 text-[14px]")}>Create an account</button></p>
            </>)}
            {mode === "signup" && (<>
              <div className="flex flex-col gap-2.5"><h1 className="m-0 font-serif text-[40px] font-normal tracking-[-0.02em]">Create an account</h1><p className="m-0 text-[15px] text-mute">Your organisation admin approves new members before signing keys are issued.</p></div>
              <div className="flex flex-col gap-[18px]">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Full name"><input className={inputCls} placeholder="Ravi Kumar" value={name} onChange={(e) => setName(e.target.value)} /></Field>
                  <Field label="Organisation"><input className={inputCls} placeholder="SRO Vizianagaram" /></Field>
                </div>
                <Field label="Work email"><input type="email" className={inputCls} placeholder="you@organisation.in" /></Field>
                <div className="flex flex-col gap-2 text-[13px] font-medium">
                  <span>Role</span>
                  <div className="grid grid-cols-2 gap-2">
                    {ROLES.map(([l, s], i) => (
                      <button type="button" key={l} onClick={() => setRole(i)} className={cx("flex cursor-pointer flex-col gap-0.5 rounded border p-3 text-left", role === i ? "border-ink bg-card" : "border-line bg-transparent")}>
                        <span className="text-[14px] font-medium">{l}</span><span className="text-[12px] font-normal text-mute">{s}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <Field label="Password"><input type="password" className={inputCls} placeholder="At least 12 characters" /></Field>
                <label className="flex cursor-pointer items-start gap-2.5 text-[14px] leading-normal text-body"><input type="checkbox" className="mt-[3px] h-4 w-4 accent-ink" />I agree to the terms of use and the registry data-handling policy.</label>
                <Btn type="submit" size="lg">Create account</Btn>
              </div>
              <p className="m-0 text-[14px] text-mute">Already have an account? <button type="button" onClick={() => nav("/signin")} className={cx(link, "border-0 bg-transparent p-0 text-[14px]")}>Sign in</button></p>
            </>)}
            {mode === "forgot" && (<>
              <div className="flex flex-col gap-2.5"><h1 className="m-0 font-serif text-[40px] font-normal tracking-[-0.02em]">Reset password</h1><p className="m-0 text-[15px] text-mute">We'll email a reset link. Signing keys are not affected.</p></div>
              <Field label="Work email"><input type="email" className={inputCls} placeholder="you@organisation.in" /></Field>
              <Btn type="button" size="lg" onClick={() => nav("/signin")}>Send reset link</Btn>
              <p className="m-0 text-[14px] text-mute"><button type="button" onClick={() => nav("/signin")} className={cx(link, "border-0 bg-transparent p-0 text-[14px]")}>Back to sign in</button></p>
            </>)}
            <p className="m-0 border-t border-line-2 pt-4 text-[12px] leading-relaxed text-mute">Demo environment: this prototype has no identity provider, so any entry opens the workspace.</p>
          </form>
        </div>
        <span className="text-[12px] text-faint">Prototype · all records are fictional demo data</span>
      </div>
      <div className="flex flex-col justify-between gap-10 bg-ink p-12 text-paper">
        <span className="font-mono text-[12px] tracking-[0.06em] text-[#a8a59b]">LEDGER TIP · BLOCK #{d?.ledger.tipIndex ?? "—"}</span>
        <div className="flex max-w-[520px] flex-col gap-6">
          <p className="m-0 font-serif text-[clamp(24px,2.6vw,34px)] leading-[1.25] tracking-[-0.01em]">The hash chain makes history tamper-evident. The ML-DSA signature on every block is what keeps it trustworthy in the quantum era.</p>
          <div className="flex flex-col border-t border-[#3a3934] font-mono text-[13px]">
            {[["Protected records", d ? d.metrics.totalRecords.toLocaleString("en-US") : "—"], ["Signature scheme", "ML-DSA-65 · FIPS 204"], ["Last full scan", d?.lastScan ? `${d.lastScan.signaturesVerified.toLocaleString("en-US")} checks · ${d.lastScan.durationMs} ms` : "—"]].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-[#3a3934] py-3"><span className="text-[#a8a59b]">{k}</span><span>{v}</span></div>
            ))}
          </div>
        </div>
        <span className="text-[13px] text-[#a8a59b]">Qiskit Fall Fest 2026 · Centurion University, Vizianagaram</span>
      </div>
    </div>
  );
}
