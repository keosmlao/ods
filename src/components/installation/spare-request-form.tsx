"use client";
import {
  addSpareLine,
  deleteSpareLine,
  saveSpareRequest,
  type ActionState,
} from "@/app/actions/installation";
import type { SpareRow } from "@/app/api/installations/spares/route";
import type { JobHead } from "@/components/installation/job-header";
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
import { useDict } from "@/lib/i18n/context";
import {
  AlertTriangle,
  CheckCircle2,
  LoaderCircle,
  LogOut,
  Plus,
  Save,
  Search,
  Trash2,
} from "lucide-react";
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

type SpareRequestFormDict = ReturnType<typeof useDict>["spareRequestForm"];

export type Warehouse = { code: string; name_1: string };
export type Shelf = { whcode: string; code: string; name_1: string };
export type SpareBalance = {
  total: number;
  byWarehouse: Record<string, number>;
  byLocation: Record<string, number>;
};

export function SpareRequestForm({
  code,
  head,
  requestNo,
  today,
  lines,
  warehouses,
  shelves,
  balances,
}: {
  code: string;
  head: JobHead;
  requestNo: string;
  today: string;
  lines: SpareLine[];
  warehouses: Warehouse[];
  /** ທີ່ເກັບຂອງແຕ່ລະສາງ (ic_shelf ຂອງ ERP) — ກອງຕາມສາງທີ່ເລືອກ */
  shelves: Shelf[];
  balances: Record<string, SpareBalance>;
}) {
  const t = useDict().spareRequestForm;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    saveSpareRequest,
    {},
  );
  const [open, setOpen] = useState(false);

  /**
   * ── ສາງ ແລະ ທີ່ເກັບ ຕ້ອງລະບຸ **ຕັ້ງແຕ່ຕອນຂໍເບີກ** ──
   * ຂໍ້ມູນຈິງ: ໃບຂໍເບີກ **2,518 ໃບ ບໍ່ມີທັງສາງ ແລະ ທີ່ເກັບ** ເພາະ "ຊັ້ນວາງ" ເປັນຊ່ອງພິມມື
   * (ຄົນປະຫວ່າງໄວ້) ⇒ ສາງບໍ່ຮູ້ວ່າຈະໄປຢິບຢູ່ຫ້ອງໃດ ແລະ ເອກະສານທີ່ຈະສົ່ງເຂົ້າ ERP
   * ກໍ່ຂາດ wh_code/shelf_code ທີ່ ERP ຕ້ອງການ.
   * ດຽວນີ້ **ທັງສອງເປັນ dropdown ບັງຄັບ** ແລະ ທີ່ເກັບຂຶ້ນຕາມສາງທີ່ເລືອກ.
   */
  const [wh, setWh] = useState("");
  const [shelf, setShelf] = useState("");
  const shelfOptions = shelves.filter((row) => row.whcode === wh);
  const warehouseOptions = warehouses.map((warehouse) => {
    const available = lines.filter(
      (line) =>
        (balances[line.item_code]?.byWarehouse[warehouse.code] ?? 0) > 0,
    ).length;
    const enough = lines.filter(
      (line) =>
        (balances[line.item_code]?.byWarehouse[warehouse.code] ?? 0) >=
        Number(line.qty),
    ).length;
    return {
      value: warehouse.code,
      label: `${warehouse.code} ~ ${warehouse.name_1} · ${t.has} ${available}/${lines.length} · ${t.enough} ${enough}/${lines.length}`,
    };
  });

  return (
    <div className="space-y-5">
      {state.error && <ErrorBox>{state.error}</ErrorBox>}

      <form action={formAction} className="space-y-5">
        <input type="hidden" name="product_code" value={code} />

        {/* ໂຄງດຽວກັບໃບສະເໜີຊື້: action ຊ້າຍ, ວັນທີ/ເລກທີຂວາ */}
        <Card>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex gap-2">
              <Button
                type="submit"
                tone="success"
                disabled={pending || lines.length === 0 || !wh || !shelf}
              >
                {pending ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                {t.save}
              </Button>
              <LinkButton href="/installations/spare-requests" tone="neutral">
                <LogOut className="size-4" />
                {t.exit}
              </LinkButton>
            </div>
            <div className="flex flex-wrap gap-4">
              <div>
                <label className={labelClass} htmlFor="doc_date">
                  {t.date}
                </label>
                <input
                  id="doc_date"
                  type="date"
                  name="doc_date"
                  required
                  defaultValue={today}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="doc_no">
                  {t.docNo}
                </label>
                <input
                  id="doc_no"
                  value={requestNo}
                  readOnly
                  className={`${inputClass} font-bold`}
                />
              </div>
            </div>
          </div>
        </Card>

        <Card title={t.requestInfoTitle}>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <Field label={t.installJobNo} value={head.code} />
            <Field label={t.jobOpenDate} value={head.time_register} />
            <Field
              label={t.customer}
              value={`${head.cust_code ?? ""}${head.cust_name ? ` - ${head.cust_name}` : ""}`}
            />
            <Field label={t.itemName} value={head.item_name} />
            <Field label={t.brand} value={head.pro_brand} />
            <Field label={t.model} value={head.pro_model} />
            <Field label={t.type} value={head.pro_type} />
            <Field label={t.size} value={head.pro_size} />
          </dl>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>
                <span className="text-red-500">*</span> {t.warehouse}
              </label>
              <SelectField
                name="wh_code"
                value={wh}
                onChange={(value) => {
                  setWh(value);
                  setShelf("");
                }}
                placeholder={t.selectWarehousePlaceholder}
                options={warehouseOptions}
              />
            </div>
            <div>
              <label className={labelClass}>
                <span className="text-red-500">*</span> {t.storage}
              </label>
              <SelectField
                name="shelf_code"
                value={shelf}
                onChange={setShelf}
                isDisabled={!wh}
                placeholder={wh ? t.selectStoragePlaceholder : t.selectWarehouseFirst}
                options={shelfOptions.map((row) => ({
                  value: row.code,
                  label: `${row.code} ~ ${row.name_1}`,
                }))}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>{t.remark}</label>
              <input name="remark" className={inputClass} />
            </div>
          </div>
          {warehouses.length === 0 && (
            <p className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-xs font-semibold text-red-700">
              <AlertTriangle className="size-4" /> {t.noSparesInErp}
            </p>
          )}
        </Card>

        <Card
          title={t.sparesUsedTitle}
          actions={
            <Button
              type="button"
              tone="info"
              disabled={!wh}
              onClick={() => setOpen(true)}
            >
              <Plus className="size-4" /> {t.addSpare}
            </Button>
          }
        >
          {lines.length === 0 ? (
            <Empty>{t.noSpareLines}</Empty>
          ) : (
            <Table
              head={[
                "#",
                t.colItemCode,
                t.colItemNameStock,
                t.colQty,
                t.colUnit,
                "",
              ]}
              minWidth={900}
            >
              {lines.map((line, index) => (
                <LineRow
                  key={line.roworder}
                  t={t}
                  code={code}
                  line={line}
                  index={index + 1}
                  selectedWarehouse={wh}
                  balance={balances[line.item_code]}
                  warehouses={warehouses}
                />
              ))}
            </Table>
          )}
        </Card>
      </form>

      {open && <SparePicker t={t} code={code} onClose={() => setOpen(false)} />}
    </div>
  );
}

