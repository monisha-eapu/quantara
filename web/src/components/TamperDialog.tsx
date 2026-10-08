import { useState } from "react";
import { fieldLabel } from "../lib/format";
import { Btn, cx, Field, InlineError, Modal } from "./ui";

export type TamperMode = "FIELD_ONLY" | "FIELD_AND_HASH";

export function TamperDialog({ open, onClose, data, fields, onSubmit, pending, error, allowModes = true, defaultField, suggest }: {
  open: boolean; onClose: () => void; data: Record<string, unknown>; fields: string[];
  onSubmit: (input: { field: string; value: string; mode: TamperMode }) => void;
  pending: boolean; error: Error | null; allowModes?: boolean; defaultField?: string; suggest?: (field: string, current: string) => string;
}) {
  const initialField = defaultField && fields.includes(defaultField) ? defaultField : fields[0];
  const current = (f: string) => (f.startsWith("metadata.") ? String((data.metadata as Record<string, unknown> | undefined)?.[f.slice(9)] ?? "") : String(data[f] ?? ""));
  const [field, setField] = useState(initialField);
  const [value, setValue] = useState(() => suggest?.(initialField, current(initialField)) ?? "");
  const [mode, setMode] = useState<TamperMode>("FIELD_ONLY");

  return (
    <Modal open={open} onClose={onClose} title="Simulate tampering" subtitle="Controlled demonstration. Nothing outside this demo database is touched."
      footer={<><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn variant="danger" loading={pending} onClick={() => onSubmit({ field, value, mode })} disabled={!value.trim()}>Tamper with record</Btn></>}>
      <div className="flex flex-col gap-4">
        <p className="m-0 border-l-[3px] border-warn bg-warn-bg px-4 py-3 text-[13px] leading-relaxed text-body">
          This edits the demo database directly, the way an insider with database access might, <b>without</b> the signer's private key and without touching the ledger.
        </p>
        <Field label="Field to alter">
          <select className="inp" value={field} onChange={(e) => { setField(e.target.value); setValue(suggest?.(e.target.value, current(e.target.value)) ?? ""); }}>
            {fields.map((f) => <option key={f} value={f}>{fieldLabel(f.replace("metadata.", ""))}{f.startsWith("metadata.") ? " (metadata)" : ""}</option>)}
          </select>
        </Field>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Current value"><div className="inp truncate border-line-2 bg-hov text-mute">{current(field) || "—"}</div></Field>
          <Field label="Tampered value"><input className="inp border-bad-line" value={value} onChange={(e) => setValue(e.target.value)} autoFocus /></Field>
        </div>
        {allowModes && (
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="mb-1.5 text-[13px] font-medium">Attacker capability</legend>
            {([
              ["FIELD_ONLY", "Edit the field only", "The stored hash, signature and ledger are untouched."],
              ["FIELD_AND_HASH", "Edit the field and recompute the stored hash", "A smarter attacker also updates the hash column. The signature and ledger still expose it."],
            ] as const).map(([m, title, desc]) => (
              <label key={m} className={cx("flex cursor-pointer gap-3 rounded border px-3.5 py-3", mode === m ? "border-ink bg-card" : "border-line")}>
                <input type="radio" className="mt-1 accent-ink" checked={mode === m} onChange={() => setMode(m)} />
                <span className="flex flex-col"><span className="text-[14px] font-medium">{title}</span><span className="text-[13px] text-mute">{desc}</span></span>
              </label>
            ))}
          </fieldset>
        )}
        <InlineError error={error} />
      </div>
    </Modal>
  );
}
