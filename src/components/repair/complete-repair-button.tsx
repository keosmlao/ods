"use client";

import { saveRepair } from "@/app/actions/repair";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";

/** ປິດວຽກສ້ອມຈາກໜ້າລາຍການ — ແທນໜ້າ /repair/[code] ທີ່ຖືກລົບ. */
export function CompleteRepairButton({ code, initialNote = "" }: { code: string; initialNote?: string }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(initialNote);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  return (
    <>
      <Button
        type="button"
        tone="success"
        size="sm"
        disabled={pending}
        onClick={() => {
          setError("");
          setOpen(true);
        }}
      >
        {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
        ສ້ອມສຳເລັດ
      </Button>

      <ConfirmDialog
        open={open}
        title={`ບັນທຶກສ້ອມແປງສຳເລັດ #${code}`}
        confirmLabel="ຢືນຢັນສຳເລັດ"
        pending={pending}
        message={
          <div className="space-y-2">
            <p>ວຽກຈະຖືກສົ່ງໄປຄິວລໍກວດ QC.</p>
            <label className="block text-left">
              <span className="mb-1 block font-medium text-slate-600">ວິທີແກ້ໄຂ / ໝາຍເຫດຊ່າງ</span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={4}
                placeholder="ລະບຸວິທີແກ້ໄຂ..."
                className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700 outline-none focus:border-teal-500"
              />
            </label>
            {error && <p className="font-medium text-red-600">{error}</p>}
          </div>
        }
        onCancel={() => {
          if (!pending) setOpen(false);
        }}
        onConfirm={() =>
          start(async () => {
            const data = new FormData();
            data.set("pro_code", code);
            data.set("repair_note", note);
            const result = await saveRepair({}, data);
            if (result?.error) setError(result.error);
          })
        }
      />
    </>
  );
}
