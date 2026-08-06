"use client";
import { deleteReturnRequest, editReturnRequest } from "@/app/actions/stock";
import { useConfirm } from "@/components/confirm-dialog";
import { useDict } from "@/lib/i18n/context";
import { LoaderCircle, Pencil, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

/**
 * ປຸ່ມ **ແກ້ໄຂ / ລົບ** ຂອງໃບຂໍສົ່ງຄືນທີ່ **ຍັງບໍ່ໄດ້ຮັບເຂົ້າສາງ**.
 *
 * ⚠️ ບໍ່ໂຊ້ວຢູ່ແທັບ "ຮັບຄືນແລ້ວ": ຮັບເຂົ້າແລ້ວ = ສະຕັອກຍ້າຍໄປແລ້ວ ⇒ ແກ້ຢູ່ ODSS ບໍ່ໄດ້
 * (ຝັ່ງ action ກວດຊ້ຳອີກຊັ້ນ — ປຸ່ມຫາຍໄປບໍ່ພໍ, ຄົນຍິງ action ຊື່ໆໄດ້).
 *
 * "ແກ້ໄຂ" = ຍົກເລີກໃບເກົ່າ ແລ້ວພາໄປຟອມຂອງໃບເບີກ ເພື່ອເລືອກລາຍການໃໝ່ (ໄດ້ເລກໃບໃໝ່)
 * — ບອກໃຫ້ຄົນຮູ້ໃນກ່ອງຢືນຢັນ ບໍ່ໃຫ້ເຂົ້າໃຈວ່າເລກໃບເກົ່າຍັງຢູ່.
 */
export function ReturnRowActions({ docNo, docRef }: { docNo: string; docRef: string | null }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const { ask, dialog } = useConfirm();
  const t = useDict().receiveReturns;
  /** ຕື່ມເລກໃບໃສ່ຂໍ້ຄວາມແປ ({doc} = ໃບຂໍຄືນ · {ref} = ໃບເບີກ) */
  const fill = (text: string) => text.replace("{doc}", docNo).replace("{ref}", docRef ?? "-");

  const run = (action: "edit" | "delete") => async () => {
    const ok = await ask(
      action === "delete"
        ? {
            title: t.deleteTitle,
            message: fill(t.deleteMessage),
            confirmLabel: t.deleteConfirm,
            tone: "danger",
          }
        : {
            title: t.editTitle,
            message: fill(t.editMessage),
            confirmLabel: t.edit,
          },
    );
    if (!ok) return;
    setError("");
    const data = new FormData();
    data.set("doc_no", docNo);
    data.set("doc_ref", docRef ?? "");
    start(async () => {
      const result = action === "delete" ? await deleteReturnRequest({}, data) : await editReturnRequest({}, data);
      if (result?.error) setError(result.error);
    });
  };

  return (
    <>
      {dialog}
      <span className="inline-flex items-center gap-1.5">
        {docRef && (
          <button
            type="button"
            disabled={pending}
            onClick={run("edit")}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Pencil className="size-3.5" />}
            {t.edit}
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={run("delete")}
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-brand-orange-400 bg-white px-2.5 text-xs font-semibold text-brand-orange-700 hover:bg-brand-orange-50 disabled:opacity-60"
        >
          <Trash2 className="size-3.5" />
          {t.delete}
        </button>
      </span>
      {error && <p className="mt-1 text-[10px] font-semibold text-brand-orange-700">{error}</p>}
    </>
  );
}
