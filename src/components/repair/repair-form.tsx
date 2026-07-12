"use client";
import { addUsedSpare, deleteUsedSpare, saveRepair, updateUsedSpareQty } from "@/app/actions/repair";
import { UndoFinishRepairButton, UndoStartRepairButton } from "@/components/repair/repair-actions";
import { useConfirm } from "@/components/confirm-dialog";
import { Elapsed } from "@/components/elapsed";
import { SpareSearchDialog } from "@/components/spare-search";
import { Button, Card, Empty, ErrorBox } from "@/components/ui";
import {
  AlertTriangle,
  Check,
  ClipboardList,
  LoaderCircle,
  LogOut,
  Package,
  PackageCheck,
  PackagePlus,
  Plus,
  Printer,
  Save,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useActionState, useState, useTransition } from "react";

/** ຖອດແບບຈາກ ods/templates/repair/repair_page.html (ອອກແບບໃໝ່) */

export type RepairHead = {
  code: string;
  /** ໃຊ້ລິ້ງໄປໜ້າໃບຂໍເບີກ /stock/requests/[roworder] */
  roworder: number;
  finished_check: string | null;
  customer: string | null;
  product: string | null;
  brand: string | null;
  warranty: string | null;
  /** ເຫດຜົນທີ່ຊ່າງຕັດສິນວ່າໝົດຮັບປະກັນ (tb_product.warranty_reason) */
  warranty_reason: string | null;
  issue: string | null;
  issue_2: string | null;
  technician: string | null;
  repair_started: string | null;
  repair_seconds: number | null;
  /** ຂໍເບີກອາໄຫຼ່ແລ້ວ (tb_product.spare_reg) */
  spare_requested: boolean;
  /** ໝົດຮັບປະກັນ ຕ້ອງມີໃບສະເໜີລາຄາຈົບກ່ອນຈຶ່ງເບີກອາໄຫຼ່ໄດ້ */
  quotation_done: boolean;
  repair_note: string | null;
  /** ເລີ່ມສ້ອມແປງແລ້ວ (time_repair) — ຕັດສິນວ່າຈະສະແດງປຸ່ມຖອນຄືນອັນໃດ */
  repair_running: boolean;
  /** ບັນທຶກ "ສ້ອມແປງສຳເລັດ" ແລ້ວເມື່ອໃດ (time_finish_repair) */
  repair_finished: string | null;
  /** ສົ່ງຄືນລູກຄ້າແລ້ວ — ຖອນຄືນຫຍັງບໍ່ໄດ້ອີກ */
  returned: boolean;
};

export type SpareLine = {
  rnum: number;
  roworder: number;
  item_code: string;
  item_name: string | null;
  qty: string;
  unit_code: string | null;
  /** ຊ່າງມາຮັບຂອງແລ້ວ (tb_used_spare.pick_finish) */
  picked: boolean;
  /** ສາງເບີກອອກແລ້ວ (ມີໃບເບີກ 56) — ຂອງອອກຈາກສາງໄປແລ້ວ ຈຶ່ງຫ້າມລຶບ/ແກ້ */
  issued: boolean;
  /** ຢູ່ໃນໃບຂໍເບີກ (122) ແລ້ວ — ແກ້ຈຳນວນບໍ່ໄດ້ ບໍ່ດັ່ງນັ້ນກະຕ່າກັບໃບຈະບໍ່ຕົງກັນ */
  requested: boolean;
};

/** ອາໄຫຼ່ແຖວນີ້ເຂົ້າເອກະສານໄປແລ້ວບໍ — ເຂົ້າແລ້ວ ຊ່າງແກ້/ລຶບເອງບໍ່ໄດ້ */
const locked = (line: SpareLine) => line.picked || line.issued || line.requested;

function Info({ label, value, danger }: { label: string; value: string | null; danger?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] text-slate-400">{label}</dt>
      <dd className={`mt-0.5 text-xs font-medium ${danger ? "text-red-600" : "text-slate-800"}`}>{value || "-"}</dd>
    </div>
  );
}

