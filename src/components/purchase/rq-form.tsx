"use client";
import { addPriceRqOrder, saveRequestOrder } from "@/app/actions/purchase";
import { SelectField } from "@/components/select-field";
import { Button, Card, Empty, ErrorBox, inputClass, labelClass, LinkButton, Table } from "@/components/ui";
import { LoaderCircle, LogOut, Save } from "lucide-react";
import Image from "next/image";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";

/** ຖອດແບບຈາກ ods: templates/request_order/add_request_order.html */

export type RqHead = {
  doc_no: string;
  doc_date: string | null;
  customer: string | null;
  cust_code: string | null;
  product: string | null;
  model: string | null;
  sn: string | null;
  issue: string | null;
  warranty: string | null;
  product_code: string;
  source_type: "request" | "check";
};

export type RqLine = {
  roworder: number;
  item_code: string;
  item_name: string | null;
  qty: string;
  unit_code: string | null;
  balance_qty: string | null;
  price: string;
  sum_amount: string;
};

const money = (value: string | number) =>
  Number(value ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** ແຖວອາໄຫຼ່ + ຟອມໃສ່ລາຄາ (ຄື /add_price_rqorder) */
function PriceRow({ line, index, head }: { line: RqLine; index: number; head: RqHead }) {
  const [state, action, pending] = useActionState(addPriceRqOrder, {});

  if (head.source_type === "check") {
    return (
      <tr className="border-b border-slate-100">
        <td className="px-3 py-2 text-center">{index + 1}</td>
        <td className="px-3 py-2">{line.item_code}</td>
        <td className="px-3 py-2">{line.item_name}</td>
        <td className="px-3 py-2 text-center">{Number(line.qty)}</td>
        <td className="px-3 py-2 text-center">{line.unit_code}</td>
        <td className="px-3 py-2 text-right">
          <input
            form="purchase-request-form"
            name={`price_${line.roworder}`}
            type="number"
            min="0"
            step="0.01"
            defaultValue={Number(line.price)}
            required
            aria-label={`ລາຄາ ${line.item_code}`}
            className={`${inputClass} h-8 w-28 text-right`}
          />
        </td>
        <td className="px-3 py-2 text-right font-semibold text-slate-400">ຄິດຕອນບັນທຶກ</td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-slate-100">
      <td className="px-3 py-2 text-center">{index + 1}</td>
      <td className="px-3 py-2">{line.item_code}</td>
      <td className="px-3 py-2">{line.item_name}</td>
      <td className="px-3 py-2 text-center">{Number(line.qty)}</td>
      <td className="px-3 py-2 text-center">{line.unit_code}</td>
      <td className="px-3 py-2">
        <form action={action} className="flex items-center justify-end gap-2">
          <input type="hidden" name="roworder" value={line.roworder} />
          <input type="hidden" name="product_code" value={head.product_code} />
          <input type="hidden" name="doc_ref" value={head.doc_no} />
          <input
            name="price"
            defaultValue={Number(line.price)}
            aria-label="ລາຄາ"
            className={`${inputClass} h-8 w-28 text-right`}
          />
          <Button type="submit" disabled={pending} className="h-8 px-3 text-xs">
            {pending ? <LoaderCircle className="size-4 animate-spin" /> : "ບັນທຶກ"}
          </Button>
        </form>
        {state.error && <p className="mt-1 text-right text-xs text-red-600">{state.error}</p>}
      </td>
      <td className="px-3 py-2 text-right font-semibold">{money(line.sum_amount)}</td>
    </tr>
  );
}

export function RqForm({ head, lines, docNo, today }: { head: RqHead; lines: RqLine[]; docNo: string; today: string }) {
  const [state, save, saving] = useActionState(saveRequestOrder, {});
  const [preview, setPreview] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const total = useMemo(() => lines.reduce((sum, line) => sum + Number(line.sum_amount), 0), [lines]);

  return (
    <div className="w-full space-y-5">
      {state.error && <ErrorBox>{state.error}</ErrorBox>}

      {/**
       * ຢ່າໃສ່ `encType`/`method` ເອງ — `action` ເປັນ server action ⇒ React ຕັ້ງ
       * multipart/form-data ໃຫ້ອັດຕະໂນມັດ (ໄຟລ໌ແນບ `file1` ຈຶ່ງສົ່ງໄດ້ຢູ່ແລ້ວ).
       * ໃສ່ເອງ = React ເຕືອນ "They will get overridden" ແລ້ວຂຽນທັບຢູ່ດີ.
       */}
      <form id="purchase-request-form" action={save} className="space-y-5">
        <input type="hidden" name="doc_ref" value={head.doc_no} />
        <input type="hidden" name="product_code" value={head.product_code} />
        <input type="hidden" name="cust_code" value={head.cust_code ?? ""} />
        <input type="hidden" name="source_type" value={head.source_type} />

        <Card>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex gap-2">
              <Button type="submit" tone="success" disabled={saving || lines.length === 0}>
                {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
                ບັນທືກ
              </Button>
              <LinkButton href="/purchase-requests" tone="neutral">
                <LogOut className="size-4" />
                ອອກ
              </LinkButton>
            </div>
            <div className="flex flex-wrap gap-4">
              <div>
                <label className={labelClass} htmlFor="doc_date">ວັນທີ</label>
                <input id="doc_date" type="date" name="doc_date" required defaultValue={today} className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="doc_no">ເລກທີ</label>
                <input id="doc_no" value={docNo} readOnly className={`${inputClass} font-bold`} />
              </div>
            </div>
          </div>
        </Card>

        <Card title={head.source_type === "check" ? "ຂໍ້ມູນຈາກຜົນກວດເຊັກ" : "ຂໍ້ມູນໃບຂໍເບີກ"}>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <Field label={head.source_type === "check" ? "ອ້າງອີງຜົນກວດ" : "ເລກທິໃບຂໍເບີກ"} value={head.doc_no} />
            <Field label="ວັນທີ" value={head.doc_date} />
            <Field label="ລູກຄ້າ" value={head.customer} />
            <Field label="ຊື່ສິນຄ້າ" value={head.product} />
            <Field label="ລູ້ນ/Model" value={head.model} />
            <Field label="ເລກເຄື່ອງ/sn" value={head.sn} />
            <Field label="ອາການເສຍ" value={head.issue} wide />
          </dl>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>
                <span className="text-red-500">*</span> ສະຖານະ
              </label>
              <SelectField
                name="status_doc"
                defaultValue="Normal"
                options={[
                  { value: "Urgent", label: "ດ່ວນ" },
                  { value: "Normal", label: "ປົກກະຕິ" },
                ]}
              />
            </div>
            <div>
              <label className={labelClass}>
                <span className="text-red-500">*</span> ປະກັນ
              </label>
              <SelectField
                name="wanrunty"
                defaultValue={head.warranty === "ຮັບປະກັນ" ? "Warranty" : head.warranty === "ໝົດຮັບປະກັນ" ? "Out of Warranty" : ""}
                options={[
                  { value: "Warranty", label: "ຮັບປະກັນ" },
                  { value: "Out of Warranty", label: "ໝົດຮັບປະກັນ" },
                ]}
              />
            </div>
            {/**
             * ສາຂາທີ່ຈະສັ່ງຊື້ຜ່ານ — ຄ່າຕົງກັບ erp_branch_list.code ຂອງ ERP.
             * ແຕ່ກ່ອນລະບົບເດົາເອົາຈາກຂໍ້ມູນສິນຄ້າ (ic_inventory_branch) ແລ້ວແຍກໃບ SPR ຕາມນັ້ນ
             * ⇒ ຄົນທີ່ຮູ້ວ່າຕົວນີ້ຕ້ອງສັ່ງຜ່ານໄທ ບອກລະບົບບໍ່ໄດ້. ດຽວນີ້ເລືອກເອງ ແລະ
             * ຄ່ານີ້ຄືຄຳສັ່ງໄປຫາຝ່າຍຈັດຊື້ວ່າໃຫ້ອອກໃບຢູ່ສາຂາໃດໃນ ERP.
             */}
            <div>
              <label className={labelClass}>
                <span className="text-red-500">*</span> ສັ່ງຊື້ຜ່ານສາຂາ
              </label>
              <SelectField
                name="branch_code"
                defaultValue="05"
                options={[
                  { value: "05", label: "ໂອດ່ຽນໄທ" },
                  { value: "00", label: "ໂອດ່ຽນ (ສຳນັກງານໃຫ່ຍ)" },
                ]}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor="remark">ໝາຍເຫດ (ຫາກມີ)</label>
              <input id="remark" type="text" name="remark" className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="file1">
                ເເນບເອກະສານ <span className="text-red-500">*</span>
              </label>
              <input
                id="file1"
                ref={inputRef}
                type="file"
                name="file1"
                accept="image/*"
                required
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  setPreview((old) => {
                    if (old) URL.revokeObjectURL(old);
                    return file ? URL.createObjectURL(file) : "";
                  });
                }}
                className="w-full text-xs file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-2"
              />
            </div>
            <div className="grid h-32 place-items-center overflow-hidden rounded-lg bg-slate-50">
              {preview ? (
                <Image src={preview} alt="" width={180} height={128} unoptimized className="size-full object-contain" />
              ) : (
                <span className="text-xs text-slate-400">ບໍ່ມີຮູບ</span>
              )}
            </div>
          </div>
        </Card>
      </form>

      <Card title="ອາໄຫຼ່ທີ່ໃຊ້">
        {lines.length === 0 ? (
          <Empty>ບໍ່ມີອາໄຫຼ່ທີ່ຕ້ອງສັ່ງຊື້</Empty>
        ) : (
          <Table head={["#", "ລະຫັດສິນຄ້າ", "ຊື່ສິນຄ້າ", "ຈຳນວນ", "ຫົວໜ່ວຍ", "ລາຄາ", "ລວມ"]} minWidth={900}>
            {lines.map((line, index) => (
              <PriceRow key={line.roworder} line={line} index={index} head={head} />
            ))}
            <tr className="bg-slate-50 font-bold">
              <td colSpan={6} className="px-3 py-3 text-right">ລວມ</td>
              <td className="px-3 py-3 text-right">{money(total)}</td>
            </tr>
          </Table>
        )}
      </Card>
    </div>
  );
}

function Field({ label, value, wide }: { label: string; value: string | null; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-slate-800">{value || "-"}</dd>
    </div>
  );
}
