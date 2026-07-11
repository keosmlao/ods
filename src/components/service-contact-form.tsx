"use client";
import { addContact } from "@/app/actions/service";
import { LoaderCircle, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const field = "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

/** ຄື /add_cust_contact/<code> ຂອງ ods — ເພີ່ມຮອບຕິດຕໍ່ລູກຄ້າ */
export function ContactForm({ code, nextRound }: { code: string; nextRound: number }) {
  const [datetime, setDatetime] = useState("");
  const [remark, setRemark] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    setError("");
    startTransition(async () => {
      const result = await addContact(code, datetime, remark);
      if (result.error) setError(result.error);
      else {
        setDatetime("");
        setRemark("");
        router.refresh();
      }
    });
  }

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-[7rem_1fr_1fr_auto] sm:items-center">
        <span className="text-sm font-semibold text-slate-600">ຮອບທີ {nextRound}</span>
        <input type="datetime-local" value={datetime} onChange={(event) => setDatetime(event.target.value)} className={field} />
        <input value={remark} onChange={(event) => setRemark(event.target.value)} placeholder="ໝາຍເຫດ" className={field} />
        <button
          type="button"
          disabled={pending}
          onClick={submit}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-60"
        >
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
          ເພີ່ມ
        </button>
      </div>
      {error && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