/** ປ້າຍສະຖານະຂອງອາໄຫຼ່ແຖວນຶ່ງ — 4 ຂັ້ນ: ຍັງບໍ່ຂໍ → ຂໍແລ້ວ → ສາງເບີກແລ້ວ → ຮັບແລ້ວ */
function LineStatus({ line }: { line: SpareLine }) {
  if (line.picked)
    return <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">ໄດ້ຮັບແລ້ວ</span>;
  if (line.issued)
    return (
      <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
        ສາງເບີກແລ້ວ — ລໍຖ້າຮັບ
      </span>
    );
  if (line.requested)
    return <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">ລໍຖ້າສາງເບີກ</span>;
  return <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">ຍັງບໍ່ໄດ້ຂໍເບີກ</span>;
}

/** ແຖວອາໄຫຼ່ທີ່ຈະປ່ຽນ — ແກ້ຈຳນວນ ຫຼື ລຶບໄດ້ ຖ້າຍັງບໍ່ທັນເຂົ້າໃບຂໍເບີກ/ໃບເບີກ */
function SpareRow({ code, line }: { code: string; line: SpareLine }) {
  const [qty, setQty] = useState(line.qty);
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const { ask, dialog } = useConfirm();

  return (
    <tr className="border-b border-slate-100 last:border-0">
      {dialog}
      <td className="px-3 py-2 text-center text-slate-400">{line.rnum}</td>
      <td className="px-3 py-2">
        <span className="block font-medium text-slate-800">{line.item_name ?? "-"}</span>
        <span className="block font-mono text-[10px] text-slate-400">{line.item_code}</span>
      </td>
      <td className="px-3 py-2 text-right">
        {editing ? (
          <span className="flex items-center justify-end gap-1">
            <input
              autoFocus
              value={qty}
              onChange={(event) => setQty(event.target.value.replace(/\D/g, ""))}
              className="h-7 w-16 rounded border border-slate-300 px-2 text-right text-xs outline-none focus:border-teal-500"
            />
            <Button
              type="button"
              tone="success"
              disabled={pending}
              className="h-7 px-2 text-[11px]"
              onClick={() =>
                start(async () => {
                  await updateUsedSpareQty(code, line.roworder, Number(qty));
                  setEditing(false);
                })
              }
            >
              {pending ? <LoaderCircle className="size-3 animate-spin" /> : <Check className="size-3" />}
            </Button>
          </span>
        ) : locked(line) ? (
          <span className="font-medium tabular-nums text-slate-700">{line.qty}</span>
        ) : (
          <button
            type="button"
            onClick={() => {
              setQty(line.qty);
              setEditing(true);
            }}
            className="font-medium tabular-nums text-[#0536a9] underline"
          >
            {line.qty}
          </button>
        )}
      </td>
      <td className="px-3 py-2 text-slate-500">{line.unit_code ?? "-"}</td>
      <td className="px-3 py-2">
        <LineStatus line={line} />
      </td>
      <td className="px-3 py-2 text-center">
        {!locked(line) && (
          <button
            type="button"
            title="ລຶບ"
            disabled={pending}
            onClick={async () => {
              const ok = await ask({
                title: "ລຶບອາໄຫຼ່ນີ້?",
                message: (
                  <>
                    <b className="text-slate-700">{line.item_name ?? line.item_code}</b> ຈະຖືກລຶບອອກຈາກລາຍການທີ່ຕ້ອງປ່ຽນ
                  </>
                ),
                confirmLabel: "ລຶບ",
                cancelLabel: "ບໍ່",
                tone: "danger",
              });
              if (!ok) return;
              start(() => void deleteUsedSpare(code, line.roworder));
            }}
            className="text-[#DE3163] transition hover:opacity-70 disabled:opacity-40"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </td>
    </tr>
  );
}

export function RepairForm({ head, lines }: { head: RepairHead; lines: SpareLine[] }) {
  const [state, action, pending] = useActionState(saveRepair, {});
  const [searching, setSearching] = useState(false);

  const waitingSpare = lines.filter((line) => !line.picked).length;
  // ສາງເບີກອອກໃຫ້ແລ້ວ ແຕ່ຊ່າງຍັງບໍ່ໄດ້ໄປຮັບ → ພາໄປໜ້າ "ຮັບອາໄຫຼ່"
  const toPickUp = lines.filter((line) => line.issued && !line.picked).length;
  // ຂໍໄປແລ້ວ ແຕ່ສາງຍັງບໍ່ທັນເບີກອອກ (ເບີກບໍ່ຄົບ)
  const notIssued = lines.filter((line) => line.requested && !line.issued).length;

  /**
   * ອາໄຫຼ່ທີ່ **ຍັງບໍ່ເຄີຍເຂົ້າໃບຂໍເບີກຈັກໃບ** — ສ່ວນຫຼາຍຄືຕົວທີ່ຊ່າງຫາກໍ່ເພີ່ມຕອນສ້ອມ
   * (ພໍລົງມືສ້ອມ ອາໄຫຼ່ທີ່ຕ້ອງປ່ຽນມັກປ່ຽນໄປ).
   *
   * ຖ້າບໍ່ບອກ ຊ່າງຈະຄິດວ່າ "ເພີ່ມເຂົ້າກະຕ່າແລ້ວ = ຂໍເບີກແລ້ວ" ແລ້ວປິດວຽກໄປ
   * ⇒ ອາໄຫຼ່ບໍ່ເຄີຍຖືກເບີກອອກສາງ ແລະ ບັນຊີບໍ່ຕົງກັບຂອງຈິງ. ທາງເຂົ້າທີ່ຖືກຕ້ອງ
   * (/stock/requests/again) ຢູ່ເລິກໃນໜ້າສາງ ຊ່າງຫາບໍ່ພົບ ⇒ ພາໄປໃຫ້ຈາກບ່ອນນີ້ເລີຍ.
   */
  const notRequested = lines.filter((line) => !line.requested).length;
  // ເຄີຍມີໃບຂໍເບີກແລ້ວ → ຕ້ອງໃຊ້ "ຂໍເບີກຊ້ຳ" (ໃບທີ 2 ຂໍສະເພາະຈຳນວນທີ່ຍັງຄ້າງ)
  const requestHref = head.spare_requested ? "/stock/requests/again" : "/stock/requests";
  // ໝົດຮັບປະກັນ → ຕ້ອງມີໃບສະເໜີລາຄາທີ່ຈົບແລ້ວ ຈຶ່ງເບີກອາໄຫຼ່ອອກສາງໄດ້ (ຕາມ ods)
  const needsQuotation = head.warranty === "ໝົດຮັບປະກັນ" && !head.quotation_done;

  return (
    <div className="space-y-4">
      {/* ແຖບປຸ່ມ */}
      <form action={action} className="space-y-4">
        <input type="hidden" name="pro_code" value={head.code} />

        <div className="sticky top-16 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
          <Button tone="success" disabled={pending} className="h-9 px-4 text-xs">
            {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            {pending ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກ ສ້ອມແປງສຳເລັດ"}
          </Button>
          <Link
            href="/repair"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <LogOut className="size-3.5" />
            ອອກ
          </Link>
          {/* ໃບສ້ອມແປງ — ເປີດແທັບໃໝ່ ຈຶ່ງບໍ່ເສຍຂໍ້ມູນທີ່ພິມຄ້າງໄວ້ໃນຟອມ */}
          <Link
            href={`/repair/${head.code}/print`}
            target="_blank"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <Printer className="size-3.5" />
            ພິມໃບສ້ອມແປງ
          </Link>

          {/* ແກ້ໄຂການກົດຜິດ — ສະແດງປຸ່ມຖອນຄືນຂອງຂັ້ນທີ່ວຽກຢູ່ຕົວຈິງ
              (ສົ່ງຄືນລູກຄ້າແລ້ວ = ຖອນຫຍັງບໍ່ໄດ້ ⇒ ບໍ່ສະແດງປຸ່ມ) */}
          {!head.returned && (
            <span className="flex flex-wrap items-center gap-2">
              {head.repair_finished ? (
                <UndoFinishRepairButton code={head.code} />
              ) : (
                head.repair_running && <UndoStartRepairButton code={head.code} />
              )}
            </span>
          )}

          {/* ເວລາທີ່ໃຊ້ສ້ອມມາແລ້ວ */}
          <span className="ml-auto flex items-center gap-1.5 text-[11px] text-slate-500">
            ສ້ອມມາແລ້ວ
            <Elapsed
              seconds={head.repair_seconds}
              className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700"
            />
          </span>
        </div>

        {/* ບັນທຶກຈົບແລ້ວ — ບອກສະຖານະໃຫ້ຊັດ ພ້ອມທາງດຶງກັບມາສ້ອມຕໍ່ (ປຸ່ມຢູ່ແຖບເທິງ) */}
        {head.repair_finished && !head.returned && (
          <p className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            <Check className="size-4 shrink-0" />
            ບັນທຶກ &quot;ສ້ອມແປງສຳເລັດ&quot; ແລ້ວ ({head.repair_finished}) · ວຽກຢູ່ຄິວ &quot;ລໍຖ້າສົ່ງຄືນ&quot; —
            ຖ້າກົດຈົບໄວເກີນ ໃຫ້ກົດ &quot;ຍົກເລີກ ຈົບການສ້ອມແປງ&quot; ຢູ່ແຖບເທິງ
          </p>
        )}

        {state.error && <ErrorBox>{state.error}</ErrorBox>}

        {/* ເພີ່ມອາໄຫຼ່ຕອນສ້ອມ ແຕ່ຍັງບໍ່ໄດ້ຂໍເບີກ → ພາໄປໜ້າຂໍເບີກໂດຍກົງ (ບໍ່ດັ່ງນັ້ນຊ່າງຫາບໍ່ພົບ) */}
        {notRequested > 0 && (
          <p className="flex flex-wrap items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
            <PackagePlus className="size-4 shrink-0" />
            <span className="min-w-40 flex-1">
              ມີອາໄຫຼ່ <b>{notRequested}</b> ລາຍການ ທີ່ຍັງ<b>ບໍ່ໄດ້ສ້າງໃບຂໍເບີກ</b> —
              ເພີ່ມເຂົ້າລາຍການແລ້ວຍັງບໍ່ພໍ, ຕ້ອງຂໍເບີກ ແລ້ວໃຫ້ສາງເບີກອອກມາ ຈຶ່ງຈະໄດ້ຂອງຈິງ
            </span>
            <Link
              href={requestHref}
              className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg bg-[#0536a9] px-2.5 text-[11px] font-semibold text-white transition hover:opacity-90"
            >
              <PackagePlus className="size-3.5" />
              {head.spare_requested ? "ຂໍເບີກອາໄຫຼ່ເພີ່ມ" : "ສ້າງໃບຂໍເບີກ"}
            </Link>
          </p>
        )}

        {/* ຍັງມີອາໄຫຼ່ທີ່ຊ່າງບໍ່ທັນໄດ້ຮັບ → ເຕືອນ ແຕ່ບໍ່ຫ້າມບັນທຶກ */}
        {waitingSpare > 0 && (
          <p className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle className="size-4 shrink-0" />
            ຍັງມີອາໄຫຼ່ <b>{waitingSpare}</b> ລາຍການ ທີ່ຍັງບໍ່ໄດ້ຮັບ
            {notIssued > 0 && ` · ສາງຍັງບໍ່ທັນເບີກອອກ ${notIssued} ລາຍການ`}
            {toPickUp > 0 && (
              <Link
                href="/stock/requests/pickup"
                className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-[#0536a9] px-2.5 text-[11px] font-semibold text-white transition hover:opacity-90"
              >
                <PackageCheck className="size-3.5" />
                ໄປຮັບອາໄຫຼ່ ({toPickUp})
              </Link>
            )}
          </p>
        )}

        <Card title="ຂໍ້ມູນວຽກ">
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Info label="ລູກຄ້າ" value={head.customer} />
            <Info label="ຊື່ສິນຄ້າ / SN" value={head.product} />
            <Info label="ຫຍີ່ຫໍ້" value={head.brand} />
            <Info label="ປະກັນ" value={head.warranty} />
            {/* ເຫດຜົນທີ່ຊ່າງຕັດສິນວ່າໝົດຮັບປະກັນ — ຫຼັກຖານເມື່ອລູກຄ້າຄ້ານ */}
            {head.warranty_reason && <Info label="ເຫດຜົນໝົດຮັບປະກັນ" value={head.warranty_reason} danger />}
            <Info label="ອາການເບື້ອງຕົ້ນ" value={head.issue} danger />
            <Info label="ອາການທີ່ຊ່າງວິເຄາະ" value={head.issue_2} danger />
            <Info label="ຊ່າງ" value={head.technician} />
            <Info label="ເລີ່ມສ້ອມແປງ" value={head.repair_started ?? head.finished_check} />
          </dl>
        </Card>

        <Card title="ວິທີແກ້ໄຂ / ໝາຍເຫດຂອງຊ່າງ">
          <textarea
            name="repair_note"
            rows={3}
            defaultValue={head.repair_note ?? ""}
            placeholder="ແກ້ໄຂແນວໃດ, ປ່ຽນອາໄຫຼ່ຫຍັງ, ຜົນທົດສອບຫຼັງສ້ອມ..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-teal-500"
          />
        </Card>
      </form>

      {/* ອາໄຫຼ່ຢູ່ນອກ form — ປຸ່ມເພີ່ມ/ລຶບ ບໍ່ໃຫ້ສົ່ງໃບສ້ອມແປງ */}
      <Card
        title="ອາໄຫຼ່ທີ່ຕ້ອງປ່ຽນ"
        actions={
          <span className="flex flex-wrap items-center gap-2">
            {head.spare_requested ? (
              <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700">
                <ClipboardList className="size-3" />
                ຂໍເບີກແລ້ວ
              </span>
            ) : (
              lines.length > 0 && (
                <Link
                  href={`/stock/requests/${head.roworder}`}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#0536a9] px-3 text-xs font-semibold text-white transition hover:opacity-90"
                >
                  <ClipboardList className="size-3.5" />
                  ສ້າງໃບຂໍເບີກ
                </Link>
              )
            )}
            <Button type="button" tone="primary" className="h-8 px-3 text-xs" onClick={() => setSearching(true)}>
              <Plus className="size-3.5" />
              ເພີ່ມອາໄຫຼ່
            </Button>
          </span>
        }
      >
        {needsQuotation && lines.length > 0 && (
          <p className="mb-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle className="size-4 shrink-0" />
            ວຽກໝົດຮັບປະກັນ — ຕ້ອງມີໃບສະເໜີລາຄາທີ່ລູກຄ້າອະນຸມັດແລ້ວ ກ່ອນສາງຈຶ່ງຈ່າຍອາໄຫຼ່ອອກໃຫ້
          </p>
        )}

        {lines.length === 0 ? (
          <Empty>
            ວຽກນີ້ຍັງບໍ່ມີອາໄຫຼ່ — ຖ້າພໍລົງມືສ້ອມແລ້ວພົບວ່າຕ້ອງປ່ຽນອາໄຫຼ່ ໃຫ້ກົດ &quot;ເພີ່ມອາໄຫຼ່&quot; ຂ້າງເທິງ
            ແລ້ວກົດປຸ່ມ &quot;ສ້າງໃບຂໍເບີກ&quot; ທີ່ຈະປາກົດຂຶ້ນ — ອາໄຫຼ່ຈະອອກຈາກສາງໄດ້ກໍ່ຕໍ່ເມື່ອມີໃບຂໍເບີກ
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                  <th className="w-10 px-3 py-2 text-center font-semibold">#</th>
                  <th className="px-3 py-2 font-semibold">ອາໄຫຼ່</th>
                  <th className="w-24 px-3 py-2 text-right font-semibold">ຈຳນວນ</th>
                  <th className="w-24 px-3 py-2 font-semibold">ຫົວໜ່ວຍ</th>
                  <th className="w-32 px-3 py-2 font-semibold">ສະຖານະ</th>
                  <th className="w-12 px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <SpareRow key={line.roworder} code={head.code} line={line} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {head.spare_requested && (
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500">
            <Package className="size-3.5" />
            ສ້າງໃບຂໍເບີກແລ້ວ — ຕິດຕາມສະຖານະໄດ້ທີ່{" "}
            <Link href="/stock/requests" className="font-medium text-[#0536a9] underline">
              ໃບຂໍເບີກ
            </Link>
          </p>
        )}
      </Card>

      {searching && (
        <SpareSearchDialog
          chosen={new Set(lines.map((line) => line.item_code))}
          onAdd={(item, qty) =>
            addUsedSpare(head.code, { code: item.code, name_1: item.name_1, unit_code: item.unit_code }, qty)
          }
          onClose={() => setSearching(false)}
        />
      )}
    </div>
  );
}
