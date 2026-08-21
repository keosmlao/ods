"use client";
import { resolveAuditNote, saveAuditNote } from "@/app/actions/repair-audit";
import { useConfirm } from "@/components/confirm-dialog";
import { AUDIT_CAUSE_LABEL, AUDIT_CAUSES } from "@/lib/repair-audit-check";
import type { AuditNote } from "@/lib/repair-audit";
import { CheckCircle2, FileText, LoaderCircle, MessageSquarePlus, Paperclip, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * **ບ່ອນກອກສາເຫດ ຂອງງານສ້ອມທີ່ຜິດປົກກະຕິ** — ໜ້າ /reports/repair-audit.
 *
 * ── ເປັນຫຍັງບັງຄັບ "ໝວດສາເຫດ" ນອກຈາກຂໍ້ຄວາມ ──
 * ຂໍ້ຄວາມລ້ວນຕອບຄຳຖາມ "ໃບນີ້ຄ້າງຍ້ອນຫຍັງ" ໄດ້ ແຕ່ຕອບ "**ເດືອນນີ້ຄ້າງຍ້ອນຫຍັງຫຼາຍສຸດ**"
 * ບໍ່ໄດ້ — ແລະ ຄຳຖາມທີ 2 ຄືອັນທີ່ເຮັດໃຫ້ແກ້ບັນຫາໄດ້ຈິງ (ຄ້າງຍ້ອນອາໄຫຼ່ 40% ⇒ ໄປແກ້ການສັ່ງຊື້).
 *
 * ── ຜູ້ຮັບຜິດຊອບ ──
 * ຕັ້ງຕົ້ນໃຫ້ **ຝ່າຍທີ່ SLA ກຳນົດ** ຂອງຂັ້ນປັດຈຸບັນ (ຈາກ REPAIR_STAGE_POLICIES) ⇒ ຄົນສ່ວນຫຼາຍ
 * ກົດຜ່ານໄດ້ເລີຍ ແລະ ຖ້າຄວາມຮັບຜິດຊອບຈິງບໍ່ຕົງກັບນະໂຍບາຍ ກໍ່ພິມທັບໄດ້.
 */

export function AuditNoteForm({
  code,
  note,
  defaultDept,
  defaultPerson,
  canEdit,
}: {
  code: string;
  note: AuditNote | null;
  /** ຝ່າຍທີ່ຮັບຜິດຊອບຂັ້ນປັດຈຸບັນ ຕາມນະໂຍບາຍ SLA — ໃສ່ໃຫ້ເປັນຄ່າຕັ້ງຕົ້ນ */
  defaultDept: string;
  /** ຊ່າງທີ່ຖືໃບງານຢູ່ (ຖ້າມີ) */
  defaultPerson: string;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();
  const { ask, dialog } = useConfirm();
  const router = useRouter();

  const submit = (formData: FormData) => {
    setError(null);
    startBusy(async () => {
      formData.set("job_code", code);
      const result = await saveAuditNote({}, formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  };

  const close = async () => {
    const ok = await ask({
      title: "ປິດບັນທຶກຄຳຊີ້ແຈງ?",
      message: `${code} — ບັນຫາຖືກແກ້ແລ້ວບໍ? ປະຫວັດຄຳຊີ້ແຈງຍັງເກັບໄວ້ (ບໍ່ຖືກລຶບ)`,
      confirmLabel: "ປິດບັນທຶກ",
    });
    if (!ok) return;
    setError(null);
    startBusy(async () => {
      const form = new FormData();
      form.set("job_code", code);
      form.set("note", "");
      const result = await resolveAuditNote({}, form);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  };

  /* ── ມີບັນທຶກແລ້ວ: ສະແດງຄຳຕອບ + ປຸ່ມແກ້/ປິດ ── */
  if (note && !open) {
    return (
      <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-3">
        {dialog}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-brand-800">
              ສາເຫດ: {note.causeLabel}
              <span className="ml-2 font-normal text-slate-500">
                ໂດຍ {note.createdBy} · {note.createdAt}
              </span>
            </p>
            <p className="mt-1 whitespace-pre-wrap text-xs text-slate-700">{note.reason}</p>
            {(note.ownerDept || note.ownerPerson) && (
              <p className="mt-1 text-[11px] text-slate-600">
                ຜູ້ຮັບຜິດຊອບ: <b>{[note.ownerDept, note.ownerPerson].filter(Boolean).join(" / ")}</b>
              </p>
            )}
            {note.files.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {note.files.map((file) => (
                  <a
                    key={file.id}
                    href={`/api/uploads/${encodeURIComponent(file.stored)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex max-w-56 items-center gap-1 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <FileText className="size-3 shrink-0" />
                    <span className="truncate">{file.name}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
          {canEdit && (
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                disabled={busy}
                onClick={() => setOpen(true)}
                className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                ແກ້ໄຂ
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={close}
                className="inline-flex h-7 items-center gap-1 rounded-lg border border-brand-200 bg-white px-2 text-[11px] font-semibold text-brand-800 hover:bg-brand-50 disabled:opacity-40"
              >
                {busy ? <LoaderCircle className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />}
                ແກ້ແລ້ວ
              </button>
            </div>
          )}
        </div>
        {error && <p className="mt-1 text-[11px] font-semibold text-brand-orange-700">{error}</p>}
      </div>
    );
  }

  if (!canEdit) {
    return <p className="text-[11px] text-slate-400">ຍັງບໍ່ມີຄຳຊີ້ແຈງ (ບໍ່ມີສິດບັນທຶກ)</p>;
  }

  /* ── ຍັງບໍ່ມີບັນທຶກ: ປຸ່ມເປີດຟອມ ── */
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-brand-orange-400 bg-white px-3 text-[11px] font-semibold text-brand-900 hover:bg-brand-orange-50"
      >
        <MessageSquarePlus className="size-3.5" />
        ບັນທຶກສາເຫດ / ຜູ້ຮັບຜິດຊອບ
      </button>
    );
  }

  /* ── ຟອມ ── */
  return (
    <form action={submit} className="space-y-2 rounded-xl border border-slate-300 bg-white p-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-slate-600">ໝວດສາເຫດ *</span>
          {/* select ທຳມະດາ (ບໍ່ແມ່ນ react-select) — ຢູ່ໃນແຖວຕາຕະລາງ ຕ້ອງເບົາ ແລະ ບໍ່ດັນ layout */}
          <select
            name="cause"
            required
            defaultValue={note?.cause ?? ""}
            className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs outline-none focus:border-brand-600"
          >
            <option value="">— ເລືອກ —</option>
            {AUDIT_CAUSES.map((cause) => (
              <option key={cause} value={cause}>
                {AUDIT_CAUSE_LABEL[cause]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-slate-600">ຝ່າຍທີ່ຮັບຜິດຊອບ</span>
          <input
            name="owner_dept"
            defaultValue={note?.ownerDept ?? defaultDept}
            maxLength={60}
            className="h-9 w-full rounded-lg border border-slate-300 px-2 text-xs outline-none focus:border-brand-600"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-slate-600">ຜູ້ຮັບຜິດຊອບ (ຄົນ)</span>
          <input
            name="owner_person"
            defaultValue={note?.ownerPerson ?? defaultPerson}
            maxLength={100}
            className="h-9 w-full rounded-lg border border-slate-300 px-2 text-xs outline-none focus:border-brand-600"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold text-slate-600">
          ຄ້າງຍ້ອນຫຍັງ / ຕິດບັນຫາຫຍັງ *
        </span>
        <textarea
          name="reason"
          required
          rows={3}
          maxLength={2000}
          defaultValue={note?.reason ?? ""}
          placeholder="ເຊັ່ນ: ອາໄຫຼ່ສັ່ງຈາກໂຮງງານ 25-07 ຍັງບໍ່ມາ · ໄດ້ຕິດຕາມກັບ supplier ແລ້ວ 2 ຄັ້ງ"
          className="w-full rounded-lg border border-slate-300 p-2 text-xs outline-none focus:border-brand-600"
        />
      </label>

      <label className="block">
        <span className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-slate-600">
          <Paperclip className="size-3" /> ແນບເອກະສານ (ຮູບ ຫຼື PDF · ສູງສຸດ 5 ໄຟລ໌ · 16MB/ໄຟລ໌)
        </span>
        <input
          type="file"
          name="files"
          multiple
          accept="image/*,application/pdf"
          className="w-full rounded-lg border border-slate-300 p-1.5 text-[11px] file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-[11px]"
        />
      </label>

      {error && <p className="text-[11px] font-semibold text-brand-orange-700">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-900 px-4 text-[11px] font-semibold text-white hover:bg-brand-800 disabled:opacity-40"
        >
          {busy ? <LoaderCircle className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />}
          ບັນທຶກ
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
        >
          <X className="size-3" /> ຍົກເລີກ
        </button>
      </div>
    </form>
  );
}
