import { FlaskConical } from "lucide-react";
import { useState } from "react";
import { fieldLabel } from "../lib/format";
import { Button, cx, Field, InlineError, Modal } from "./ui";

export type TamperMode = "FIELD_ONLY" | "FIELD_AND_HASH";

export function TamperDialog({ open, onClose, data, fields, onSubmit, pending, error, allowModes = true, defaultField, suggest }: {
  open: boolean;
  onClose: () => void;
  data: Record<string, unknown>;
  fields: string[];
  onSubmit: (input: { field: string; value: string; mode: TamperMode }) => void;
  pending: boolean;
  error: Error | null;
  allowModes?: boolean;
  defaultField?: string;
  suggest?: (field: string, current: string) => string;
}) {
  const initialField = defaultField && fields.includes(defaultField) ? defaultField : fields[0];
  const [field, setField] = useState(initialField);
  const current = (f: string) => {
    if (f.startsWith("metadata.")) return String((data.metadata as Record<string, unknown> | undefined)?.[f.slice(9)] ?? "");
    return String(data[f] ?? "");
  };
  const [value, setValue] = useState(() => suggest?.(initialField, current(initialField)) ?? "");
  const [mode, setMode] = useState<TamperMode>("FIELD_ONLY");

  return (
    <Modal open={open} onClose={onClose} title={<span className="flex items-center gap-2"><FlaskConical className="h-4 w-4 text-red-400" /> Simulate tampering</span>} tone="red">
      <div className="mb-4 rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-3 py-2.5 text-xs leading-relaxed text-amber-100/90">
        Controlled demonstration. This edits the demo database directly, the way an insider with database access might,
        <b> without </b>the signer's private key and without touching the ledger. No real system is attacked.
      </div>
      <form
        className="space-y-4"
        onSubmit={(e) => { e.preventDefault(); onSubmit({ field, value, mode }); }}
      >
        <Field label="Field to alter">
          <select className="input" value={field} onChange={(e) => { setField(e.target.value); setValue(suggest?.(e.target.value, current(e.target.value)) ?? ""); }}>
            {fields.map((f) => <option key={f} value={f}>{fieldLabel(f.replace("metadata.", ""))}{f.startsWith("metadata.") ? " (metadata)" : ""}</option>)}
          </select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Current value"><div className="input truncate text-emerald-300">{current(field) || "—"}</div></Field>
          <Field label="Tampered value"><input className="input border-red-500/40 text-red-200" value={value} onChange={(e) => setValue(e.target.value)} required autoFocus /></Field>
        </div>
        {allowModes && (
          <div className="space-y-2">
            <span className="block text-xs font-medium text-slate-300">Attacker capability</span>
            {([
              ["FIELD_ONLY", "Edit the field only", "Changes the content; the stored hash, signature and ledger are untouched."],
              ["FIELD_AND_HASH", "Edit the field and recompute the stored hash", "A smarter attacker also updates the hash column. Signature and ledger still expose it."],
            ] as const).map(([m, title, desc]) => (
              <label key={m} className={cx("flex cursor-pointer gap-3 rounded-lg border px-3 py-2.5 transition", mode === m ? "border-red-500/50 bg-red-500/[0.07]" : "border-white/10 hover:border-white/20")}>
                <input type="radio" className="mt-1 accent-red-500" checked={mode === m} onChange={() => setMode(m)} />
                <span><span className="block text-sm font-medium text-slate-100">{title}</span><span className="block text-xs text-slate-400">{desc}</span></span>
              </label>
            ))}
          </div>
        )}
        <InlineError error={error} />
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="danger" loading={pending} icon={<FlaskConical className="h-4 w-4" />}>Tamper with record</Button>
        </div>
      </form>
    </Modal>
  );
}
