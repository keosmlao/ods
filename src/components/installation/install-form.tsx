"use client";
import { createInstall, type ActionState } from "@/app/actions/installation";
import { SelectField } from "@/components/select-field";
import { Button, Card, ErrorBox, LinkButton, inputClass, labelClass } from "@/components/ui";
import { Save, Search } from "lucide-react";
import { useActionState, useEffect, useState } from "react";

/** ຖອດແບບຈາກ ods: install_create.html + /save_install_create + /search_sml_install */

type Category = { code: string; name_1: string };

type Bill = {
  doc_date: string;
  doc_no: string;
  item_code: string;
  item_name: string;
  qty: string;
  cust_code: string | null;
  cust_name: string | null;
  telephone: string | null;
  address: string | null;
  sv_type: string;
  item_brand: string | null;
  doc_date_raw: string;
};

const empty = { doc_no: "", billdate: "", item_code: "", item_name: "", sv_type: "", cust_code: "",
  custname: "", tel: "", address: "", pro_brand: "" };

export function InstallForm({ categories, username }: { categories: Category[]; username: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createInstall, {});
  const [picked, setPicked] = useState(empty);
  const [open, setOpen] = useState(false);

  return (
    <form action={formAction} className="space-y-5">
      {state.error && <ErrorBox>{state.error}</ErrorBox>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <Button type="submit" tone="success" disabled={pending}>
            <Save className="size-4" />
            {pending ? "ກຳລັງບັນທຶກ..." : "ບັນທືກ"}
          </Button>
          <LinkButton href="/installations" tone="danger">ອອກ</LinkButton>
        </div>
        <div className="flex items-center gap-2">
          <span className={labelClass}>ຜູ້ສ້າງ</span>
          <input readOnly value={username} className={`${inputClass} w-40`} />
        </div>
      </div>

      <Card title="ຂໍ້ມູນລູກຄ້າ">
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label className={labelClass}>ລູກຄ້າ</label>
            <input name="cust_code" readOnly required value={picked.cust_code} className={inputClass} />
          </div>
          <div className="md:col-span-3">
            <label className={labelClass}>ຊື່</label>
            <input name="custname" readOnly required value={picked.custname} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>ເບີໂທ</label>
            <input name="tel" readOnly value={picked.tel} className={inputClass} />
          </div>
          <div className="md:col-span-3">
            <label className={labelClass}>ທີ່ຢູ່</label>
            <input name="address" readOnly value={picked.address} className={inputClass} />
          </div>
        </div>
      </Card>

      <Card
        title="ບີນຂາຍ"
        actions={
          <Button type="button" tone="info" onClick={() => setOpen(true)}>
            <Search className="size-4" /> ຄົ້ນຫາບີນຂາຍ
          </Button>
        }
      >
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label className={labelClass}>ບິນເລກທີ</label>
            <input name="doc_no" readOnly required value={picked.doc_no} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>ວັນທີອອກບີນ</label>
            <input type="date" name="billdate" readOnly required value={picked.billdate} className={inputClass} />
          </div>
        </div>
      </Card>

      <Card title="ລາຍການສິນຄ້າ">
        <input type="hidden" name="item_code" value={picked.item_code} />
        <input type="hidden" name="sv_type" value={picked.sv_type} />
        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className={labelClass}>ຊື່ສິນຄ້າ *</label>
            <input name="item_name" readOnly required value={picked.item_name} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>ຍີ່ຫໍ້/Brand *</label>
            <input name="pro_brand" readOnly value={picked.pro_brand} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>ລູ້ນ/Model *</label>
            <input name="pro_model" required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>ປະເພດ *</label>
            <SelectField
              name="pro_type"
              options={categories.map((category) => ({ value: category.code, label: category.name_1 }))}
            />
          </div>
          <div>
            <label className={labelClass}>ຂະໜາດ *</label>
            <input name="pro_size" required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>S/N *</label>
            <input name="pro_sn" required className={inputClass} />
          </div>
        </div>
      </Card>

      <Card title="ຂໍ້ມູນຕິດຕັ້ງ">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={labelClass}>ສະຖານທີ່ຕິດຕັ້ງ</label>
            <input name="location_inst" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>ໝາຍເຫດ</label>
            <input name="remark" className={inputClass} />
          </div>
        </div>
      </Card>

      {open && (
        <BillPicker
          onClose={() => setOpen(false)}
          onPick={(bill) => {
            setPicked({
              doc_no: bill.doc_no,
              billdate: bill.doc_date_raw,
              item_code: bill.item_code,
              item_name: bill.item_name,
              sv_type: bill.sv_type,
              cust_code: bill.cust_code ?? "",
              custname: bill.cust_name ?? "",
              tel: bill.telephone ?? "",
              address: bill.address ?? "",
              pro_brand: bill.item_brand ?? "",
            });
            setOpen(false);
          }}
        />
      )}
    </form>
  );
}

/** ໜ້າຕ່າງຄົ້ນຫາບີນຂາຍຈາກ ERP */
function BillPicker({ onClose, onPick }: { onClose: () => void; onPick: (bill: Bill) => void }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/installations/bills?q=${encodeURIComponent(q)}`);
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
      <div className="flex max-h-[85vh] w-full max-w-5xl flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-center gap-3 border-b border-slate-100 p-4">
          <Search className="size-4 shrink-0 text-slate-400" />
          <input
            autoFocus
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="ຄົ້ນຫາເລກບີນ..."
            className="w-full text-sm outline-none"
          />
          <Button type="button" tone="neutral" onClick={onClose}>ອອກ</Button>
        </div>
        <div className="overflow-auto p-4">
          <table className="w-full border-collapse text-sm" style={{ minWidth: 900 }}>
            <thead>
              <tr className="border-y border-slate-200 bg-slate-50 text-slate-600">
                {["ວັນທີບິນ", "ເລກທີບິນ", "ລາຍການ", "ຈຳນວນຕິດຕັ້ງ", "ຊື່ລູກຄ້າ", "ເບີໂທ", "ທີ່ຢູ່", ""].map((head) => (
                  <th key={head} className="whitespace-nowrap px-3 py-2 text-center font-semibold">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((bill, index) => (
                <tr key={`${bill.doc_no}-${bill.item_code}-${index}`} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="whitespace-nowrap px-3 py-2">{bill.doc_date}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-semibold">{bill.doc_no}</td>
                  <td className="px-3 py-2">{bill.item_name}</td>
                  <td className="px-3 py-2 text-center">{Number(bill.qty)}</td>
                  <td className="px-3 py-2">{bill.cust_name}</td>
                  <td className="whitespace-nowrap px-3 py-2">{bill.telephone}</td>
                  <td className="px-3 py-2">{bill.address}</td>
                  <td className="px-3 py-2">
                    <Button type="button" tone="success" onClick={() => onPick(bill)}>ເລືອກ</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && rows.length === 0 && <p className="py-10 text-center text-sm text-slate-400">ບໍ່ພົບລາຍການ</p>}
          {loading && <p className="py-10 text-center text-sm text-slate-400">ກຳລັງໂຫລດ...</p>}
        </div>
      </div>
    </div>
  );
}
