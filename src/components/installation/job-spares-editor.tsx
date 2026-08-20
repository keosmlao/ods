"use client";
import {
  addSpareLines,
  changeInstallKitType,
  deleteSpareLine,
  updateSpareQty,
} from "@/app/actions/installation";
import type { SpareRow } from "@/app/api/installations/spares/route";
import type { InstallSpareLine } from "@/lib/install-spare";
import type { StandardSpare } from "@/lib/install-standard";
import { Button, Card, Empty, Table, inputClass } from "@/components/ui";
import { useDict } from "@/lib/i18n/context";
import {
  Check,
  LoaderCircle,
  Lock,
  PackageOpen,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

/**
 * ── ແກ້ໄຂ **ກະຕ່າອາໄຫຼ່ຂອງໃບງານ** (ods.tb_used_spare where product_code = <ໃບງານ>) ──
 *
 * ນີ້ **ບໍ່ແມ່ນ**ການແກ້ໃບຂໍເບີກ (SION 122 — ນັ້ນຢູ່ /installations/spare-requests/edit).
 * ອັນນີ້ຄື "ງານນີ້ຕ້ອງໃຊ້ອາໄຫຼ່ຫຍັງ ຈັກອັນ" ຊຶ່ງ:
 *   • ຕັ້ງຕົ້ນ (default) ມາຈາກ **ຊຸດມາດຕະຖານ** `used_spare_install` ຕາມ `install_type`
 *     ຂອງໃບງານ — ຕື່ມໃຫ້ຕອນເປີດງານໂດຍ createInstall (actions/installation)
 *   • ແຕ່ລະໃບງານ **ປັບແກ້ເອງໄດ້**: ເພີ່ມລາຍການ · ລົບລາຍການ · ແກ້ຈຳນວນ
 *     (ຂອງແທນກັນໜ້າງານ · ງານທີ່ບໍ່ມີຊຸດ ເຊັ່ນ ໂທລະທັດ/ຈັກຊັກ)
 *
 * ── ເປັນຫຍັງຈຶ່ງມາຢູ່ໜ້າລາຍລະອຽດງານ ──
 * ກ່ອນນີ້ action ທັງສາມ (addSpareLines · deleteSpareLine · updateSpareQty) ມີຢູ່ແລ້ວ
 * ແຕ່ `deleteSpareLine`/`updateSpareQty` **ບໍ່ມີໃຜເອີ້ນເລີຍ** (ຖອດມາຈາກ ods ແລ້ວປະໄວ້)
 * ⇒ ທາງດຽວທີ່ຈະປັບກະຕ່າໄດ້ຄືຜ່ານແອັບຊ່າງ (lib/install-spare) ຫຼື ໄປແກ້ຖານດ້ວຍມື.
 * ໜ້າລາຍລະອຽດຄືບ່ອນທີ່ CS ເປີດເບິ່ງຢູ່ແລ້ວ ຈຶ່ງເອົາການແກ້ໄຂມາໄວ້ບ່ອນນີ້.
 *
 * ── ແຖວໃດແກ້ໄດ້ ──
 * `locked` ຄິດຈາກ **SPARE_ON_DOC** (lib/install-spare) ອັນດຽວກັບທີ່ action ບັງຄັບ ⇒ ປຸ່ມ
 * ທີ່ເປີດໃຫ້ກົດ ຈະບໍ່ມີວັນຖືກ server ປະຕິເສດ (ແລະ ກັບກັນ). ແຖວທີ່ເຂົ້າເອກະສານແລ້ວ
 * (ຂໍເບີກ · ສາງເບີກ · ຊ່າງຮັບ) ລ໋ອກໄວ້ — ບໍ່ດັ່ງນັ້ນກະຕ່າກັບເອກະສານຈະຂັດກັນ.
 */

/** ໝວດຊຸດມາດຕະຖານໃຫ້ເລືອກ (ods.install_kit_type) — ສະເພາະທີ່ເປີດໃຊ້ງານ */
export type KitTypeOption = { code: string; name: string };

/**
 * ຕົວທົດແທນຂອງແຕ່ລະລາຍການໃນຊຸດ: `{ "130201-0206": [{ ic_code: "130201-0219", … }] }`
 * ເປັນ object ບໍ່ແມ່ນ Map ເພາະຕ້ອງຜ່ານ server→client boundary (Map serialize ບໍ່ໄດ້).
 */
export type SubstituteMap = Record<
  string,
  { ic_code: string; name_1: string | null; unit_code: string | null }[]
>;

/** ແຖວ **ລວມ** ສຳລັບໂໝດອ່ານ — ຄືກັບຕາຕະລາງເກົ່າ (ລວມແຖວຊ້ຳຂອງອາໄຫຼ່ຕົວດຽວກັນ) */
export type JobSpareView = {
  item_code: string | null;
  item_name: string | null;
  qty: string;
  unit_code: string | null;
  reg_start: string | null;
  reg_finish: string | null;
  pick_finish: string | null;
};

export function JobSparesEditor({
  code,
  view,
  lines,
  standards,
  allowFreeSearch,
  canEdit,
  lockReason,
  kitTypes,
  kitType,
  kitTypeName,
  substitutes,
}: {
  code: string;
  view: JobSpareView[];
  /** ແຖວດິບຂອງ tb_used_spare (ມີ roworder) — ໂໝດແກ້ໄຂຕ້ອງໃຊ້ແຖວດິບ */
  lines: InstallSpareLine[];
  /** ຊຸດມາດຕະຖານຂອງໃບງານ (used_spare_install ຕາມ install_type) */
  standards: StandardSpare[];
  allowFreeSearch: boolean;
  /** ມີສິດ **ແລະ** ງານຢູ່ໃນໜ້າຕ່າງທີ່ແກ້ໄດ້ */
  canEdit: boolean;
  /** ມີສິດແຕ່ແກ້ບໍ່ໄດ້ຍ້ອນຂັ້ນຂອງງານ — ບອກເຫດຜົນ ດີກວ່າເຊື່ອງປຸ່ມງຽບໆ */
  lockReason: string | null;
  /** ໝວດທັງໝົດໃຫ້ເລືອກ */
  kitTypes: KitTypeOption[];
  /** ໝວດຂອງໃບງານດຽວນີ້ (`ods_tb_install.install_type`) — "" = ຍັງບໍ່ມີ */
  kitType: string;
  kitTypeName: string | null;
  /** ຫຍັງແທນຫຍັງໄດ້ (ກຸ່ມສາກົນ — lib/spare-substitute) */
  substitutes: SubstituteMap;
}) {
  const t = useDict().jobSpareEditor;
  const detail = useDict().installDetail;
  const [editing, setEditing] = useState(false);
  const [picking, setPicking] = useState(false);
  const [busy, startBusy] = useTransition();
  const router = useRouter();

  /**
   * refresh **ທັງສອງກໍລະນີ** — ສຳເລັດ ຫຼື ຖືກປະຕິເສດ.
   * ຖືກປະຕິເສດແລ້ວບໍ່ refresh = ຊ່ອງຈຳນວນຄ້າງຄ່າທີ່ພິມໄວ້ ໃນຂະນະທີ່ຖານເປັນຄ່າເກົ່າ
   * ⇒ ໜ້າຈໍຂັດກັບຄວາມຈິງ (ເກີດເມື່ອແຖວຖືກຂໍເບີກໄປ **ຫຼັງ**ໜ້ານີ້ໂຫຼດ).
   */
  const run = (
    action: () => Promise<{ error?: string; ok?: string }>,
    // ບອກຜົນຕອນສຳເລັດນຳ — ໃຊ້ກັບການປ່ຽນໝວດ ທີ່ຜົນລັບເປັນຕົວເລກ (ເພີ່ມ/ປັບ/ຖອດ ຈັກລາຍການ)
    options?: { announce?: boolean },
  ) =>
    startBusy(async () => {
      const result = await action();
      if (result.error) window.alert(result.error);
      else if (options?.announce && result.ok) window.alert(result.ok);
      router.refresh();
    });

  const editableCount = lines.filter((line) => !line.locked).length;

  return (
    <Card
      title={`${detail.jobSpares} (${editing ? lines.length : view.length})`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {editing && (
            <Button
              type="button"
              tone="info"
              size="sm"
              disabled={busy}
              onClick={() => setPicking(true)}
            >
              <Plus className="size-4" /> {t.addSpare}
            </Button>
          )}
          {canEdit ? (
            <Button
              type="button"
              tone={editing ? "success" : "neutral"}
              size="sm"
              disabled={busy}
              onClick={() => setEditing((current) => !current)}
            >
              {busy ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : editing ? (
                <Check className="size-4" />
              ) : (
                <Pencil className="size-4" />
              )}
              {editing ? t.doneEditing : t.editSpares}
            </Button>
          ) : (
            lockReason && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-semibold text-slate-500">
                <Lock className="size-3.5" /> {lockReason}
              </span>
            )
          )}
        </div>
      }
    >
      {/*
        ບອກ**ທີ່ມາຂອງຄ່າຕັ້ງຕົ້ນ** ໄວ້ໃນໂໝດແກ້ໄຂ — ບໍ່ດັ່ງນັ້ນຄົນເຂົ້າໃຈວ່າລາຍການເຫຼົ່ານີ້
        ມີໃຜພິມໃສ່ ແລ້ວກັງວົນວ່າແກ້ແລ້ວຈະກະທົບໃບງານອື່ນ (ບໍ່ກະທົບ — ນີ້ຄືກະຕ່າຂອງໃບງານນີ້).
      */}
      {editing && (
        <>
          <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-[11px] leading-relaxed text-brand-800">
            {t.kitHint}
          </p>
          <KitTypePicker
            t={t}
            kitTypes={kitTypes}
            current={kitType}
            currentName={kitTypeName}
            busy={busy}
            onChange={(next) =>
              run(() => changeInstallKitType(code, next), { announce: true })
            }
          />
        </>
      )}

      {editing ? (
        lines.length === 0 ? (
          <Empty>{detail.noSparesUsed}</Empty>
        ) : (
          <Table
            head={[
              detail.code,
              detail.spareName,
              detail.qty,
              t.unit,
              t.source,
              t.state,
              "",
            ]}
            minWidth={860}
          >
            {lines.map((line) => (
              <tr key={line.roworder} className="border-b border-slate-100">
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-600">
                  {line.item_code}
                </td>
                <td className="px-3 py-2 text-xs font-semibold text-slate-800">
                  {line.item_name || "-"}
                </td>
                <td className="px-3 py-2 text-center">
                  {/*
                    `key` ຜູກກັບ **ຈຳນວນຈາກ server** ⇒ ຫຼັງບັນທຶກ (router.refresh) ຊ່ອງ
                    ຖືກ mount ໃໝ່ພ້ອມຄ່າຈິງ. ບໍ່ດັ່ງນັ້ນຕ້ອງ setState ໃນ effect ເຊິ່ງເຮັດໃຫ້
                    render ຊ້ອນກັນ (react-hooks/set-state-in-effect).
                  */}
                  <QtyCell
                    key={`${line.roworder}-${line.qty}`}
                    line={line}
                    busy={busy}
                    onSave={(qty) =>
                      run(() => updateSpareQty(code, line.roworder, qty))
                    }
                  />
                </td>
                <td className="px-3 py-2 text-center text-xs text-slate-500">
                  {line.unit_code || "-"}
                </td>
                <td className="px-3 py-2 text-center">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      line.standard
                        ? "bg-brand-100 text-brand-800"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {line.standard ? t.inKit : t.outsideKit}
                  </span>
                </td>
                <td className="px-3 py-2 text-center">
                  {line.locked ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-orange-100 px-2 py-0.5 text-[10px] font-bold text-brand-orange-700">
                      <Lock className="size-3" /> {t.onDoc}
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-slate-400">
                      {t.free}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  <button
                    type="button"
                    title={line.locked ? t.onDocCannotDelete : t.delete}
                    disabled={line.locked || busy}
                    className="text-slate-500 hover:text-brand-orange-700 disabled:cursor-not-allowed disabled:opacity-30"
                    onClick={() => {
                      if (!window.confirm(`${t.confirmDelete}\n${line.item_name}`))
                        return;
                      run(() => deleteSpareLine(code, line.roworder));
                    }}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
          </Table>
        )
      ) : view.length === 0 ? (
        <Empty>{detail.noSparesUsed}</Empty>
      ) : (
        <Table
          head={[
            detail.code,
            detail.spareName,
            detail.qty,
            detail.requested,
            detail.dispatched,
            detail.received,
          ]}
          minWidth={700}
        >
          {view.map((spare, index) => (
            <tr key={`${spare.item_code}-${index}`} className="border-b border-slate-100">
              <td className="px-3 py-2 text-xs">{spare.item_code ?? "-"}</td>
              <td className="px-3 py-2 text-xs">{spare.item_name ?? "-"}</td>
              <td className="px-3 py-2 text-xs font-semibold">
                {Number(spare.qty).toLocaleString()} {spare.unit_code ?? ""}
              </td>
              <td className="px-3 py-2 text-xs text-slate-500">{spare.reg_start ?? "-"}</td>
              <td className="px-3 py-2 text-xs text-slate-500">{spare.reg_finish ?? "-"}</td>
              <td className="px-3 py-2 text-xs text-slate-500">{spare.pick_finish ?? "-"}</td>
            </tr>
          ))}
        </Table>
      )}

      {/* ລ໋ອກໝົດທຸກແຖວ ⇒ ບອກໄວ້ ບໍ່ໃຫ້ນັ່ງຫາປຸ່ມທີ່ກົດບໍ່ໄດ້ */}
      {editing && lines.length > 0 && editableCount === 0 && (
        <p className="mt-3 rounded-lg bg-brand-orange-50 px-3 py-2 text-[11px] font-semibold text-brand-orange-700">
          {t.allLocked}
        </p>
      )}

      {picking && (
        <SparePicker
          t={t}
          lines={lines}
          standards={standards}
          substitutes={substitutes}
          allowFreeSearch={allowFreeSearch}
          jobCode={code}
          busy={busy}
          onClose={() => setPicking(false)}
          onAdd={(codes) =>
            startBusy(async () => {
              const result = await addSpareLines(code, [...codes]);
              if (result.error) {
                window.alert(result.error);
                return;
              }
              if (result.skipped?.length) {
                window.alert(`${t.alreadyInCart}\n${result.skipped.join(", ")}`);
              }
              setPicking(false);
              router.refresh();
            })
          }
        />
      )}
    </Card>
  );
}

/**
 * ── ເລືອກ **ໝວດຊຸດມາດຕະຖານ** ຂອງໃບງານ ──
 *
 * ປ່ຽນແລ້ວອາໄຫຼ່ຂອງງານຖືກອ້າງອີງໃໝ່ຕາມຊຸດຂອງໝວດນັ້ນ (ເບິ່ງ changeInstallKitType).
 * ຕ້ອງ **ຢືນຢັນກ່ອນ** ເພາະມັນຖອດ/ຕັ້ງຈຳນວນທັບຫຼາຍແຖວພ້ອມກັນ — ບໍ່ແມ່ນການແກ້ແຖວດຽວ
 * ທີ່ຄົນຄາດເດົາຜົນໄດ້ຢູ່ແລ້ວ.
 *
 * ⚠️ ບໍ່ໃຊ້ `onChange` ຂອງ select ຍິງ action ໂດຍກົງ — ຖ້າຄົນກົດຍົກເລີກຢູ່ confirm
 * ຊ່ອງຈະຄ້າງຄ່າໃໝ່ ຂະນະທີ່ຖານຍັງເປັນຄ່າເກົ່າ (ຈໍຕົວະ). ເກັບຄ່າທີ່ເລືອກໄວ້ໃນ state
 * ແລ້ວໃຫ້ກົດປຸ່ມຢືນຢັນຕ່າງຫາກ.
 */
function KitTypePicker({
  t,
  kitTypes,
  current,
  currentName,
  busy,
  onChange,
}: {
  t: EditorDict;
  kitTypes: KitTypeOption[];
  current: string;
  currentName: string | null;
  busy: boolean;
  onChange: (next: string) => void;
}) {
  const [choice, setChoice] = useState(current);
  const dirty = choice !== "" && choice !== current;

  if (kitTypes.length === 0) {
    return (
      <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-500">
        {t.kitTypeEmpty}
      </p>
    );
  }

  return (
    <div className="mb-3 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5">
      <label className="text-[11px] text-slate-500">
        <span className="mb-1 block font-semibold">{t.kitTypeLabel}</span>
        <select
          value={choice}
          disabled={busy}
          onChange={(event) => setChoice(event.target.value)}
          className={`${inputClass} h-9 w-80`}
        >
          {/* ງານທີ່ install_type ຫວ່າງ (ໂທລະທັດ/ຈັກຊັກ ຫຼື ERP ບໍ່ໃສ່ຂະໜາດ) */}
          {!current && <option value="">{t.kitTypeNone}</option>}
          {kitTypes.map((type) => (
            <option key={type.code} value={type.code}>
              {type.code} — {type.name}
            </option>
          ))}
        </select>
      </label>

      {dirty ? (
        <Button
          type="button"
          tone="success"
          size="sm"
          disabled={busy}
          onClick={() => {
            const next = kitTypes.find((type) => type.code === choice);
            if (!window.confirm(`${t.kitTypeConfirm}\n\n${next?.code} — ${next?.name}`)) {
              setChoice(current);
              return;
            }
            onChange(choice);
          }}
        >
          {busy ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <Check className="size-4" />
          )}
          {t.kitTypeApply}
        </Button>
      ) : (
        <span className="pb-2 text-[11px] text-slate-500">
          {current ? (
            <>
              {t.kitTypeCurrent} <b className="font-mono text-slate-700">{current}</b>
              {currentName && <> — {currentName}</>}
            </>
          ) : (
            t.kitTypeNoneHint
          )}
        </span>
      )}
    </div>
  );
}

/**
 * ຊ່ອງຈຳນວນ — ບັນທຶກຕອນ **ອອກຈາກຊ່ອງ ຫຼື ກົດ Enter** ແລະ ສະເພາະເມື່ອຄ່າປ່ຽນ.
 * ບໍ່ບັນທຶກທຸກຕົວອັກສອນ (ຈະຍິງ action ຖີ່ ແລະ ຄ່າກາງທາງ ເຊັ່ນ "" ຫຼື 0 ຈະຖືກປະຕິເສດ).
 */
function QtyCell({
  line,
  busy,
  onSave,
}: {
  line: InstallSpareLine;
  busy: boolean;
  onSave: (qty: number) => void;
}) {
  // ຄ່າຈາກ server ມາທາງ `key` (ເບິ່ງບ່ອນເອີ້ນ) ⇒ ບໍ່ຕ້ອງ sync ດ້ວຍ effect
  const [value, setValue] = useState(String(line.qty));

  const commit = () => {
    const qty = Number(value);
    if (!Number.isFinite(qty) || qty <= 0) {
      setValue(String(line.qty));
      return;
    }
    if (qty === line.qty) return;
    onSave(qty);
  };

  if (line.locked) {
    return (
      <b className="tabular-nums text-slate-500">{line.qty.toLocaleString()}</b>
    );
  }
  return (
    <input
      type="number"
      min={0.01}
      max={9999}
      step="any"
      value={value}
      disabled={busy}
      aria-label={line.item_name}
      onChange={(event) => setValue(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
      className={`${inputClass} h-9 w-24 text-center font-semibold`}
    />
  );
}

type EditorDict = ReturnType<typeof useDict>["jobSpareEditor"];

/**
 * ເລືອກລາຍການທີ່ຈະເພີ່ມ — 2 ແຫຼ່ງ:
 *   ① ຊຸດມາດຕະຖານຂອງໃບງານ ທີ່ **ຍັງບໍ່ຢູ່ໃນກະຕ່າ** (ເອົາຄືນມາຫຼັງລົບຜິດ)
 *   ② ຄົ້ນຈາກ ERP — ສະເພາະເມື່ອເປີດ SETTING.INSTALL_SPARE_FREE_SEARCH
 * ຈຳນວນຕັ້ງຕົ້ນຄິດຢູ່ **ຝັ່ງ server** (addSpareLines ອ່ານຈາກຊຸດ) ⇒ ບໍ່ສົ່ງມາຈາກນີ້.
 */
function SparePicker({
  t,
  lines,
  standards,
  substitutes,
  allowFreeSearch,
  jobCode,
  busy,
  onAdd,
  onClose,
}: {
  t: EditorDict;
  lines: InstallSpareLine[];
  standards: StandardSpare[];
  substitutes: SubstituteMap;
  allowFreeSearch: boolean;
  jobCode: string;
  busy: boolean;
  onAdd: (codes: Set<string>) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [searchRows, setSearchRows] = useState<SpareRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const keyword = q.trim();
    // ຄຳສັ້ນ/ປິດການຄົ້ນ ⇒ ບໍ່ຖາມ ERP. ບໍ່ຕ້ອງລ້າງ searchRows ຢູ່ນີ້ — `rows` ກອງ
    // ດ້ວຍເງື່ອນໄຂອັນດຽວກັນຢູ່ແລ້ວ (ແລະ setState ໃນ effect = render ຊ້ອນ).
    if (!allowFreeSearch || keyword.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/installations/spares?q=${encodeURIComponent(keyword)}&job=${encodeURIComponent(jobCode)}`,
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
  }, [allowFreeSearch, jobCode, q]);

  const rows = useMemo(() => {
    const keyword = q.trim().toLocaleLowerCase();
    const match = (itemCode: string, itemName: string) =>
      !keyword ||
      itemCode.toLocaleLowerCase().includes(keyword) ||
      itemName.toLocaleLowerCase().includes(keyword);

    // ຢູ່ໃນກະຕ່າແລ້ວບໍ່ຕ້ອງສະແດງ — addSpareLines ຈະ skip ຢູ່ດີ (ບໍ່ insert ຊ້ຳ)
    const inCart = new Set(lines.map((line) => line.item_code));
    const kit = standards
      .filter((row) => !inCart.has(row.item_code) && match(row.item_code, row.item_name))
      .map((row) => ({
        item_code: row.item_code,
        item_name: row.item_name,
        unit_code: row.unit_code,
        standard_qty: row.standard_qty,
        source: "kit" as const,
      }));

    /**
     * ── ຕົວ**ທົດແທນ** ຂອງລາຍການໃນຊຸດ (20-08-2026) ──
     * ຊຸດລະບຸລະຫັດຕົວດຽວ ແຕ່ໜ້າງານໃຊ້ຍີ່ຫໍ້ໃດກໍ່ໄດ້ຖ້າ spec ຄືກັນ (ທໍ່ PVC 3/8 ມີ 4 ລະຫັດ)
     * ⇒ ເອົາຂຶ້ນໃຫ້ເລືອກ ພ້ອມບອກວ່າແທນຕົວໃດ. ນັບເປັນ "ຕາມມາດຕະຖານ" ຢູ່ຝັ່ງ server ນຳ
     * (lib/install-standard.blockNonStandard) ⇒ ເລືອກແລ້ວບັນທຶກໄດ້ແທ້.
     */
    const subRows = Object.entries(substitutes).flatMap(([forCode, alternatives]) => {
      const parent = standards.find((row) => row.item_code === forCode);
      return alternatives
        .filter((alt) => !inCart.has(alt.ic_code) && match(alt.ic_code, alt.name_1 ?? ""))
        .map((alt) => ({
          item_code: alt.ic_code,
          item_name: alt.name_1 ?? alt.ic_code,
          unit_code: alt.unit_code,
          standard_qty: parent?.standard_qty ?? 0,
          source: "sub" as const,
          /** ແທນຕົວໃດ — ບອກໄວ້ ບໍ່ດັ່ງນັ້ນຄົນບໍ່ຮູ້ວ່າເປັນຫຍັງລາຍການນີ້ຂຶ້ນມາ */
          forName: parent?.item_name ?? forCode,
        }));
    });

    const known = new Set([
      ...inCart,
      ...standards.map((row) => row.item_code),
      ...subRows.map((row) => row.item_code),
    ]);
    const extras =
      !allowFreeSearch || keyword.length < 2
        ? []
        : searchRows
            .filter((row) => !known.has(row.code))
            .map((row) => ({
              item_code: row.code,
              item_name: row.name_1,
              unit_code: row.unit_code,
              standard_qty: 0,
              source: "erp" as const,
            }));
    // ຕົວທົດແທນຢູ່ຖັດຈາກຊຸດ (ກ່ອນລາຍການຄົ້ນ ERP) — ໃກ້ກັບຕົວຫຼັກທີ່ມັນແທນ
    return [...kit, ...subRows, ...extras];
  }, [allowFreeSearch, lines, standards, substitutes, q, searchRows]);

  const toggle = (itemCode: string) =>
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(itemCode)) next.delete(itemCode);
      else next.add(itemCode);
      return next;
    });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-brand-900/45 p-4 backdrop-blur-[1px]">
      <div className="flex max-h-[82vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50/80 px-5 py-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-800">
            <PackageOpen className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-slate-800">{t.pickerTitle}</h2>
            <p className="text-xs text-slate-500">{t.pickerHint}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            className="grid size-9 place-items-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="border-b border-slate-200 p-4">
          <label className="flex h-12 items-center gap-3 rounded-full border-2 border-brand-600 bg-white px-4 shadow-[0_0_0_5px_rgba(20,184,166,0.10)]">
            <Search className="size-5 shrink-0 text-slate-400" />
            <input
              autoFocus
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder={allowFreeSearch ? t.searchErp : t.filterOnly}
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </label>
          {!allowFreeSearch && (
            <p className="mt-2 rounded-lg bg-brand-orange-100 px-3 py-2 text-[11px] font-semibold text-brand-900">
              {t.freeSearchOff}
            </p>
          )}
        </div>

        <div className="overflow-auto">
          {rows.map((row) => (
            <label
              key={row.item_code}
              className="flex w-full cursor-pointer items-center gap-3 border-b border-slate-100 px-5 py-3 text-left transition hover:bg-brand-50/60"
            >
              <input
                type="checkbox"
                checked={checked.has(row.item_code)}
                onChange={() => toggle(row.item_code)}
                className="size-5 shrink-0 accent-brand-700"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-slate-800">
                  {row.item_name}
                </span>
                <span className="mt-0.5 block text-xs text-slate-400">
                  {row.item_code} · {row.unit_code || "-"}
                </span>
              </span>
              <span className="shrink-0 text-right text-xs leading-5">
                {row.source === "kit" ? (
                  <span className="font-semibold text-brand-800">
                    {t.inKit} · {t.kitQty} {row.standard_qty.toLocaleString()}
                  </span>
                ) : row.source === "sub" ? (
                  // ບອກວ່າແທນຕົວໃດ — ບໍ່ດັ່ງນັ້ນຄົນບໍ່ຮູ້ວ່າເປັນຫຍັງລາຍການນີ້ຢູ່ບ່ອນນີ້
                  <span className="font-semibold text-brand-700">
                    {t.substituteFor}{" "}
                    <span className="font-normal text-slate-500">{row.forName}</span>
                    {row.standard_qty > 0 && <> · {t.kitQty} {row.standard_qty.toLocaleString()}</>}
                  </span>
                ) : (
                  <span className="font-semibold text-brand-600">{t.fromErp}</span>
                )}
              </span>
            </label>
          ))}
          {!loading && rows.length === 0 && (
            <p className="py-10 text-center text-sm text-slate-400">{t.noItemsFound}</p>
          )}
          {loading && (
            <p className="py-10 text-center text-sm text-slate-400">{t.loading}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4">
          <Button type="button" tone="neutral" onClick={onClose}>
            {t.close}
          </Button>
          <Button
            type="button"
            tone="success"
            disabled={checked.size === 0 || busy}
            onClick={() => onAdd(new Set(checked))}
          >
            {busy ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            {t.addN.replace("{n}", String(checked.size))}
          </Button>
        </div>
      </div>
    </div>
  );
}
