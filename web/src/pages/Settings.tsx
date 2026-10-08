import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { Btn, ErrorState, Field, Hash, InlineError, Loading, Modal, PageTitle, rowCls, TableCard, theadCls } from "../components/ui";
import { api } from "../lib/api";
import { formatDate, shortHash } from "../lib/format";
import { useAction, useApi } from "../lib/hooks";

interface CryptoInfo {
  runtime: { node: string; openssl: string };
  signers: { id: string; name: string; role: string; organization: string; algorithm: string; fingerprint: string; createdAt: string; publicKeyPem: string }[];
  hashing: { algorithm: string; signingMessage: string };
}
interface User { name: string; email: string; role: string }

function Row({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <div className="grid gap-4 border-t border-line-2 pt-6 first:border-ink md:grid-cols-[200px_1fr] md:gap-8">
      <div className="flex flex-col gap-1"><span className="text-[15px] font-semibold">{title}</span>{sub && <span className="text-[13px] text-mute">{sub}</span>}</div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
const ro = "inp !border-line-2 !bg-hov !text-mute";

export default function Settings() {
  const nav = useNavigate();
  const { data, error, loading, reload } = useApi(() => api.get<CryptoInfo>("/crypto"));
  const stored = (() => { try { return JSON.parse(localStorage.getItem("qs-user") || "null") as Partial<User> | null; } catch { return null; } })();
  const [user, setUser] = useState<User>({ name: stored?.name ?? "Ravi Kumar", email: stored?.email ?? "ravi.kumar@sro-vzm.ap.gov.in", role: stored?.role ?? "Registry officer" });
  const [saved, setSaved] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const reset = useAction(async () => { await api.post("/admin/reset"); window.location.assign("/app"); });

  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorState error={error ?? new Error("No data")} onRetry={reload} />;
  const key = data.signers.find((s) => s.id === "revenue-ap")!;
  const download = () => {
    const url = URL.createObjectURL(new Blob([key.publicKeyPem], { type: "application/x-pem-file" }));
    const a = document.createElement("a"); a.href = url; a.download = `${key.id}-ml-dsa-65-public.pem`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="flex max-w-[900px] flex-col gap-8">
      <PageTitle title="Settings" sub="Profile, signing key and demo data." />

      <Row title="Profile" sub="Shown in the account menu. Stored in this browser only.">
        <form className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5" onSubmit={(e) => { e.preventDefault(); localStorage.setItem("qs-user", JSON.stringify(user)); setSaved(true); setTimeout(() => setSaved(false), 1800); }}>
          <Field label="Full name"><input className="inp" value={user.name} onChange={(e) => setUser({ ...user, name: e.target.value })} /></Field>
          <Field label="Work email"><input className="inp" value={user.email} onChange={(e) => setUser({ ...user, email: e.target.value })} /></Field>
          <Field label="Role"><input className={ro} value={user.role} disabled /></Field>
          <Field label="Organisation"><input className={ro} value="Sub-Registrar Office, Vizianagaram" disabled /></Field>
          <div className="col-span-full flex items-center gap-3"><Btn type="submit" size="sm">Save profile</Btn>{saved && <span className="text-[13px] text-ok">Saved</span>}</div>
        </form>
      </Row>

      <Row title="Signing key" sub="Used to sign land records created in this workspace.">
        <div className="rounded border border-line bg-card">
          {[
            ["Algorithm", `${key.algorithm} (FIPS 204)`],
            ["Signer", `${key.name}, ${key.organization.replace(" (fictional demo)", "")}`],
            ["Key fingerprint", <Hash key="f" value={key.fingerprint} n={8} className="text-[13px]" />],
            ["Registered", formatDate(key.createdAt)],
            ["Private key storage", "Server-side key file (prototype). Production: HSM or cloud KMS."],
          ].map(([k, v]) => <div key={k as string} className="flex justify-between gap-4 border-b border-line-3 px-[18px] py-3 text-[14px]"><span className="text-mute">{k}</span><span className="text-right">{v}</span></div>)}
          <div className="flex flex-wrap items-center gap-2.5 px-[18px] py-3.5">
            <Btn variant="outline" size="sm" onClick={download}>Download public key</Btn>
            <Btn variant="outline" size="sm" disabled title="Not implemented in the prototype">Rotate key</Btn>
            <span className="text-[12px] text-mute">Key rotation and revocation are production features.</span>
          </div>
        </div>
        <p className="mb-0 mt-3 text-[12px] leading-relaxed text-mute">Runtime: Node.js {data.runtime.node} · OpenSSL {data.runtime.openssl} · content hash {data.hashing.algorithm}. Private keys never leave the server and are never sent to the browser.</p>
      </Row>

      <Row title="Signer registry" sub="Public keys only.">
        <TableCard min={640}>
          <thead className={theadCls}><tr><th className="th">Signer</th><th className="th">Role</th><th className="th">Algorithm</th><th className="th">Fingerprint</th></tr></thead>
          <tbody>{data.signers.map((s) => (
            <tr key={s.id} className={rowCls}>
              <td className="td"><div className="flex flex-col"><span>{s.name}</span><span className="text-[12px] text-mute">{s.organization.replace(/ \(fictional( demo)?\)/, "")}</span></div></td>
              <td className="td font-mono text-[12px] text-mute">{s.role}</td><td className="td">{s.algorithm}</td><td className="td font-mono text-[12px]">{shortHash(s.fingerprint, 8)}</td>
            </tr>
          ))}</tbody>
        </TableCard>
      </Row>

      <Row title="Notifications" sub="Email alerts for your district.">
        <div className="flex flex-col gap-3.5 text-[14px] opacity-60">
          {["Integrity violations", "Daily integrity scan summary", "Every new block in my district"].map((l) => <label key={l} className="flex items-center gap-2.5"><input type="checkbox" disabled className="h-4 w-4 accent-ink" />{l}</label>)}
        </div>
        <p className="mb-0 mt-3 text-[12px] text-mute">Email delivery is not connected in this prototype.</p>
      </Row>

      <Row title="Demo data" sub="All records are fictional.">
        <Btn variant="danger" onClick={() => setConfirm(true)}>Reset demo data</Btn>
        <p className="mb-0 mt-3 text-[12px] text-mute">Deletes all records, ledger blocks and audit entries and re-seeds the dataset. Signer keys are kept.</p>
      </Row>

      <Row title="Session"><Btn variant="danger" onClick={() => { localStorage.removeItem("qs-user"); nav("/signin"); }}>Sign out</Btn></Row>

      <Modal open={confirm} onClose={() => setConfirm(false)} title="Reset demo data?" subtitle="This takes a few seconds."
        footer={<><Btn variant="outline" onClick={() => setConfirm(false)}>Cancel</Btn><Btn loading={reset.pending} onClick={() => reset.run()}>Reset and re-seed</Btn></>}>
        <p className="m-0 text-[14px] leading-relaxed text-body">All current records, tamper simulations, migrations and audit entries will be replaced with the original fictional dataset (2,481 signed entities).</p>
        <div className="mt-3"><InlineError error={reset.error} /></div>
      </Modal>
    </div>
  );
}
