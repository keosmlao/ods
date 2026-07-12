"use client";
import { markContacted } from "@/app/actions/customer-contact";
import { Button, inputClass } from "@/components/ui";
import { MESSAGE_TEMPLATE, type ContactJob } from "@/lib/customer-contact";
import { Check, Copy, LoaderCircle, Phone } from "lucide-react";
import { useState, useTransition } from "react";

/**
 * ແຖວໜຶ່ງຂອງຄິວແຈ້ງລູກຄ້າ — ກົດໂທໄດ້ເລີຍ (tel:), ກັອບປີ້ຂໍ້ຄວາມແມ່ແບບ,
 * ແລ້ວບັນທຶກວ່າແຈ້ງແລ້ວພ້ອມສິ່ງທີ່ລູກຄ້າຕອບ.
 */
export function ContactActions({ job }: { job: ContactJob }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const message = MESSAGE_TEMPLATE[job.kind](job);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {job.tel && (
        <a
          href={`tel:${job.tel.replace(/\s/g, "")}`}
          className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700"
        >
          <Phone className="size-3.5" /> {job.tel}
        </a>
      )}

      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(message);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        title={message}
        className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
      >
        {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
        {copied ? "ກັອບປີ້ແລ້ວ" : "ກັອບປີ້ຂໍ້ຄວາມ"}
      </button>

      {open ? (
        <span className="flex w-full items-center gap-2 sm:w-auto">
          <input
            autoFocus
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="ລູກຄ້າຕອບວ່າ..."
            className={`${inputClass} h-8 w-56 text-xs`}
          />
          <Button
            tone="success"
            disabled={pending}
            className="h-8 px-3 text-xs"
            onClick={() =>
              start(async () => {
                await markContacted(job.kind, job.code, note);
                setOpen(false);
                setNote("");
              })
            }
          >
            {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            ບັນທຶກ
          </Button>
        </span>
      ) : (
        <Button tone="neutral" className="h-8 px-3 text-xs" onClick={() => setOpen(true)}>
          ບັນທຶກວ່າແຈ້ງແລ້ວ
        </Button>
      )}
    </div>
  );
}
