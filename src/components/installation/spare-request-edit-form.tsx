"use client";
import { updateSpareRequest, type ActionState } from "@/app/actions/installation";
import { SelectField } from "@/components/select-field";
import {
  Button,
  Card,
  Empty,
  ErrorBox,
  LinkButton,
  Table,
  inputClass,
  labelClass,
} from "@/components/ui";
import type { EditableSpareRow } from "@/lib/install-spare-edit";
import { takeField } from "@/lib/spare-take";
import { AlertTriangle, CheckCircle2, LoaderCircle, LogOut, Save } from "lucide-react";
import { useActionState, useState } from "react";
import { KeepFormValues } from "@/components/keep-form-values";

/**
 * ຟອມ "ແກ້ໃບຂໍເບີກທີ່ບັນທຶກແລ້ວ" — ຄາເລກໃບເກົ່າ.
 *
 * ຈຳນວນທຸກແຖວແກ້ໄດ້ ໃນຂອບເຂດ **0 … max** ທີ່ server ຄິດໃຫ້ (ກະຕ່າ − ໃບອື່ນ):
 *   0 = ຖອດລາຍການອອກຈາກໃບ · > 0 = ຖືໄວ້/ເພີ່ມເຂົ້າໃບ
 * ຄ່າຈາກຟອມເຊື່ອບໍ່ໄດ້ ⇒ updateSpareRequest ຕັດຊ້ຳຢູ່ຝັ່ງ server ສະເໝີ.
 */

export type Warehouse = { code: string; name_1: string };
export type Shelf = { whcode: string; code: string; name_1: string };
export type EditBalance = { total: number; byWarehouse: Record<string, number> };

