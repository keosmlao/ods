"use client";
import { saveJobRemark, type RemarkState } from "@/app/actions/service";
import { Check, LoaderCircle, Pencil, X } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";

/**
 * **ຊ່ອງໝາຍເຫດ ແກ້ໄດ້ໃນຕາຕະລາງ** — ກົດແລ້ວພິມ, Enter ບັນທຶກ, Esc ຍົກເລີກ.
 *
 * ເປັນຫຍັງແກ້ຢູ່ນີ້: CS ຮັບໂທລູກຄ້າແລ້ວຕ້ອງຈົດທັນທີ — ເປີດເຂົ້າໜ້າໃບ ແກ້ ບັນທຶກ ກັບອອກ
 * ຄື 4 ຄລິກຕໍ່ 1 ໃບ. ບ່ອນນີ້ຄລິກດຽວ.
 *
 * ບໍ່ບັນທຶກອັດຕະໂນມັດຕອນອອກຈາກຊ່ອງ (blur) — ຄົນອາດຄລິກອອກໂດຍບໍ່ຕັ້ງໃຈ ⇒
 * ຕ້ອງກົດ Enter ຫຼື ປຸ່ມ ✓ ຢືນຢັນ. ບັນທຶກແລ້ວລົງ timeline ຂອງໃບ.
 */
export function RemarkCell({ code, value, canEdit }: { code: string; value: string | null; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value ?? "");
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * ຫຸ້ມ action ໄວ້ ⇒ ປິດໂໝດແກ້**ຫຼັງ server ຕອບວ່າສຳເລັດ** ຢູ່ໃນຕົວ action ເອງ
   * (ບໍ່ແມ່ນໃນ effect ທີ່ setState — ນັ້ນເຮັດໃຫ້ render ຮອບພິເສດ ແລະ ຜິດກົດ React).
   */
  const [state, action, saving] = useActionState<RemarkState, FormData>(async (prev, formData) => {
    const result = await saveJobRemark(prev, formData);
    if (result.ok) setEditing(false);
    return result;
  }, {});

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (!canEdit) {
    return value ? (
      <span className="line-clamp-2 text-xs text-slate-600" title={value}>
        {value}
      </span>
    ) : (
      <span className="text-xs text-slate-300">-</span>
    );
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setText(value ?? "");
          setEditing(true);
        }}
        title={value ? `${value} — ກົດເພື່ອແກ້` : "ກົດເພື່ອໃສ່ໝາຍເຫດ"}
        className="group flex w-full items-start gap-1 text-left"
      >
        {value ? (
          <span className="line-clamp-2 text-xs text-slate-600">{value}</span>
        ) : (
          <span className="text-xs text-slate-300 group-hover:text-slate-400">ໃສ່ໝາຍເຫດ...</span>
        )}
        <Pencil className="mt-0.5 size-3 shrink-0 text-slate-300 opacity-0 group-hover:opacity-100" />
      </button>
    );
  }

  return (
    <form ref={formRef} action={action} className="space-y-1">
      <input type="hidden" name="code" value={code} />
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          name="remark"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setText(value ?? "");
              setEditing(false);
            }
          }}
          maxLength={500}
          placeholder="ພິມໝາຍເຫດ..."
          className="h-8 w-full rounded border border-teal-500 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-100"
        />
        <button
          type="submit"
          disabled={saving}
          title="ບັນທຶກ (Enter)"
          className="grid size-7 shrink-0 place-items-center rounded text-teal-600 hover:bg-teal-50 disabled:opacity-40"
        >
          {saving ? <LoaderCircle className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
        </button>
        <button
          type="button"
          onClick={() => {
            setText(value ?? "");
            setEditing(false);
          }}
          title="ຍົກເລີກ (Esc)"
          className="grid size-7 shrink-0 place-items-center rounded text-slate-400 hover:bg-slate-100"
        >
          <X className="size-3.5" />
        </button>
      </div>
      {state.error && <p className="text-[10px] font-semibold text-rose-600">{state.error}</p>}
    </form>
  );
}
