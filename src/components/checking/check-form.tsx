"use client";
import { Elapsed } from "@/components/elapsed";
import { slaLabel, slaState, slaTone } from "@/lib/sla";
import { addSpareItem, deleteSpareItem, saveCheck, updateSpareQty } from "@/app/actions/checking";
import { CancelCheckButton, UndoStartCheckButton } from "@/components/checking/check-actions";
import {
  CHECK_OUTCOME_HINT,
  CHECK_OUTCOME_LABEL,
  CHECK_OUTCOMES,
  type CheckOutcome,
} from "@/lib/check-outcome";
import { useConfirm } from "@/components/confirm-dialog";
import { SelectField } from "@/components/select-field";

/**
 * ── ຮູບອາໄຫຼ່ທີ່ຕ້ອງການ (07-08-2026) ──
 * ຊ່າງມັກຮູ້ວ່າຕ້ອງໃຊ້ອາໄຫຼ່ຫຍັງ ແຕ່ **ຫາລະຫັດໃນລະບົບບໍ່ພົບ** ⇒ ບັງຄັບເລືອກຈາກ catalog
 * = ຊ່າງຕິດ. ດຽວນີ້ບໍ່ເລືອກກໍ່ໄດ້ ແຕ່ຕ້ອງ**ຖ່າຍຮູບຕົວອາໄຫຼ່**ໄວ້ ⇒ admin ລະບຸ/ສັ່ງໃຫ້.
 * ບີບຢູ່ browser ກ່ອນສົ່ງ (ກວ້າງ ≤1200px · JPEG 0.7) ຄືກັບປຸ່ມຈົບງານ.
 */
const MAX_WIDTH = 1200;
const QUALITY = 0.7;

async function compress(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_WIDTH / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", QUALITY);
}
import { SpareSearchDialog } from "@/components/spare-search";
import { Button, Card, ErrorBox, Empty, Table, inputClass, labelClass } from "@/components/ui";
import { LoaderCircle, LogOut, Printer, RotateCcw, Save, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useDict } from "@/lib/i18n/context";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { useActionState, useState, useTransition } from "react";
import { KeepFormValues } from "@/components/keep-form-values";

type Dict = Dictionary["checkForm"];

/** ຖອດແບບຈາກ ods/templates/checking/checking_page.html + spare_results.html */

export type CheckHead = {
  code: string;
  registered: string | null;
  customer: string | null;
  product: string | null;
  warranty: string | null;
  /** ເຫດຜົນທີ່ຊ່າງຕັດສິນວ່າ ໝົດຮັບປະກັນ (tb_product.warranty_reason) — ຫຼັກຖານຕໍ່ລູກຄ້າ */
  warranty_reason: string | null;
  issue: string | null;
  receiver: string | null;
  technician: string | null;
  /** ເລີ່ມກວດເມື່ອໃດ ແລະ ໃຊ້ເວລາໄປແລ້ວເທົ່າໃດ */
  check_started: string | null;
  check_seconds: number | null;
  service_type: string | null;
  /** ບັນທຶກຜົນກວດເຊັກໄປແລ້ວບໍ (time_finish_check) — ຕັດສິນວ່າຈະສະແດງປຸ່ມຖອນຄືນອັນໃດ */
  check_saved: boolean;
};

export type BasketLine = {
  rnum: number;
  roworder: number;
  item_code: string;
  item_name: string | null;
  qty: string;
  unit_code: string | null;
};

function Info({ label, value, danger }: { label: string; value: string | null; danger?: boolean }) {
  return (
    <div className="border-b border-slate-100 pb-3">
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className={`mt-1 text-sm font-medium ${danger ? "text-[#9f5f14]" : "text-slate-800"}`}>{value || "-"}</dd>
    </div>
  );
}

