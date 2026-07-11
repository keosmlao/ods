"use client";
import { Elapsed } from "@/components/elapsed";
import { slaLabel, slaState, slaTone } from "@/lib/sla";
import { addSpareItem, deleteSpareItem, saveCheck, updateSpareQty } from "@/app/actions/checking";
import { useConfirm } from "@/components/confirm-dialog";
import { SelectField } from "@/components/select-field";
import { SpareSearchDialog } from "@/components/spare-search";
import { Button, Card, ErrorBox, Empty, Table, inputClass, labelClass } from "@/components/ui";
import { LoaderCircle, LogOut, Printer, RotateCcw, Save, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useState, useTransition } from "react";

/** ຖອດແບບຈາກ ods/templates/checking/checking_page.html + spare_results.html */

export type CheckHead = {
  code: string;
  registered: string | null;
  customer: string | null;
  product: string | null;
  warranty: string | null;
  issue: string | null;
  receiver: string | null;
  technician: string | null;
  /** ເລີ່ມກວດເມື່ອໃດ ແລະ ໃຊ້ເວລາໄປແລ້ວເທົ່າໃດ */
  check_started: string | null;
  check_seconds: number | null;
  service_type: string | null;
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
      <dd className={`mt-1 text-sm font-medium ${danger ? "text-[#e75555]" : "text-slate-800"}`}>{value || "-"}</dd>
    </div>
  );
}

