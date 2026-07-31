"use client";
import {
  addSpareLines,
  saveSpareRequest,
  type ActionState,
} from "@/app/actions/installation";
import type { SpareRow } from "@/app/api/installations/spares/route";
import type { JobHead } from "@/components/installation/job-header";
import type { StandardSpare } from "@/lib/install-standard";
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
import { takeField } from "@/lib/spare-take";
import {
  AlertTriangle,
  CheckCircle2,
  LoaderCircle,
  LogOut,
  PackageOpen,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState, useTransition } from "react";

/** ຖອດແບບຈາກ ods: req_page.html + /in_add_req + /additemtoreg_inst + /delete_item_sion
 *  + /update_qty_reg_spare + /save_in_req (tech_reg_install.py) */

export type SpareLine = {
  roworder: number;
  item_code: string;
  item_name: string;
  standard_qty: string;
  requested_qty: string;
  remaining_qty: string;
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
  standards,
  warehouses,
  shelves,
  balances,
  allowFreeSearch = true,
}: {
  code: string;
  head: JobHead;
  requestNo: string;
  today: string;
  lines: SpareLine[];
  /** ອາໄຫຼ່ຕາມມາດຕະຖານ = ອົງປະກອບຊຸດຂອງສິນຄ້າ (ic_inventory_set_detail ຂອງ ERP) */
  standards: StandardSpare[];
  warehouses: Warehouse[];
  /** ທີ່ເກັບຂອງແຕ່ລະສາງ (ic_shelf ຂອງ ERP) — ກອງຕາມສາງທີ່ເລືອກ */
  shelves: Shelf[];
  balances: Record<string, SpareBalance>;
  /**
   * ເບີກນອກມາດຕະຖານໄດ້ບໍ (SETTING.INSTALL_SPARE_FREE_SEARCH) — ປິດແລ້ວຊ່ອງຄົ້ນ ERP ຫາຍ.
   * ນີ້ແມ່ນ**ໜ້າຕາ**ເທົ່ານັ້ນ; ດ່ານຈິງຢູ່ addSpareLines ແລະ /api/installations/spares.
   */
  allowFreeSearch?: boolean;
}) {
  const t = useDict().spareRequestForm;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    saveSpareRequest,
    {},
  );
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [adding, startAdding] = useTransition();
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(
    () => new Set(),
  );
  const selectedLines = lines.filter((line) =>
    selectedCodes.has(line.item_code),
  );

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
    const available = selectedLines.filter(
      (line) =>
        (balances[line.item_code]?.byWarehouse[warehouse.code] ?? 0) > 0,
    ).length;
    const enough = selectedLines.filter(
      (line) =>
        (balances[line.item_code]?.byWarehouse[warehouse.code] ?? 0) >=
        Number(line.qty),
    ).length;
    return {
      value: warehouse.code,
      label: `${warehouse.code} ~ ${warehouse.name_1} · ${t.has} ${available}/${selectedLines.length} · ${t.enough} ${enough}/${selectedLines.length}`,
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
                disabled={pending || selectedLines.length === 0 || !wh || !shelf}
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
          {selectedLines.length > 0 && warehouses.length === 0 && (
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
              onClick={() => setOpen(true)}
            >
              <Plus className="size-4" /> {t.addSpare}
            </Button>
          }
        >
          {selectedLines.length === 0 ? (
            <Empty>{t.noSpareLines}</Empty>
          ) : (
            <Table
              head={[
                "#",
                t.colItemCode,
                t.colItemNameStock,
                "ຈຳນວນມາດຕະຖານ",
                "ຈຳນວນຂໍເບີກແລ້ວ",
                "ຈຳນວນຄົງເຫຼືອ",
                t.takeNow,
                t.colUnit,
                "",
              ]}
              minWidth={1000}
            >
              {selectedLines.map((line, index) => (
                <LineRow
                  // ປ່ຽນສາງ ⇒ remount ເພື່ອໃຫ້ຊ່ອງ "ເບີກຮອບນີ້" ຕັ້ງຄ່າໃໝ່ຕາມສາງນັ້ນ
                  key={`${line.roworder}-${line.qty}-${wh}`}
                  t={t}
                  line={line}
                  index={index + 1}
                  selectedWarehouse={wh}
                  balance={balances[line.item_code]}
                  warehouses={warehouses}
                  onRemove={() =>
                    setSelectedCodes((current) => {
                      const next = new Set(current);
                      next.delete(line.item_code);
                      return next;
                    })
                  }
                />
              ))}
            </Table>
          )}
        </Card>
      </form>

      {open && (
        <SparePicker
          t={t}
          lines={lines}
          standards={standards}
          balances={balances}
          allowFreeSearch={allowFreeSearch}
          selectedCodes={selectedCodes}
          adding={adding}
          onAdd={(codes) =>
            startAdding(async () => {
              // ແຖວທີ່ຍັງບໍ່ມີໃນກະຕ່າ (ທັງມາດຕະຖານ ແລະ ລາຍການເພີ່ມ) ຕ້ອງໃສ່ກະຕ່າກ່ອນ
              // ຈຶ່ງຈະຂຶ້ນຕາຕະລາງໃບຂໍເບີກ — ຈຳນວນມາດຕະຖານຄິດຈາກຊຸດຢູ່ຝັ່ງ server.
              const cartCodes = new Set(lines.map((line) => line.item_code));
              const newCodes = [...codes].filter(
                (itemCode) => !cartCodes.has(itemCode),
              );
              if (newCodes.length > 0) {
                const result = await addSpareLines(code, newCodes);
                if (result.error) {
                  window.alert(result.error);
                  return;
                }
              }
              setSelectedCodes(new Set(codes));
              setOpen(false);
              if (newCodes.length > 0) router.refresh();
            })
          }
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function LineRow({
  t,
  line,
  index,
  selectedWarehouse,
  balance = { total: 0, byWarehouse: {}, byLocation: {} },
  warehouses,
  onRemove,
}: {
  t: SpareRequestFormDict;
  line: SpareLine;
  index: number;
  selectedWarehouse: string;
  balance?: SpareBalance;
  warehouses: Warehouse[];
  onRemove: () => void;
}) {
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
        <b className="tabular-nums">{Number(line.standard_qty).toLocaleString()}</b>
      </td>
      <td className="px-3 py-3 text-center">
        <b className="tabular-nums text-teal-700">{Number(line.requested_qty).toLocaleString()}</b>
      </td>
      <td className="px-3 py-3 text-center">
        <b className="tabular-nums text-amber-700">{Number(line.remaining_qty).toLocaleString()}</b>
      </td>
      {/*
        ── ເບີກຮອບນີ້ (1 ສາງ / 1 ໃບ) ──
        ຕັ້ງຕົ້ນ = **ເທົ່າທີ່ສາງທີ່ເລືອກມີ** (ບໍ່ເກີນຈຳນວນຄ້າງ) ⇒ ກົດບັນທຶກເລີຍກໍ່ຖືກ.
        ສ່ວນທີ່ເຫຼືອຍັງຄ້າງໄວ້ ⇒ ຫຼັງບັນທຶກ ລະບົບພາກັບມາໜ້ານີ້ ໃຫ້ອອກໃບຈາກສາງອື່ນຕໍ່.

        ⚠️ `key` ຜູກກັບ**ສາງທີ່ເລືອກ** — ບໍ່ດັ່ງນັ້ນ `defaultValue` ຂອງຊ່ອງທີ່ບໍ່ໄດ້ຄວບຄຸມ
        ຈະຄ້າງຢູ່ຄ່າຕອນ render ທຳອິດ (ຕອນຍັງບໍ່ທັນເລືອກສາງ = **ຄ້າງທັງໝົດ**) ແລ້ວ
        ໃບທຳອິດຈະ**ກວາດເອົາໝົດ** ທັງທີ່ສາງນັ້ນມີບໍ່ພໍ ⇒ ບໍ່ເຫຼືອຫຍັງໃຫ້ອອກໃບຈາກສາງທີສອງ
        ("ຄັງທີສອງບໍ່ເຂົ້າ"). ປ່ຽນສາງ ⇒ input ຖືກ mount ໃໝ່ ⇒ ຈຳນວນຄິດຕາມສາງນັ້ນຈິງ.
      */}
      <td className="px-3 py-3 text-center">
        <input
          key={`${line.item_code}-${selectedWarehouse}`}
          type="number"
          name={takeField(line.item_code)}
          min={0}
          max={Number(line.qty)}
          step="any"
          defaultValue={
            selectedBalance === null
              ? Number(line.qty)
              : Math.min(Number(line.qty), selectedBalance)
          }
          aria-label={`${t.takeNow} ${line.item_name}`}
          className={`${inputClass} h-9 w-24 text-center font-semibold`}
        />
      </td>
      <td className="px-3 py-3 text-center">{line.unit_code ?? "-"}</td>
      <td className="px-3 py-2 text-center">
        <button
          type="button"
          title={t.delete}
          className="text-slate-500 hover:text-red-600 disabled:opacity-50"
          onClick={onRemove}
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
  lines,
  standards,
  balances,
  allowFreeSearch,
  selectedCodes,
  adding,
  onAdd,
  onClose,
}: {
  t: SpareRequestFormDict;
  lines: SpareLine[];
  standards: StandardSpare[];
  balances: Record<string, SpareBalance>;
  allowFreeSearch: boolean;
  selectedCodes: Set<string>;
  adding: boolean;
  onAdd: (codes: Set<string>) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(selectedCodes),
  );
  const [searchRows, setSearchRows] = useState<SpareRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const keyword = q.trim();
    // ປິດການເບີກນອກມາດຕະຖານ ⇒ ບໍ່ຕ້ອງຖາມ ERP ເລີຍ (route ກໍ່ປະຕິເສດຢູ່ແລ້ວ)
    if (!allowFreeSearch || keyword.length < 2) {
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/installations/spares?q=${encodeURIComponent(keyword)}`,
          { signal: controller.signal },
        );
        const json = await response.json();
        setSearchRows(json.data ?? []);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError"))
          setSearchRows([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [allowFreeSearch, q]);

  /**
   * 3 ກຸ່ມ ຕາມແຫຼ່ງທີ່ມາ:
   *   ① ມາດຕະຖານ — ອົງປະກອບຊຸດຂອງສິນຄ້າໃນ ERP (ic_inventory_set_detail)
   *   ② ຢູ່ໃນກະຕ່າແລ້ວ — ແຖວ tb_used_spare ທີ່ບໍ່ຢູ່ໃນຊຸດ (ຊ່າງ/ລະບົບເກົ່າເພີ່ມໄວ້)
   *      ⇒ ຍັງໃຫ້ເຫັນ/ຕິກໄດ້ ແຕ່ **ບໍ່ນັບເປັນມາດຕະຖານ** (ຄໍລຳມາດຕະຖານ = 0)
   *   ③ ຄົ້ນຫາຈາກ ERP — ພິມຄົ້ນເອົາເອງ
   */
  const rows = useMemo(() => {
    const keyword = q.trim().toLocaleLowerCase();
    const match = (itemCode: string, itemName: string) =>
      !keyword ||
      itemCode.toLocaleLowerCase().includes(keyword) ||
      itemName.toLocaleLowerCase().includes(keyword);

    const standardRows = standards
      .filter((row) => match(row.item_code, row.item_name))
      .map((row) => ({
        item_code: row.item_code,
        item_name: row.item_name,
        unit_code: row.unit_code,
        standard_qty: row.standard_qty,
        requested_qty: row.requested_qty,
        remaining_qty: row.remaining_qty,
        stock_qty: balances[row.item_code]?.total ?? 0,
        source: "standard" as const,
      }));

    const standardCodes = new Set(standards.map((row) => row.item_code));
    const cartRows = lines
      .filter(
        (line) =>
          !standardCodes.has(line.item_code) &&
          match(line.item_code, line.item_name),
      )
      .map((line) => ({
        item_code: line.item_code,
        item_name: line.item_name,
        unit_code: line.unit_code,
        standard_qty: 0,
        requested_qty: Number(line.requested_qty),
        remaining_qty: Number(line.remaining_qty),
        stock_qty: balances[line.item_code]?.total ?? 0,
        source: "cart" as const,
      }));

    const known = new Set([...standardCodes, ...lines.map((line) => line.item_code)]);
    const extras = !allowFreeSearch || keyword.length < 2 ? [] : searchRows
      .filter((row) => !known.has(row.code))
      .map((row) => ({
        item_code: row.code,
        item_name: row.name_1,
        unit_code: row.unit_code,
        standard_qty: 0,
        requested_qty: row.requested_qty,
        remaining_qty: Math.max(0, 1 - row.requested_qty),
        stock_qty: row.balance_qty,
        source: "erp" as const,
      }));
    return [...standardRows, ...cartRows, ...extras];
  }, [allowFreeSearch, balances, lines, standards, q, searchRows]);
  const allVisibleChecked =
    rows.length > 0 && rows.every((row) => checked.has(row.item_code));

  const toggle = (itemCode: string) => {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(itemCode)) next.delete(itemCode);
      else next.add(itemCode);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-[1px]">
      <div className="flex max-h-[82vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50/80 px-5 py-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-teal-100 text-teal-700">
            <PackageOpen className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-slate-800">ເລືອກອາໄຫຼ່ຕາມມາດຕະຖານ</h2>
            <p className="text-xs text-slate-500">ໝາຍ check ທີລະລາຍການ ຫຼືເລືອກທັງໝົດ</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.exit}
            className="grid size-9 place-items-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="border-b border-slate-200 p-4">
          <label className="flex h-12 items-center gap-3 rounded-full border-2 border-teal-500 bg-white px-4 shadow-[0_0_0_5px_rgba(20,184,166,0.10)]">
            <Search className="size-5 shrink-0 text-slate-400" />
            <input
              autoFocus
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder={
                allowFreeSearch
                  ? "ຄົ້ນຫາລະຫັດ ຫຼື ຊື່ອາໄຫຼ່ຈາກ ERP..."
                  : "ກອງລາຍການລຸ່ມນີ້ (ລະຫັດ ຫຼື ຊື່)..."
              }
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </label>
          {/*
            ປິດ "ເບີກນອກມາດຕະຖານ" ⇒ ຊ່ອງນີ້ກອງແຕ່ລາຍການທີ່ມີຢູ່ແລ້ວ ບໍ່ໄປຄົ້ນ ERP
            (ເປີດ/ປິດຢູ່ /manage/settings — ດ່ານຈິງຢູ່ຝັ່ງ server).
          */}
          {!allowFreeSearch && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800">
              ປິດການເບີກອາໄຫຼ່ນອກມາດຕະຖານໄວ້ — ເລືອກໄດ້ແຕ່ລາຍການມາດຕະຖານ ແລະ ລາຍການທີ່ຢູ່ໃນກະຕ່າແລ້ວ
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-2.5">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={allVisibleChecked}
              onChange={() =>
                setChecked((current) => {
                  const next = new Set(current);
                  rows.forEach((row) =>
                    allVisibleChecked
                      ? next.delete(row.item_code)
                      : next.add(row.item_code),
                  );
                  return next;
                })
              }
              className="size-4 accent-teal-600"
            />
            ເລືອກທັງໝົດ
          </label>
          <span className="text-xs text-slate-500">
            ເລືອກແລ້ວ {checked.size} ລາຍການ
          </span>
        </div>

        <div className="overflow-auto">
          {rows.map((row) => (
            <label
              key={row.item_code}
              className="flex w-full cursor-pointer items-center gap-3 border-b border-slate-100 px-5 py-3 text-left transition hover:bg-teal-50/60"
            >
              <input
                type="checkbox"
                checked={checked.has(row.item_code)}
                onChange={() => toggle(row.item_code)}
                className="size-5 shrink-0 accent-teal-600"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-slate-800">{row.item_name}</span>
                <span className="mt-0.5 block text-xs text-slate-400">
                  {row.item_code} · {row.unit_code || "-"}
                </span>
              </span>
              <span className="shrink-0 text-right text-xs leading-5">
                <span className="block text-slate-500">
                  ມາດຕະຖານ: <b>{Number(row.standard_qty).toLocaleString()}</b>
                  {" · "}ຂໍແລ້ວ: <b className="text-teal-700">{Number(row.requested_qty).toLocaleString()}</b>
                </span>
                <span className="block text-slate-500">
                  ຄົງເຫຼືອ: <b className="text-amber-700">{Number(row.remaining_qty).toLocaleString()}</b>
                  {" · "}Stock: <b className={row.stock_qty > 0 ? "text-emerald-700" : "text-red-600"}>
                    {row.stock_qty.toLocaleString()}
                  </b>
                </span>
                {row.source === "cart" && (
                  <span className="block font-semibold text-amber-600">
                    ນອກຊຸດມາດຕະຖານ · ຢູ່ໃນກະຕ່າແລ້ວ
                  </span>
                )}
                {row.source === "erp" && (
                  <span className="block font-semibold text-blue-600">
                    ລາຍການເພີ່ມຈາກ ERP
                  </span>
                )}
              </span>
            </label>
          ))}
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

        <div className="flex justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4">
          <Button type="button" tone="neutral" onClick={onClose}>
            {t.exit}
          </Button>
          <Button
            type="button"
            tone="success"
            disabled={checked.size === 0 || adding}
            onClick={() => {
              onAdd(new Set(checked));
            }}
          >
            {adding ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            ເພີ່ມ {checked.size} ລາຍການ
          </Button>
        </div>
      </div>
    </div>
  );
}