/** ແຖວອາໄຫຼ່ໃນກະຕ່າ — ກົດຈຳນວນເພື່ອແກ້ໄຂ (ods ໃຊ້ modal /updateqty) */
function BasketRow({ code, line, t }: { code: string; line: BasketLine; t: Dict }) {
  const [editing, setEditing] = useState(false);
  const [qty, setQty] = useState(line.qty);
  const [pending, start] = useTransition();
  const { ask, dialog } = useConfirm();

  return (
    <tr className="border-b border-slate-100">
      <td className="px-3 py-2 text-center">
        {dialog}
        <button
          type="button"
          title={t.delete}
          disabled={pending}
          onClick={async () => {
            const ok = await ask({
              title: t.deleteItemTitle,
              message: (
                <>
                  {t.sparePrefix} <b className="text-slate-700">{line.item_code}</b> {t.willBeRemovedFromBasket}
                </>
              ),
              confirmLabel: t.delete,
              cancelLabel: t.no,
              tone: "danger",
            });
            if (!ok) return;
            start(() => void deleteSpareItem(code, line.roworder));
          }}
          className="text-[#9f5f14] transition hover:opacity-70 disabled:opacity-40"
        >
          <Trash2 className="size-4" />
        </button>
      </td>
      <td className="px-3 py-2 text-center">{line.rnum}</td>
      <td className="px-3 py-2">{line.item_code}</td>
      <td className="px-3 py-2">{line.item_name ?? "-"}</td>
      <td className="px-3 py-2 text-right">
        {editing ? (
          <span className="flex items-center justify-end gap-1">
            <input
              autoFocus
              value={qty}
              onChange={(event) => setQty(event.target.value)}
              className="h-8 w-20 rounded border border-slate-300 px-2 text-right text-sm outline-none focus:border-brand-600"
            />
            <Button
              type="button"
              tone="success"
              disabled={pending}
              className="h-8 px-2 text-xs"
              onClick={() =>
                start(async () => {
                  await updateSpareQty(code, line.roworder, Number(qty));
                  setEditing(false);
                })
              }
            >
              {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : "OK"}
            </Button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => {
              setQty(line.qty);
              setEditing(true);
            }}
            className="font-medium text-brand underline"
          >
            {line.qty}
          </button>
        )}
      </td>
      <td className="px-3 py-2">{line.unit_code ?? "-"}</td>
    </tr>
  );
}