function LineRow({
  t,
  code,
  line,
  index,
  selectedWarehouse,
  balance = { total: 0, byWarehouse: {}, byLocation: {} },
  warehouses,
}: {
  t: SpareRequestFormDict;
  code: string;
  line: SpareLine;
  index: number;
  selectedWarehouse: string;
  balance?: SpareBalance;
  warehouses: Warehouse[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const selectedBalance = selectedWarehouse
    ? (balance.byWarehouse[selectedWarehouse] ?? 0)
    : null;
  const enough =
    selectedBalance !== null && selectedBalance >= Number(line.qty);
  const availableWarehouses = Object.entries(balance.byWarehouse)
    .filter(([, available]) => available > 0)
    .sort((a, b) => b[1] - a[1]);

  return (
    <tr className="border-b border-slate-100">
      <td className="px-3 py-2 text-center">{index}</td>
      <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-slate-600">
        {line.item_code}
      </td>
      <td className="min-w-96 px-3 py-3">
        <span className="block font-semibold text-slate-800">
          {line.item_name}
        </span>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {selectedBalance === null ? (
            <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">
              {t.selectWarehouseFirst}
            </span>
          ) : enough ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
              <CheckCircle2 className="size-3" /> {t.selectedWarehouseHas}{" "}
              {selectedBalance.toLocaleString()}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-700">
              <AlertTriangle className="size-3" /> {t.selectedWarehouseHas}{" "}
              {selectedBalance.toLocaleString()} · {t.short}{" "}
              {Math.max(0, Number(line.qty) - selectedBalance).toLocaleString()}
            </span>
          )}
          {availableWarehouses.map(([warehouseCode, available]) => {
            const warehouse = warehouses.find(
              (item) => item.code === warehouseCode,
            );
            if (warehouseCode === selectedWarehouse) return null;
            return (
              <span
                key={warehouseCode}
                title={warehouse?.name_1}
                className="rounded-md bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700"
              >
                {warehouseCode}: {available.toLocaleString()}
              </span>
            );
          })}
          {availableWarehouses.length === 0 && (
            <span className="text-[10px] font-semibold text-red-500">
              {t.outOfStockAll}
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-3 text-center">
        <span className="font-bold tabular-nums text-slate-700">
          {Number(line.qty).toLocaleString()}
        </span>
      </td>
      <td className="px-3 py-3 text-center">{line.unit_code ?? "-"}</td>
      <td className="px-3 py-2 text-center">
        <button
          type="button"
          title={t.delete}
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

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-slate-800">{value || "-"}</dd>
    </div>
  );
}

function SparePicker({
  t,
  code,
  onClose,
}: {
  t: SpareRequestFormDict;
  code: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<SpareRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/installations/spares?q=${encodeURIComponent(q)}`,
        );
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
            placeholder={t.searchSparePlaceholder}
            className="w-full text-sm outline-none"
          />
          <Button type="button" tone="neutral" onClick={onClose}>
            {t.exit}
          </Button>
        </div>
        <div className="overflow-auto p-4">
          <Table
            head={[
              "#",
              t.colCode,
              t.colItemPartNumber,
              t.colUnit,
              t.colBalance,
              "",
            ]}
            minWidth={700}
          >
            {rows.map((row, index) => (
              <tr
                key={row.code}
                className="border-b border-slate-100 hover:bg-slate-50"
              >
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
                        await addSpareLine(
                          code,
                          row.code,
                          row.name_1,
                          row.unit_code ?? "",
                        );
                        router.refresh();
                        onClose();
                      })
                    }
                  >
                    {t.select}
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
          {!loading && rows.length === 0 && (
            <p className="py-10 text-center text-sm text-slate-400">
              {t.noItemsFound}
            </p>
          )}
          {loading && (
            <p className="py-10 text-center text-sm text-slate-400">
              {t.loading}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
