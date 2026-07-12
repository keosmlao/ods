"use client";
import { savePr } from "@/app/actions/purchase";
import { useConfirm } from "@/components/confirm-dialog";
import { Button, Card, Empty, ErrorBox, inputClass, labelClass, LinkButton, Table } from "@/components/ui";
import { LoaderCircle, LogOut, Save } from "lucide-react";
import { useActionState, useRef } from "react";

/** ຖອດແບບຈາກ ods: orderspare.py showsparefororder() (templates/stock/pr/pagepr.html) */

export type SprHead = {
  doc_no: string;
  doc_date: string | null;
  customer: string | null;
  product: string | null;
  model: string | null;
  sn: string | null;
  issue: string | null;
  warranty: string | null;
  p_access: string | null;
  issue_2: string | null;
  product_code: string;
  item_code: string;
};

export type SprLine = { roworder: number; item_code: string; item_name: string | null; qty: string; unit_code: string | null };

export function SprForm({ head, lines, docNo, today }: { head: SprHead; lines: SprLine[]; docNo: string; today: string }) {
  const [state, save, saving] = useActionState(savePr, {});
  const formRef = useRef<HTMLFormElement>(null);
  const { ask, dialog } = useConfirm();

  return (
    <div className="w-full space-y-5">
      {dialog}
      {state.error && <ErrorBox>{state.error}</ErrorBox>}

      <form ref={formRef} action={save} className="space-y-5">
        <input type="hidden" name="doc_ref" value={head.doc_no} />
        <input type="hidden" name="product_code" value={head.product_code} />
        <input type="hidden" name="item_code" value={head.item_code} />

        <Card>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex gap-2">
              {/* ໃບນີ້ລົງ ERP ທັນທີ ໂດຍບໍ່ຜ່ານຜູ້ອະນຸມັດ — ຖາມຢືນຢັນກ່ອນ */}
              <Button
                type="button"
                tone="success"
                disabled={saving}
                onClick={async () => {
                  const ok = await ask({
                    title: "ອອກໃບສັ່ງຊື້ອາໄຫຼ່?",
                    message: (
                      <>
                        ໃບສັ່ງຊື້ <b className="text-slate-700">{docNo}</b> ຈະລົງລະບົບ ERP ທັນທີ (ບໍ່ຜ່ານໃບຂໍອະນຸມັດ)
                        ແລະ ຖອນຄືນບໍ່ໄດ້
                        <span className="mt-1 block text-slate-500">{head.item_code}</span>
                      </>
                    ),
                    confirmLabel: "ອອກໃບສັ່ງຊື້",
                  });
                  if (ok) formRef.current?.requestSubmit();
                }}
              >
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

        <Card title="ຂໍ້ມູນໃບຂໍເບີກ">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <Field label="ເລກທິໃບຂໍເບີກ" value={head.doc_no} />
            <Field label="ວັນທີ" value={head.doc_date} />
            <Field label="ລູກຄ້າ" value={head.customer} />
            <Field label="ຊື່ສິນຄ້າ" value={head.product} />
            <Field label="ລູ້ນ/Model" value={head.model} />
            <Field label="ເລກເຄື່ອງ/sn" value={head.sn} />
            <Field label="ອາການເສຍ" value={head.issue} />
            <Field label="ປະກັນ" value={head.warranty} />
            <Field label="ອາການຊ່າງ" value={head.issue_2} />
            <Field label="ອຸປະກອນມາກັບເຄື່ອງ" value={head.p_access} />
          </dl>
          <div className="mt-4">
            <label className={labelClass} htmlFor="remark">ໝາຍເຫດ</label>
            <input id="remark" type="text" name="remark" className={inputClass} />
          </div>
        </Card>
      </form>

      <Card title="ອາໄຫຼ່ທີ່ໃຊ້">
        {lines.length === 0 ? (
          <Empty />
        ) : (
          <Table head={["#", "ລະຫັດສິນຄ້າ", "ຊື່ສິນຄ້າ", "ຈຳນວນ", "ຫົວໜ່ວຍ"]} minWidth={700}>
            {lines.map((line, index) => (
              <tr key={line.roworder} className="border-b border-slate-100">
                <td className="px-3 py-2 text-center">{index + 1}</td>
                <td className="px-3 py-2">{line.item_code}</td>
                <td className="px-3 py-2">{line.item_name}</td>
                <td className="px-3 py-2 text-center">{Number(line.qty)}</td>
                <td className="px-3 py-2 text-center">{line.unit_code}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-slate-800">{value || "-"}</dd>
    </div>
  );
}