/** ແຖວອາໄຫຼ່ໃນກະຕ່າ — ກົດຈຳນວນເພື່ອແກ້ໄຂ (ods ໃຊ້ modal /updateqty) */
function BasketRow({ code, line }: { code: string; line: BasketLine }) {
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
          title="ລຶບ"
          disabled={pending}
          onClick={async () => {
            const ok = await ask({
              title: "ລຶບລາຍການນີ້?",
              message: (
                <>
                  ອາໄຫຼ່ <b className="text-slate-700">{line.item_code}</b> ຈະຖືກລຶບອອກຈາກກະຕ່າ
                </>
              ),
              confirmLabel: "ລຶບ",
              cancelLabel: "ບໍ່",
              tone: "danger",
            });
            if (!ok) return;
            start(() => void deleteSpareItem(code, line.roworder));
          }}
          className="text-[#DE3163] transition hover:opacity-70 disabled:opacity-40"
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
              className="h-8 w-20 rounded border border-slate-300 px-2 text-right text-sm outline-none focus:border-teal-500"
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
            className="font-medium text-[#0536a9] underline"
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
  const [state, action, pending] = useActionState(saveCheck, {});
  // ມີອາໄຫຼ່ຄ້າງໃນກະຕ່າຢູ່ແລ້ວ → ເປີດຕາຕະລາງໃຫ້ເລີຍ
  const [useSpare, setUseSpare] = useState(lines.length > 0 ? "1" : "0");
  const [warByT, setWarByT] = useState("0");
  const [reason, setReason] = useState("");
  const [issue, setIssue] = useState("");
  const [searching, setSearching] = useState(false);

  function reset() {
    setIssue("");
    setWarByT("0");
    setReason("");
    setUseSpare("0");
  }

  return (
    <div className="space-y-5">
      <form action={action} className="space-y-5">
        <input type="hidden" name="code" value={head.code} />
        <input type="hidden" name="warrunty" value={head.warranty ?? ""} />

        <div className="sticky top-20 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <Button tone="success" disabled={pending}>
            {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
            {pending ? "ກຳລັງບັນທຶກ..." : "ບັນທືກ"}
          </Button>
          <Link
            href="/checking"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#DE3163] px-5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            <LogOut className="size-4" />
            ອອກ
          </Link>
          <Button type="button" tone="info" onClick={reset}>
            <RotateCcw className="size-4" />
            ລ້າງ
          </Button>
          {/* ໃບກວດເຊັກ — ເປີດແທັບໃໝ່ ຈຶ່ງບໍ່ເສຍຂໍ້ມູນທີ່ພິມຄ້າງໄວ້ໃນຟອມ */}
          <Link
            href={`/checking/${head.code}/print`}
            target="_blank"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <Printer className="size-4" />
            ພິມໃບກວດເຊັກ
          </Link>
        </div>

        {state.error && <ErrorBox>{state.error}</ErrorBox>}

        <Card title="ຂໍ້ມູນການຮັບເຄື່ອງ">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Info label="ວັນທີ" value={head.registered} />
            <Info label="ລູກຄ້າ" value={head.customer} />
            <Info label="ຊື່ສິນຄ້າ" value={head.product} />
            <Info label="ຮັບປະກັນ" value={head.warranty} />
            <Info label="ອາການເສຍ" value={head.issue} danger />
            <Info label="ຜູ້ຮັບເຄື່ອງ" value={head.receiver} danger />
            <Info label="ຊ່າງ" value={head.technician} />

            {/* ເວລາທີ່ໃຊ້ໄປໃນຂັ້ນກວດເຊັກ ພ້ອມກຳນົດເວລາ (SLA) */}
            <div>
              <dt className="text-xs text-slate-400">ກຳລັງກວດເຊັກມາ</dt>
              <dd className="mt-1 flex flex-wrap items-center gap-1.5">
                <Elapsed
                  seconds={head.check_seconds}
                  className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold ${slaTone(slaState(head.check_seconds, head.service_type)).chip}`}
                />
                {slaState(head.check_seconds, head.service_type) === "late" && (
                  <span className="rounded bg-red-100 px-1 text-[10px] font-bold text-red-700">ເກີນກຳນົດ</span>
                )}
                <span className="text-[10px] text-slate-400">
                  {head.check_started}
                  {slaLabel(head.service_type) && <span className="ml-1">· {slaLabel(head.service_type)}</span>}
                </span>
              </dd>
            </div>
          </dl>
        </Card>

        <Card title="ຜົນການກວດເຊັກ">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className={labelClass}>
                ອາການຊ່າງວິເຄາະ <span className="text-red-500">*</span>
              </label>
              <input name="isue_bytech" required value={issue} onChange={(event) => setIssue(event.target.value)} className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>
                ພິຈາລະນາປະກັນ <span className="text-red-500">*</span>
              </label>
              <SelectField
                name="war_by_t"
                value={warByT}
                onChange={(value) => setWarByT(value || "0")}
                options={[
                  { value: "0", label: "ປົກກະຕິ" },
                  { value: "1", label: "ຂໍປ່ຽນປະກັນ" },
                ]}
              />
            </div>

            <div>
              <label className={labelClass}>ເຫດຜົນ</label>
              <input name="t_reason" value={reason} onChange={(event) => setReason(event.target.value)} className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>
                ໃຊ້ອາໄຫຼ່ <span className="text-red-500">*</span>
              </label>
              {/* ຄ່ານີ້ຖືກສົ່ງອອກຜ່ານ hidden input ຂອງ SelectField (name="use_spare") */}
              <SelectField
                name="use_spare"
                value={useSpare}
                onChange={(value) => setUseSpare(value || "0")}
                options={[
                  { value: "0", label: "ບໍ່ໃຊ້ອາໃຫຼ່" },
                  { value: "1", label: "ໃຊ້ອາໄຫຼ່" },
                ]}
              />
            </div>
          </div>
        </Card>
      </form>

      {/* ຕາຕະລາງອາໄຫຼ່ຢູ່ນອກ form — ປຸ່ມເພີ່ມ/ລຶບ ບໍ່ໃຫ້ submit ໃບກວດເຊັກ */}
      {useSpare === "1" && (
        <Card
          title="ອາໄຫຼ່ທີ່ໃຊ້"
          actions={
            <Button type="button" tone="primary" className="h-8 px-3 text-xs" onClick={() => setSearching(true)}>
              <Search className="size-3.5" />
              ເລືອກ
            </Button>
          }
        >
          {lines.length === 0 ? (
            <Empty>ຍັງບໍ່ໄດ້ເລືອກອາໄຫຼ່</Empty>
          ) : (
            <Table minWidth={800} head={["-", "#", "ລະຫັດສິນຄ້າ", "ຊື່ສິນຄ້າ", "ຈຳນວນ", "ຫົວໜ່ວຍ"]}>
              {lines.map((line) => (
                <BasketRow key={line.roworder} code={head.code} line={line} />
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
