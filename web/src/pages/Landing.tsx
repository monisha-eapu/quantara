import { useNavigate } from "react-router";
import { Logo } from "../components/Shell";
import { Btn, cx } from "../components/ui";
import { api, type Block, type EntityVerification, type RecordDetail } from "../lib/api";
import { shortHash } from "../lib/format";
import { useApi } from "../lib/hooks";

export const GHZ = `     ┌───┐           ░ ┌─┐
q_0: ┤ H ├──■────────░─┤M├──────
     └───┘┌─┴─┐      ░ └╥┘┌─┐
q_1: ─────┤ X ├──■───░──╫─┤M├───
          └───┘┌─┴─┐ ░  ║ └╥┘┌─┐
q_2: ──────────┤ X ├─░──╫──╫─┤M├
               └───┘ ░  ║  ║ └╥┘
c: 3/═══════════════════╩══╩══╩═
                        0  1  2 `;

const wrap = "mx-auto w-full max-w-[1240px] px-6 md:px-10";
const serif = "font-serif font-normal";
const REG_ID = "LAND-AP-VZM-10293";

function Receipt() {
  const r = useApi(async () => {
    const [d, v] = await Promise.all([api.get<RecordDetail>(`/records/${REG_ID}`), api.post<EntityVerification>(`/records/${REG_ID}/verify?passive=1`)]);
    return { d, v };
  });
  const d = r.data?.d, v = r.data?.v;
  const data = (d?.record.data ?? {}) as Record<string, string>;
  const ok = v ? v.verdict === "AUTHENTIC" : null;
  const when = v ? new Date(v.verifiedAt) : new Date();
  const dateStr = when.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
  const timeStr = when.toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Kolkata" });
  const row = (label: string, status: string | undefined, good: boolean) => (
    <div className="flex justify-between gap-3 border-b border-dashed border-line py-2.5 text-[14px] last:border-0"><span>{label}</span><span className={cx("font-mono", status ? (good ? "text-ok" : "text-bad") : "text-faint")}>{status ?? "…"}</span></div>
  );
  const c = (id: string) => v?.checks.find((x) => x.id === id)?.status;
  return (
    <div className="relative">
      <div className="flex flex-col gap-[22px] rounded-sm border border-line bg-card px-[34px] py-8 shadow-[0_1px_0_#e2ded4,0_24px_48px_-28px_rgba(25,25,23,0.25)]">
        <div className="flex items-start justify-between gap-4 border-b border-ink pb-4">
          <div className="flex flex-col gap-1"><span className="text-[11px] tracking-[0.14em] text-mute">VERIFICATION RECEIPT</span><span className="font-mono text-[18px] font-medium">{REG_ID}</span></div>
          <span className="text-right font-mono text-[12px] text-mute">{dateStr}<br />{timeStr} IST</span>
        </div>
        <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-[14px]">
          <span className="text-mute">Owner</span><span>{data.ownerName ?? "Ravi Kumar"}</span>
          <span className="text-mute">Survey no.</span><span>{data.surveyNumber ?? "184/2"}, {data.district ?? "Vizianagaram"}, AP</span>
          <span className="text-mute">Area</span><span>{data.area ?? "2.4 acres"} · {data.propertyType ?? "Agricultural"}</span>
          <span className="text-mute">Signed by</span><span>{d ? `${d.signer.name}, ${d.signer.organization.replace(" (fictional demo)", "")}` : "Sub-Registrar Office, Vizianagaram"}</span>
        </div>
        <div className="flex flex-col border-t border-dashed border-line">
          {row("SHA-256 fingerprint recomputed", c("hash") && (c("hash") === "pass" ? "match" : "mismatch"), c("hash") === "pass")}
          {row(`${v?.algorithm ?? "ML-DSA-65"} signature`, c("signature") && (c("signature") === "pass" ? "valid" : "invalid"), c("signature") === "pass")}
          {row(`Ledger anchor${d?.block ? `, block #${d.block.index}` : ""}`, c("anchor") && (c("anchor") === "pass" ? "found" : "mismatch"), c("anchor") === "pass")}
          {row("Hash chain to tip", c("chain") && (c("chain") === "pass" ? "intact" : "broken"), c("chain") === "pass")}
        </div>
        <span className="break-all font-mono text-[11px] text-mute">fp {d?.record.dataHash ?? "—"}</span>
      </div>
      <div className={cx("absolute -right-3 -top-[18px] -rotate-[8deg] border-2 bg-card/85 px-3.5 py-1.5 font-mono text-[13px] font-medium tracking-[0.16em]", ok === false ? "border-bad text-bad" : ok === null ? "border-faint text-faint" : "border-ok text-ok")}>
        {ok === false ? "TAMPERED" : ok === null ? "CHECKING" : "VERIFIED"}
      </div>
    </div>
  );
}

export default function Landing() {
  const nav = useNavigate();
  const chain = useApi(() => api.get<{ blocks: Block[] }>("/ledger?limit=4"));
  const blocks = [...(chain.data?.blocks ?? [])].reverse();
  const A = ({ href, children }: { href: string; children: string }) => <a href={href} className="text-body no-underline">{children}</a>;

  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-20 border-b border-line-2 bg-paper">
        <div className={cx(wrap, "flex flex-wrap items-center gap-x-10 gap-y-3 py-[18px]")}>
          <button onClick={() => nav("/")} className="flex cursor-pointer items-center gap-2.5 border-0 bg-transparent p-0"><Logo /><span className="text-[16px] font-semibold tracking-[-0.01em]">QuantumShield</span></button>
          <nav className="hidden min-w-0 flex-1 gap-7 whitespace-nowrap text-[14px] md:flex">
            <A href="#how">How it works</A><A href="#registries">Registries</A><A href="#lab">Quantum Lab</A>
            <button onClick={() => nav("/app/verify")} className="cursor-pointer border-0 bg-transparent p-0 text-[14px] text-body">Verify a record</button>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Btn variant="ghost" onClick={() => nav("/signin")}>Sign in</Btn>
            <Btn onClick={() => nav("/signup")}>Create account</Btn>
          </div>
        </div>
      </header>

      <section className={cx(wrap, "grid grid-cols-[repeat(auto-fit,minmax(min(100%,460px),1fr))] items-center gap-[72px] pb-[72px] pt-[88px]")}>
        <div className="flex flex-col gap-7">
          <span className="font-mono text-[12px] tracking-[0.06em] text-mute">POST-QUANTUM TRUST FOR CRITICAL DIGITAL RECORDS</span>
          <h1 className={cx(serif, "m-0 text-[clamp(42px,6vw,68px)] leading-[1.02] tracking-[-0.025em] [text-wrap:balance]")}>Land titles and supply chains, signed to outlast the quantum computer.</h1>
          <p className="m-0 max-w-[520px] text-[18px] leading-[1.6] text-body [text-wrap:pretty]">QuantumShield signs every land record, custody transfer and certificate with ML-DSA-65 and anchors it in an append-only ledger. Anyone can check a record from first principles.</p>
          <div className="flex flex-wrap gap-3">
            <Btn size="lg" onClick={() => nav("/signup")}>Create an account</Btn>
            <Btn size="lg" variant="outline" onClick={() => nav("/app/verify")}>Verify a record</Btn>
          </div>
        </div>
        <Receipt />
      </section>

      <div className="border-y border-line-2">
        <div className={cx(wrap, "flex flex-wrap gap-x-8 gap-y-3 py-[18px] text-[13px] text-mute")}>
          <span>Qiskit Fall Fest 2026 · Hackathon Use Case 02</span>
          <span>Centurion University of Technology and Management, Vizianagaram</span>
          <span>IBM Quantum · Qiskit Runtime</span>
        </div>
      </div>

      <section className={cx(wrap, "grid grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))] gap-14 py-[104px]")}>
        <h2 className={cx(serif, "m-0 text-[clamp(28px,3.4vw,40px)] leading-[1.15] tracking-[-0.015em] [text-wrap:balance]")}>Blockchain-based registries rely on signatures that quantum computers could forge, undermining tamper-evidence.</h2>
        <div className="flex flex-col gap-5 text-[16px] leading-[1.7] text-body">
          <p className="m-0 [text-wrap:pretty]">Land titles and provenance records have to stay trustworthy for decades. Most are signed with RSA or ECDSA, and Shor's algorithm breaks both on a large enough quantum computer. A forged signature is indistinguishable from a real one.</p>
          <p className="m-0 [text-wrap:pretty]">QuantumShield integrates PQC signatures and quantum-secured channels into distributed ledgers for land, supply-chain and certificate systems, for durable integrity of AP's land-record and provenance systems against future attacks.</p>
        </div>
      </section>

      <section id="how" className="border-y border-line-2 bg-card">
        <div className={cx(wrap, "flex flex-col gap-12 py-24")}>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <h2 className={cx(serif, "m-0 text-[clamp(28px,3.4vw,40px)] tracking-[-0.015em]")}>Sign. Anchor. Verify.</h2>
            <span className="max-w-[420px] text-[15px] text-mute">Three steps, each checkable by anyone with the record and the signer's public key.</span>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] border-t border-ink">
            {[
              ["01", "Sign", "The issuing office hashes the record with SHA-256 and signs the fingerprint with its registered ML-DSA-65 key.", "sig = ML-DSA-65.sign(sk, sha256(record))"],
              ["02", "Anchor", "The signed record becomes a block that commits to the hash of the block before it, so altering any past block is detectable.", "block[n].prev = sha256(block[n-1])"],
              ["03", "Verify", "Recompute the fingerprint, check the signature against the signer's public key, confirm the anchor and walk the chain to the tip.", "ML-DSA-65.verify(pk, fp, sig) → true"],
            ].map(([n, h, p, code], i) => (
              <div key={n} className={cx("flex flex-col gap-3.5 pt-7", i === 0 ? "pr-7" : "border-line-2 px-0 md:border-l md:px-7", i === 2 && "md:pr-0")}>
                <span className="font-mono text-[13px] text-mute">{n}</span>
                <h3 className="m-0 text-[20px] font-semibold">{h}</h3>
                <p className="m-0 text-[15px] leading-[1.65] text-body">{p}</p>
                <code className="rounded-sm bg-hov px-3 py-2.5 font-mono text-[12px]">{code}</code>
              </div>
            ))}
          </div>
          <div className="flex items-stretch overflow-x-auto py-2" aria-label="Latest ledger blocks">
            {blocks.map((b) => (
              <div key={b.index} className="flex shrink-0 items-center">
                <div className="flex w-[230px] flex-col gap-1.5 border border-line bg-paper px-4 py-3.5 font-mono text-[12px]">
                  <span className="text-[14px] font-medium">Block #{b.index}</span>
                  <span className="truncate text-mute">{b.recordId}</span>
                  <span>prev {shortHash(b.previousHash, 6)}</span>
                  <span>hash {shortHash(b.blockHash, 6)}</span>
                </div>
                <span className="h-px w-7 shrink-0 bg-ink" />
              </div>
            ))}
            <div className="flex shrink-0 items-center px-2 font-mono text-[12px] text-mute">{blocks.length ? "tip" : chain.error ? "ledger offline" : "loading…"}</div>
          </div>
        </div>
      </section>

      <section id="registries" className={cx(wrap, "flex flex-col gap-10 py-[104px]")}>
        <h2 className={cx(serif, "m-0 text-[clamp(28px,3.4vw,40px)] tracking-[-0.015em]")}>One trust layer, three registries.</h2>
        <div className="flex flex-col border-t border-ink">
          {[
            ["Revenue and land records", "Property ID, owner, survey number and area, signed by the sub-registrar. Banks and citizens can confirm a title without trusting the database it came from."],
            ["Agri and pharma provenance", "Each custody transfer, from Guntur chilli farms to a Vizianagaram pharmacy shelf, is a signed event linked to the one before it."],
            ["Certificates", "Degrees, licences and compliance certificates that cannot be back-dated or forged, today or once large quantum computers exist."],
          ].map(([h, p]) => (
            <button key={h} onClick={() => nav("/signin")} className="grid cursor-pointer grid-cols-1 items-baseline gap-2 border-0 border-b border-line-2 bg-transparent py-7 text-left hover:bg-hov md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] md:gap-8">
              <h3 className="m-0 text-[20px] font-semibold">{h}</h3>
              <p className="m-0 text-[15px] leading-[1.65] text-body">{p}</p>
              <span className="hidden text-[20px] md:block">→</span>
            </button>
          ))}
        </div>
      </section>

      <section id="lab" className="bg-ink text-paper">
        <div className={cx(wrap, "grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] items-center gap-14 py-24")}>
          <div className="flex flex-col gap-5">
            <span className="font-mono text-[12px] tracking-[0.06em] text-[#a8a59b]">QUANTUM LAB</span>
            <h2 className={cx(serif, "m-0 text-[clamp(28px,3.4vw,40px)] leading-[1.15] tracking-[-0.015em]")}>Run real circuits on IBM Quantum hardware.</h2>
            <p className="m-0 text-[16px] leading-[1.7] text-[#cfccc2] [text-wrap:pretty]">GHZ entanglement, Shor order-finding for N = 15 and a 3-qubit Grover search, submitted through Qiskit Runtime. The lab shows why classical signatures are at risk. The quantum service never receives records, signatures or keys.</p>
            <div><Btn variant="light" onClick={() => nav("/app/quantum")}>Open the lab</Btn></div>
          </div>
          <pre className="m-0 overflow-x-auto border border-[#3a3934] p-7 font-mono text-[13px] leading-[1.45]">{GHZ}</pre>
        </div>
      </section>

      <section className={cx(wrap, "flex flex-col items-start gap-7 py-28")}>
        <h2 className={cx(serif, "m-0 max-w-[820px] text-[clamp(32px,4.4vw,52px)] leading-[1.08] tracking-[-0.02em] [text-wrap:balance]")}>Start signing records that will still verify in 2050.</h2>
        <div className="flex flex-wrap gap-3"><Btn size="lg" onClick={() => nav("/signup")}>Create an account</Btn><Btn size="lg" variant="outline" onClick={() => nav("/signin")}>Sign in</Btn></div>
      </section>

      <footer className="border-t border-line-2">
        <div className={cx(wrap, "flex flex-wrap justify-between gap-4 py-7 text-[13px] text-mute")}><span>QuantumShield · Trust infrastructure</span><span>Prototype. All records are fictional demo data.</span></div>
      </footer>
    </div>
  );
}
