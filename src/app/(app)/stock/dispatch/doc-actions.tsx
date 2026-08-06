"use client";

import { deleteDispatch, editDispatch, type StockState } from "@/app/actions/stock";
import { LoaderCircle, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * **ແກ້ໄຂ / ລົບ ໃບເບີກອາໄຫຼ່** — ຢູ່ແຖວຂອງແທັບ "ເບີກແລ້ວ".
 *
 * ⚠️ ນີ້ບໍ່ແມ່ນການລົບແຖວໜ້າຈໍ — ມັນ **ຄືນສະຕັອກຈິງ ແລະ ຖອຍຂັ້ນງານ** ທັງສອງຖານ
 * (ເບິ່ງ actions/stock.deleteDispatch) ⇒ ຕ້ອງຢືນຢັນກ່ອນ ແລະ ບອກຜົນທີ່ຈະເກີດໃຫ້ຊັດ.
 * ດ່ານຈິງຢູ່ server (ຊ່າງຮັບໄປແລ້ວ ຫຼື ມີໃບຂໍຄືນ ⇒ ປະຕິເສດ) — ບ່ອນນີ້ພຽງແຕ່ຖາມ.
 */
export function DocActions({ docNo, docRef }: { docNo: string; docRef: string | null }) {
  const router = useRouter();
  const [ask, setAsk] = useState<"" | "delete" | "edit">("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const run = (mode: "delete" | "edit") =>
    start(async () => {
      const data = new FormData();
      data.set("doc_no", docNo);
      data.set("doc_ref", docRef ?? "");
      // editDispatch ຈົບດ້ວຍ redirect ⇒ ບໍ່ຄືນຄ່າ (Next ໂຍນ error ພິເສດຂອງມັນເອງ)
      const result: StockState = mode === "delete" ? await deleteDispatch({}, data) : await editDispatch({}, data);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setAsk("");
      router.refresh();
    });

  return (
    <>
      <span className="inline-flex items-center gap-1">
        <button
          type="button"
          title="ແກ້ໄຂ (ລົບແລ້ວອອກໃໝ່)"
          onClick={() => {
            setError("");
            setAsk("edit");
          }}
          className="grid size-8 place-items-center rounded-lg text-brand-700 hover:bg-brand-50"
        >
          <Pencil className="size-4" />
        </button>
        <button
          type="button"
          title="ລົບໃບເບີກ"
          onClick={() => {
            setError("");
            setAsk("delete");
          }}
          className="grid size-8 place-items-center rounded-lg text-brand-orange-700 hover:bg-brand-orange-50"
        >
          <Trash2 className="size-4" />
        </button>
      </span>

      {ask && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-brand-900/50 p-4" onClick={() => setAsk("")}>
          <div
            className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 text-left shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-base font-bold text-slate-800">
              {ask === "delete" ? `ລົບໃບເບີກ ${docNo}?` : `ແກ້ໄຂໃບເບີກ ${docNo}?`}
            </h2>
            <div className="rounded-lg bg-brand-orange-50 px-3 py-2 text-xs text-brand-orange-700">
              <p className="font-semibold">ຈະເກີດຂຶ້ນ:</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                <li>ລົບເອກະສານທັງ ERP ແລະ ODSS</li>
                <li>ອາໄຫຼ່ຄືນເຂົ້າສະຕັອກ</li>
                <li>ໃບຂໍເບີກ {docRef || "-"} ກັບເປັນ “ລໍສາງເບີກ”</li>
                <li>ຂັ້ນຂອງງານຖອຍກັບ</li>
                {ask === "edit" && <li className="font-semibold">ແລ້ວພາໄປໜ້າເບີກ ເພື່ອອອກໃບໃໝ່</li>}
              </ul>
            </div>
            {error && <p className="rounded-lg bg-brand-orange-100 px-3 py-2 text-xs text-brand-orange-700">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAsk("")}
                className="h-9 rounded-lg border border-slate-300 px-4 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                ຍົກເລີກ
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(ask)}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-orange-600 px-4 text-xs font-semibold text-white hover:bg-brand-orange-700 disabled:opacity-60"
              >
                {pending && <LoaderCircle className="size-3.5 animate-spin" />}
                {ask === "delete" ? "ລົບ ແລະ ຄືນສະຕັອກ" : "ລົບແລ້ວອອກໃໝ່"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