export function CheckForm({ head, lines }: { head: CheckHead; lines: BasketLine[] }) {
  /** ຮູບອາໄຫຼ່ທີ່ຕ້ອງການ — ບັງຄັບເມື່ອ "ໃຊ້ອາໄຫຼ່" ແຕ່ບໍ່ໄດ້ເລືອກລາຍການ (lib/tech-flow) */
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const t = useDict().checkForm;
  const [state, action, pending] = useActionState(saveCheck, {});
  // ມີອາໄຫຼ່ຄ້າງໃນກະຕ່າຢູ່ແລ້ວ → ເປີດຕາຕະລາງໃຫ້ເລີຍ
  const [useSpare, setUseSpare] = useState(lines.length > 0 ? "1" : "0");
  /** ຈົບໂດຍບໍ່ສ້ອມ ⇒ ຄືນເຄື່ອງ (ລະບົບຍື່ນຄຳຂໍໃຫ້) — ເລື່ອງໃດຢູ່ທີ່ `outcome` */
  const [cannotRepair, setCannotRepair] = useState("0");
  const [cannotReason, setCannotReason] = useState("");
  /** ສ້ອມບໍ່ໄດ້ ຫຼື ແນະນຳປ່ຽນເຄື່ອງ — ເບິ່ງ lib/check-outcome */
  const [outcome, setOutcome] = useState<CheckOutcome>("cannot_repair");
  const [warByT, setWarByT] = useState("0");
  // ເຫດຜົນເກົ່າ (ຖ້າເຄີຍຕັດສິນວ່າໝົດປະກັນ) ຄ້າງໄວ້ໃຫ້ ບໍ່ໃຫ້ພິມຄືນໃໝ່ຕອນແກ້ໄຂຜົນກວດ
  const [reason, setReason] = useState(head.warranty_reason ?? "");
  /** ໝົດປະກັນຢູ່ແລ້ວບໍ — ຄ່າຢູ່ DB ເປັນຄຳເວົ້າ ("ໝົດຮັບປະກັນ" / "ຮັບປະກັນ") */
  const outOfWarranty = (head.warranty ?? "").trim() === "ໝົດຮັບປະກັນ";
  const [issue, setIssue] = useState("");
  const [searching, setSearching] = useState(false);

  function reset() {
    setIssue("");
    setWarByT("0");
    setReason(head.warranty_reason ?? "");
    setUseSpare("0");
  }

  return (
    <div className="space-y-5">
      <form action={action} className="space-y-5">
        <KeepFormValues />
        <input type="hidden" name="code" value={head.code} />
        <input type="hidden" name="warrunty" value={head.warranty ?? ""} />

        <div className="sticky top-20 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <Button tone="success" disabled={pending}>
            {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
            {pending ? t.saving : t.save}
          </Button>
          <Link
            href="/checking"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#9f5f14] px-5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            <LogOut className="size-4" />
            {t.exit}
          </Link>
          <Button type="button" tone="info" onClick={reset}>
            <RotateCcw className="size-4" />
            {t.clear}
          </Button>
          {/* ໃບກວດເຊັກ — ເປີດແທັບໃໝ່ ຈຶ່ງບໍ່ເສຍຂໍ້ມູນທີ່ພິມຄ້າງໄວ້ໃນຟອມ */}
          <Link
            href={`/checking/${head.code}/print`}
            target="_blank"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <Printer className="size-4" />
            {t.printCheckSlip}
          </Link>

          {/* ແກ້ໄຂການກົດຜິດ — ຍັງບໍ່ບັນທຶກຜົນ: ຖອນ "ເລີ່ມກວດເຊັກ" · ບັນທຶກແລ້ວ: ລ້າງຜົນກວດ
              (ປຸ່ມຢູ່ນອກ <form> ບໍ່ໄດ້ ເພາະຢູ່ໃນແຖບນີ້ — ຈຶ່ງເປັນ type="button" ພາຍໃນ UndoButton) */}
          <span className="ml-auto flex flex-wrap items-center gap-2">
            {head.check_saved ? (
              <CancelCheckButton code={head.code} />
            ) : (
              <UndoStartCheckButton code={head.code} />
            )}
          </span>
        </div>

        {state.error && <ErrorBox>{state.error}</ErrorBox>}

        <Card title={t.receiveInfo}>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Info label={t.date} value={head.registered} />
            <Info label={t.customer} value={head.customer} />
            <Info label={t.productName} value={head.product} />
            <Info label={t.warranty} value={head.warranty} />
            {/* ເຫດຜົນທີ່ຊ່າງຕັດສິນວ່າໝົດຮັບປະກັນ — ຫຼັກຖານເມື່ອລູກຄ້າຄ້ານ */}
            {head.warranty_reason && <Info label={t.warrantyExpiredReason} value={head.warranty_reason} danger />}
            <Info label={t.issue} value={head.issue} danger />
            <Info label={t.receiver} value={head.receiver} danger />
            <Info label={t.technician} value={head.technician} />

            {/* ເວລາທີ່ໃຊ້ໄປໃນຂັ້ນກວດເຊັກ ພ້ອມກຳນົດເວລາ (SLA) */}
            <div>
              <dt className="text-xs text-slate-400">{t.checkingElapsed}</dt>
              <dd className="mt-1 flex flex-wrap items-center gap-1.5">
                <Elapsed
                  seconds={head.check_seconds}
                  className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold ${slaTone(slaState(head.check_seconds, head.service_type)).chip}`}
                />
                {slaState(head.check_seconds, head.service_type) === "late" && (
                  <span className="rounded bg-brand-orange-100 px-1 text-[10px] font-bold text-brand-orange-700">{t.overdue}</span>
                )}
                <span className="text-[10px] text-slate-400">
                  {head.check_started}
                  {slaLabel(head.service_type) && <span className="ml-1">· {slaLabel(head.service_type)}</span>}
                </span>
              </dd>
            </div>
          </dl>
        </Card>

        <Card title={t.checkResult}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className={labelClass}>
                {t.techDiagnosis} <span className="text-brand-orange-700">*</span>
              </label>
              <input name="isue_bytech" required value={issue} onChange={(event) => setIssue(event.target.value)} className={inputClass} />
            </div>

            {/*
              ── ໃບທີ່ **ໝົດປະກັນຢູ່ແລ້ວ** ບໍ່ຕ້ອງມີຕົວເລືອກນີ້ (07-08-2026 ຕາມຄຳສັ່ງ) ──
              ຂໍປ່ຽນເປັນ "ໝົດຮັບປະກັນ" ທັງທີ່ມັນໝົດຢູ່ແລ້ວ = ຄຳຂໍທີ່ບໍ່ມີຄວາມໝາຍ
              ແລະ ຍັງໄປສ້າງຄິວລໍອະນຸມັດໃຫ້ຜູ້ຈັດການລ້າໆ (lib/warranty-request).
              ສົ່ງ war_by_t = 0 ໄປແທນ ⇒ server ບໍ່ສ້າງຄຳຂໍ.
            */}
            {outOfWarranty ? (
              <div>
                <label className={labelClass}>{t.warrantyConsideration}</label>
                <p className="flex h-10 items-center rounded-lg bg-slate-100 px-3 text-xs font-medium text-slate-500">
                  {t.warrantyAlreadyExpired}
                </p>
                <input type="hidden" name="war_by_t" value="0" />
              </div>
            ) : (
              <div>
                <label className={labelClass}>
                  {t.warrantyConsideration} <span className="text-brand-orange-700">*</span>
                </label>
                <SelectField
                  name="war_by_t"
                  value={warByT}
                  onChange={(value) => setWarByT(value || "0")}
                  options={[
                    { value: "0", label: t.warrantyNormal },
                    { value: "1", label: t.warrantyRequestChange },
                  ]}
                />
              </div>
            )}

            {/* ເຫດຜົນ = ຫຼັກຖານຂອງການຕັດສິນປະກັນ → ບັງຄັບເມື່ອ "ຂໍປ່ຽນປະກັນ" (ບັງຄັບຢູ່ server ນຳ) */}
            <div>
              <label className={labelClass}>
                {t.reasonWarrantyExpired}{warByT === "1" && <span className="text-brand-orange-700"> *</span>}
              </label>
              <input
                name="t_reason"
                required={warByT === "1"}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={warByT === "1" ? t.reasonPlaceholder : ""}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>
                {t.useSpare} <span className="text-brand-orange-700">*</span>
              </label>
              {/* ຄ່ານີ້ຖືກສົ່ງອອກຜ່ານ hidden input ຂອງ SelectField (name="use_spare") */}
              <SelectField
                name="use_spare"
                value={useSpare}
                onChange={(value) => setUseSpare(value || "0")}
                options={[
                  { value: "0", label: t.noSpare },
                  { value: "1", label: t.useSpare },
                ]}
                isDisabled={cannotRepair === "1"}
              />
            </div>
          </div>

          {/* ຮູບອາໄຫຼ່ທີ່ຕ້ອງການ — ໂຊ້ວເມື່ອເລືອກ "ໃຊ້ອາໄຫຼ່" (ບໍ່ເລືອກລາຍການກໍ່ໄດ້ ຖ້າມີຮູບ) */}
          {useSpare === "1" && (
            <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50/40 p-3">
              <p className="text-xs font-bold text-brand-900">{t.sparePhotoTitle}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">{t.sparePhotoHint}</p>
              <input type="hidden" name="photos" value={JSON.stringify(photos)} />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {photos.map((photo, index) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={index} src={photo} alt="" className="size-14 rounded border border-slate-200 object-cover" />
                ))}
                <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={async (event) => {
                      const files = event.target.files;
                      if (!files?.length) return;
                      setPhotoBusy(true);
                      try {
                        const shots = await Promise.all([...files].map(compress));
                        setPhotos((current) => [...current, ...shots]);
                      } finally {
                        setPhotoBusy(false);
                        event.target.value = "";
                      }
                    }}
                  />
                  {photoBusy ? t.sparePhotoBusy : t.sparePhotoAdd}
                </label>
                {photos.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setPhotos([])}
                    className="text-[11px] font-semibold text-brand-orange-700 hover:underline"
                  >
                    {t.sparePhotoClear}
                  </button>
                )}
              </div>
            </div>
          )}

          {/*
            ── ຈົບໂດຍບໍ່ສ້ອມ ⇒ ຄືນເຄື່ອງ (01-08-2026 · ຂະຫຍາຍ 05-08-2026) ──
            ເດີມມີທາງອອກດຽວຄື "ສ້ອມບໍ່ໄດ້". ແຕ່ຊ່າງທີ່ພົບວ່າ**ຄວນປ່ຽນເຄື່ອງໃໝ່**
            ຕ້ອງຢືມມັນມາໃຊ້ ທັງທີ່ເປັນຄົນລະເລື່ອງ: ການປ່ຽນເຄື່ອງເປັນໜ້າທີ່**ຝ່າຍຂາຍ**
            ສູນບໍລິການພຽງແຕ່ແນະນຳ. ດຽວນີ້ຈຶ່ງເລືອກໄດ້ 2 ຜົນ (lib/check-outcome).
            ເສັ້ນທາງຫຼັງຈາກນີ້ຄືກັນທັງສອງ — ຕ່າງກັນທີ່ປ້າຍ ແລະ ສິ່ງທີ່ເກີດຕໍ່.
          */}
          <div className="mt-4 rounded-xl border border-brand-orange-400 bg-brand-orange-100/50 p-3">
            <label className="flex items-center gap-2 text-sm font-bold text-brand-900">
              <input
                type="checkbox"
                checked={cannotRepair === "1"}
                onChange={(event) => {
                  setCannotRepair(event.target.checked ? "1" : "0");
                  if (event.target.checked) setUseSpare("0"); // ຈົບໂດຍບໍ່ສ້ອມ = ບໍ່ໃຊ້ອາໄຫຼ່
                }}
                className="size-4 accent-brand-orange-700"
              />
              {t.noRepairOutcome}
            </label>
            <input type="hidden" name="cannot_repair" value={cannotRepair} />
            <input type="hidden" name="check_outcome" value={outcome} />
            <p className="mt-1 text-[11px] text-brand-900">{t.cannotRepairNote}</p>

            {cannotRepair === "1" && (
              <div className="mt-2 space-y-2">
                {/* ເລືອກ 1 ໃນ 2 — radio ບໍ່ແມ່ນ dropdown ເພື່ອໃຫ້ເຫັນຄຳອະທິບາຍທັງສອງພ້ອມກັນ */}
                {CHECK_OUTCOMES.map((value) => (
                  <label
                    key={value}
                    className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2 ${
                      outcome === value ? "border-brand-orange-700 bg-white" : "border-slate-300 bg-white/60"
                    }`}
                  >
                    <input
                      type="radio"
                      name="check_outcome_pick"
                      checked={outcome === value}
                      onChange={() => setOutcome(value)}
                      className="mt-0.5 size-4 accent-brand-orange-700"
                    />
                    <span className="min-w-0">
                      <span className="block text-xs font-bold text-brand-900">{CHECK_OUTCOME_LABEL[value]}</span>
                      <span className="mt-0.5 block text-[11px] text-slate-600">{CHECK_OUTCOME_HINT[value]}</span>
                    </span>
                  </label>
                ))}
                <input
                  name="cannot_reason"
                  required
                  value={cannotReason}
                  onChange={(event) => setCannotReason(event.target.value)}
                  placeholder={
                    outcome === "replace_advice" ? t.replaceAdvicePlaceholder : t.cannotRepairPlaceholder
                  }
                  className={inputClass}
                />
              </div>
            )}
          </div>
        </Card>
      </form>

      {/* ຕາຕະລາງອາໄຫຼ່ຢູ່ນອກ form — ປຸ່ມເພີ່ມ/ລຶບ ບໍ່ໃຫ້ submit ໃບກວດເຊັກ */}
      {useSpare === "1" && cannotRepair !== "1" && (
        <Card
          title={t.sparesUsed}
          actions={
            <Button type="button" tone="primary" className="h-8 px-3 text-xs" onClick={() => setSearching(true)}>
              <Search className="size-3.5" />
              {t.choose}
            </Button>
          }
        >
          {lines.length === 0 ? (
            <Empty>{t.noSpareSelected}</Empty>
          ) : (
            <Table minWidth={800} head={["-", "#", t.itemCode, t.productName, t.qty, t.unit]}>
              {lines.map((line) => (
                <BasketRow key={line.roworder} code={head.code} line={line} t={t} />
              ))}
            </Table>
          )}
        </Card>
      )}

      {searching && (
        <SpareSearchDialog
          chosen={new Set(lines.map((line) => line.item_code))}
          onAdd={(item, qty) => addSpareItem(head.code, { code: item.code, name_1: item.name_1, unit_code: item.unit_code }, qty)}
          onClose={() => setSearching(false)}
        />
      )}
    </div>
  );
}