export function SpareRequestEditForm({
  docNo,
  code,
  docDate,
  remark,
  whCode,
  shelfCode,
  lines,
  warehouses,
  shelves,
  balances,
}: {
  docNo: string;
  code: string;
  docDate: string;
  remark: string;
  whCode: string;
  shelfCode: string;
  lines: EditableSpareRow[];
  warehouses: Warehouse[];
  shelves: Shelf[];
  balances: Record<string, EditBalance>;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateSpareRequest,
    {},
  );
  const [wh, setWh] = useState(whCode);
  const [shelf, setShelf] = useState(shelfCode);
  const [qty, setQty] = useState<Record<string, string>>(() =>
    Object.fromEntries(lines.map((line) => [line.item_code, String(line.qty)])),
  );

  const shelfOptions = shelves.filter((row) => row.whcode === wh);
  const total = lines.reduce((sum, line) => sum + (Number(qty[line.item_code]) || 0), 0);

  return (
    <div className="space-y-5">
      {state.error && <ErrorBox>{state.error}</ErrorBox>}

      <form action={formAction} className="space-y-5">
        <KeepFormValues />
        <input type="hidden" name="doc_no" value={docNo} />
        <input type="hidden" name="product_code" value={code} />

        <Card>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex gap-2">
              <Button type="submit" tone="success" disabled={pending || total <= 0 || !wh || !shelf}>
                {pending ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                ບັນທຶກການແກ້
              </Button>
              <LinkButton
                href={`/installations/spare-requests/view/${encodeURIComponent(docNo)}`}
                tone="neutral"
              >
                <LogOut className="size-4" /> ອອກ
              </LinkButton>
            </div>
            <div className="flex flex-wrap gap-4">
              <div>
                <label className={labelClass} htmlFor="doc_date">
                  ວັນທີ
                </label>
                <input
                  id="doc_date"
                  type="date"
                  name="doc_date"
                  required
                  defaultValue={docDate}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="doc_no_view">
                  ເລກທີ
                </label>
                <input id="doc_no_view" value={docNo} readOnly className={`${inputClass} font-bold`} />
              </div>
            </div>
          </div>
        </Card>

        <Card title="ສາງ · ທີ່ເກັບ · ໝາຍເຫດ">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>
                <span className="text-brand-orange-700">*</span> ສາງ
              </label>
              <SelectField
                name="wh_code"
                value={wh}
                onChange={(value) => {
                  setWh(value);
                  setShelf("");
                }}
                placeholder="ເລືອກສາງ"
                options={warehouses.map((warehouse) => ({
                  value: warehouse.code,
                  label: `${warehouse.code} ~ ${warehouse.name_1}`,
                }))}
              />
            </div>
            <div>
              <label className={labelClass}>
                <span className="text-brand-orange-700">*</span> ທີ່ເກັບ
              </label>
              <SelectField
                name="shelf_code"
                value={shelf}
                onChange={setShelf}
                isDisabled={!wh}
                placeholder={wh ? "ເລືອກທີ່ເກັບ" : "ເລືອກສາງກ່ອນ"}
                options={shelfOptions.map((row) => ({
                  value: row.code,
                  label: `${row.code} ~ ${row.name_1}`,
                }))}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>ໝາຍເຫດ</label>
              <input name="remark" defaultValue={remark} className={inputClass} />
            </div>
          </div>
        </Card>

        <Card title={`ອາໄຫຼ່ໃນໃບນີ້ (${total.toLocaleString()} ໜ່ວຍລວມ)`}>
          {lines.length === 0 ? (
            <Empty>ບໍ່ມີລາຍການໃຫ້ແກ້</Empty>
          ) : (
            <Table
              head={["#", "ລະຫັດ", "ຊື່ອາໄຫຼ່ · ສະຕັອກ", "ສູງສຸດ", "ຈຳນວນໃນໃບນີ້", "ໜ່ວຍ"]}
              minWidth={860}
            >
              {lines.map((line, index) => {
                const balance = balances[line.item_code];
                const inWarehouse = wh ? (balance?.byWarehouse[wh] ?? 0) : null;
                const want = Number(qty[line.item_code]) || 0;
                const enough = inWarehouse !== null && inWarehouse >= want;
                return (
                  <tr key={line.item_code} className="border-b border-slate-100">
                    <td className="px-3 py-2 text-center">{index + 1}</td>
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-slate-600">
                      {line.item_code}
                    </td>
                    <td className="min-w-96 px-3 py-3">
                      <span className="block font-semibold text-slate-800">{line.item_name}</span>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {inWarehouse === null ? (
                          <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">
                            ເລືອກສາງກ່ອນ
                          </span>
                        ) : enough ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-[10px] font-semibold text-brand-800">
                            <CheckCircle2 className="size-3" /> ສາງນີ້ມີ{" "}
                            {inWarehouse.toLocaleString()}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-brand-orange-50 px-2 py-1 text-[10px] font-semibold text-brand-orange-700">
                            <AlertTriangle className="size-3" /> ສາງນີ້ມີ{" "}
                            {inWarehouse.toLocaleString()} · ຂາດ{" "}
                            {Math.max(0, want - inWarehouse).toLocaleString()}
                          </span>
                        )}
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">
                          ທຸກສາງ {(balance?.total ?? 0).toLocaleString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <b className="tabular-nums text-slate-500">
                        {line.max_qty.toLocaleString()}
                      </b>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <input
                        type="number"
                        name={takeField(line.item_code)}
                        min={0}
                        max={line.max_qty}
                        step="0.01"
                        value={qty[line.item_code] ?? "0"}
                        onChange={(event) =>
                          setQty((current) => ({
                            ...current,
                            [line.item_code]: event.target.value,
                          }))
                        }
                        className={`${inputClass} w-28 text-center tabular-nums`}
                      />
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-center text-slate-500">
                      {line.unit_code || "-"}
                    </td>
                  </tr>
                );
              })}
            </Table>
          )}
          <p className="mt-3 text-xs text-slate-400">
            ໃສ່ <b>0</b> = ຖອດລາຍການນັ້ນອອກຈາກໃບ · ຖອດອອກໝົດບໍ່ໄດ້ (ໃຫ້ໃຊ້ “ລົບໃບຂໍເບີກ” ແທນ)
          </p>
        </Card>
      </form>
    </div>
  );
}
