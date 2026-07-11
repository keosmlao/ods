"use client";
import type { ActionState } from "@/app/actions/installation";
import {
  cancelInstallReturnRequest,
  removeInstallReturnLine,
  saveInstallReturnRequest,
  updateInstallReturnQty,
} from "@/app/actions/installation-returns";
import { useConfirm, type ConfirmTone } from "@/components/confirm-dialog";
import { Button, Card, Empty, ErrorBox, Table, inputClass, labelClass } from "@/components/ui";
import { LogOut, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition, type ReactNode } from "react";

/** ຖອດແບບຈາກ ods: templates/stock/return_req_page_inst.html + /save_return_req_inst (tech_install.py) */

export type DraftLine = {
  roworder: number;
  item_code: string;
  item_name: string | null;
  qty: string;
  unit_code: string | null;
  max_qty: string | null;
};

export function ReturnRequestForm({
  docRef,
  productCode,
  today,
  lines,
}: {
  docRef: string;
  productCode: string;
  today: string;
  lines: DraftLine[];
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveInstallReturnRequest, {});
  const [lineError, setLineError] = useState<string>();
  const { ask, dialog } = useConfirm();

  return (
    <div className="space-y-5">
      {dialog}
      {state.error && <ErrorBox>{state.error}</ErrorBox>}
      {lineError && <ErrorBox>{lineError}</ErrorBox>}

      <Card title="ອາໄຫຼ່ທີ່ຈະສົ່ງຄືນ">
        {lines.length === 0 ? (
          <Empty>ບໍ່ມີອາໄຫຼ່ໃຫ້ສົ່ງຄືນ</Empty>
        ) : (
          <Table head={["ລຳດັບ", "ລະຫັດສິນຄ້າ", "ຊື່ສິນຄ້າ", "ຈຳນວນ", "ຫົວໜ່ວຍ", "ເບີກອອກ", ""]} minWidth={900}>
            {lines.map((line, index) => (
              <LineRow
                key={line.roworder}
                docNo={docRef}
                line={line}
                index={index + 1}
                ask={ask}
                onError={setLineError}
              />
            ))}
          </Table>
        )}
      </Card>

      <form action={formAction}>
        <Card title="ຂໍສົ່ງຄືນ">
          <input type="hidden" name="doc_ref" value={docRef} />
          <input type="hidden" name="product_code" value={productCode} />

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className={labelClass}>ເລກທີໃບເບີກ</label>
              <input readOnly value={docRef} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>ວັນທີ</label>
              <input type="date" name="doc_date" required defaultValue={today} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>ໝາຍເຫດ</label>
              <input name="remark" autoComplete="off" className={inputClass} />
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button type="submit" tone="success" disabled={pending || lines.length === 0}>
              <Save className="size-4" />
              {pending ? "ກຳລັງບັນທຶກ..." : "ບັນທືກ"}
            </Button>
            {/* ປຸ່ມ "ອອກ" ຕ້ອງລຶບແຖວຮ່າງກ່ອນ → formAction ແທນລິ້ງ (ods ໃຊ້ /back_stock_return) */}
            <Button
              type="submit"
              tone="neutral"
              formAction={cancelInstallReturnRequest}
              formNoValidate
              disabled={pending}
            >
              <LogOut className="size-4" />
              ອອກ
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}

function LineRow({
  docNo,
  line,
  index,
  ask,
  onError,
}: {
  docNo: string;
  line: DraftLine;
  index: number;
  ask: (options: { title: string; message?: ReactNode; confirmLabel?: string; cancelLabel?: string; tone?: ConfirmTone }) => Promise<boolean>;
  onError: (message?: string) => void;
}) {
  const router = useRouter();
  const [qty, setQty] = useState(String(Number(line.qty)));
  const [pending, start] = useTransition();

  return (
    <tr className="border-b border-slate-100">
      <td className="px-3 py-2 text-center">{index}</td>
      <td className="whitespace-nowrap px-3 py-2">{line.item_code}</td>
      <td className="px-3 py-2">{line.item_name ?? "-"}</td>
      <td className="px-3 py-2 text-center">
        <input
          type="number"
          min="1"
          step="any"
          value={qty}
          disabled={pending}
          className={`${inputClass} w-24 text-center`}
          onChange={(event) => setQty(event.target.value)}
          onBlur={() => {
            const value = Number(qty);
            if (value === Number(line.qty)) return;
            if (!Number.isFinite(value) || value <= 0) {
              setQty(String(Number(line.qty)));
              return;
            }
            start(async () => {
              const result = await updateInstallReturnQty(docNo, line.roworder, value);
              if (result.error) {
                onError(result.error);
                setQty(String(Number(line.qty)));
              } else {
                onError(undefined);
                router.refresh();
              }
            });
          }}
        />
      </td>
      <td className="px-3 py-2 text-center">{line.unit_code ?? "-"}</td>
      <td className="px-3 py-2 text-center text-slate-400">
        {line.max_qty === null ? "-" : Number(line.max_qty)}
      </td>
      <td className="px-3 py-2 text-center">
        <button
          type="button"
          title="ບໍ່ເອົາລາຍການນີ້"
          disabled={pending}
          className="text-slate-500 hover:text-red-600 disabled:opacity-50"
          onClick={async () => {
            const ok = await ask({
              title: "ຖິ້ມລາຍການນີ້?",
              message: (
                <>
                  ອາໄຫຼ່ <b className="text-slate-700">{line.item_code}</b>
                </>
              ),
              confirmLabel: "ຖິ້ມ",
              cancelLabel: "ບໍ່",
              tone: "danger",
            });
            if (!ok) return;
            start(async () => {
              const result = await removeInstallReturnLine(docNo, line.roworder);
              if (result.error) onError(result.error);
              else router.refresh();
            });
          }}
        >
          <Trash2 className="size-4" />
        </button>
      </td>
    </tr>
  );
}
