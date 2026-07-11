"use client";
import {
  addSpareLine,
  deleteSpareLine,
  saveSpareRequest,
  updateSpareQty,
  type ActionState,
} from "@/app/actions/installation";
import type { SpareRow } from "@/app/api/installations/spares/route";
import { SelectField } from "@/components/select-field";
import { Button, Card, Empty, ErrorBox, LinkButton, Table, inputClass, labelClass } from "@/components/ui";
import { Plus, Save, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";

/** ຖອດແບບຈາກ ods: req_page.html + /in_add_req + /additemtoreg_inst + /delete_item_sion
 *  + /update_qty_reg_spare + /save_in_req (tech_reg_install.py) */

export type SpareLine = {
  roworder: number;
  item_code: string;
  item_name: string;
  qty: string;
  unit_code: string | null;
};

type Warehouse = { code: string; name_1: string };

export function SpareRequestForm({
  code,
  today,
  lines,
  warehouses,
}: {
  code: string;
  today: string;
  lines: SpareLine[];
  warehouses: Warehouse[];
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveSpareRequest, {});
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-5">
      {state.error && <ErrorBox>{state.error}</ErrorBox>}

      <Card
        title="ອຸປະກອນຕິດຕັ້ງ"
        actions={
          <Button type="button" tone="info" onClick={() => setOpen(true)}>
            <Plus className="size-4" /> ເພີ່ມອາໄຫຼ່
          </Button>
        }
      >
        {lines.length === 0 ? (
          <Empty>ບໍ່ມີລາຍການອາໄຫຼ່</Empty>
        ) : (
          <Table head={["ລຳດັບ", "ລະຫັດ", "ຊື່ອຸປະກອນ", "ຈຳນວນ", "ຫົວໜ່ວຍ", ""]} minWidth={800}>
            {lines.map((line, index) => (
              <LineRow key={line.roworder} code={code} line={line} index={index + 1} />
            ))}
          </Table>
        )}
      </Card>

      <form action={formAction}>
        <Card title="ຂໍເບີກ">
          <input type="hidden" name="product_code" value={code} />
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className={labelClass}>ວັນທີ</label>
              <input type="date" name="doc_date" required defaultValue={today} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>ສາງ</label>
              <SelectField
                name="wh_code"
                options={warehouses.map((warehouse) => ({
                  value: warehouse.code,
                  label: `${warehouse.code} ~ ${warehouse.name_1}`,
                }))}
              />
            </div>
            <div>
              <label className={labelClass}>ຊັ້ນວາງ</label>
              <input name="shelf_code" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>ໝາຍເຫດ</label>
              <input name="remark" className={inputClass} />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button type="submit" tone="success" disabled={pending || lines.length === 0}>
              <Save className="size-4" />
              {pending ? "ກຳລັງບັນທຶກ..." : "ບັນທືກ"}
            </Button>
            <LinkButton href="/installations/spare-requests" tone="danger">ອອກ</LinkButton>
          </div>
        </Card>
      </form>

      {open && <SparePicker code={code} onClose={() => setOpen(false)} />}
    </div>
  );
}

function LineRow({ code, line, index }: { code: string; line: SpareLine; index: number }) {
  const router = useRouter();
  const [qty, setQty] = useState(String(Number(line.qty)));
  const [pending, start] = useTransition();

  return (
    <tr className="border-b border-slate-100">
      <td className="px-3 py-2 text-center">{index}</td>
      <td className="whitespace-nowrap px-3 py-2">{line.item_code}</td>
      <td className="px-3 py-2">{line.item_name}</td>
      <td className="px-3 py-2 text-center">
        <input
          type="number"
          min="1"
          step="1"
          value={qty}
          disabled={pending}
          className={`${inputClass} w-24 text-center`}
          onChange={(event) => setQty(event.target.value)}
          onBlur={() => {
            const value = Number(qty);
            if (value === Number(line.qty) || !Number.isFinite(value) || value <= 0) return;
            start(async () => {
              await updateSpareQty(code, line.roworder, value);
              router.refresh();
            });
          }}
        />
      </td>
      <td className="px-3 py-2 text-center">{line.unit_code}</td>
      <td className="px-3 py-2 text-center">
        <button
          type="button"
          title="ລົບ"
          disabled={pending}
          className="text-slate-500 hover:text-red-600 disabled:opacity-50"
          onClick={() =>
            start(async () => {
              await deleteSpareLine(code, line.roworder);
              router.refresh();
            })
          }
        >
          <Trash2 className="size-4" />
        </button>
      </td>
    </tr>
  );
}

function SparePicker({ code, onClose }: { code: string; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<SpareRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/installations/spares?q=${encodeURIComponent(q)}`);
        const json = await response.json();
        setRows(json.data ?? []);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-center gap-3 border-b border-slate-100 p-4">
          <Search className="size-4 shrink-0 text-slate-400" />
          <input
            autoFocus
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="ຄົ້ນຫາອາໄຫຼ່..."
            className="w-full text-sm outline-none"
          />
          <Button type="button" tone="neutral" onClick={onClose}>ອອກ</Button>
        </div>
        <div className="overflow-auto p-4">
          <Table head={["#", "ລະຫັດ", "ລາຍການ/Part-Number", "ຫົວໜ່ວຍ", "ຄົງເຫຼືອ", ""]} minWidth={700}>
            {rows.map((row, index) => (
              <tr key={row.code} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2 text-center">{index + 1}</td>
                <td className="whitespace-nowrap px-3 py-2">{row.code}</td>
                <td className="px-3 py-2">{row.name_1}</td>
                <td className="px-3 py-2 text-center">{row.unit_code}</td>
                <td className="px-3 py-2 text-right">{row.balance_qty}</td>
                <td className="px-3 py-2 text-center">
                  <Button
                    type="button"
                    tone="success"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        await addSpareLine(code, row.code, row.name_1, row.unit_code ?? "");
                        router.refresh();
                        onClose();
                      })
                    }
                  >
                    ເລືອກ
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
          {!loading && rows.length === 0 && <p className="py-10 text-center text-sm text-slate-400">ບໍ່ພົບລາຍການ</p>}
          {loading && <p className="py-10 text-center text-sm text-slate-400">ກຳລັງໂຫລດ...</p>}
        </div>
      </div>
    </div>
  );
}
