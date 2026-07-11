"use client";
import { updateFeedback } from "@/app/actions/installation";
import { Button } from "@/components/ui";
import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * ແກ້ໄຂຄຳຕິຊົມ / ຄະແນນຂອງລູກຄ້າ ຫຼັງຈາກສົ່ງແບບສອບຖາມແລ້ວ.
 * ຖອດແບບຈາກ ods: /save_cust_complain_new (install_admin.py:1425) — ຕ້ອງ login ຄືກັນ.
 */

export type FeedbackAnswer = { line: number; points: number };
export type FeedbackTopic = { line_number: number; name_1: string };

const POINTS: Record<number, string> = { 1: "ດີຫຼາຍ", 2: "ດີ", 3: "ພໍໃຈ", 4: "ຄວນປັບປຸງ" };

export function FeedbackEditButton({
  code,
  comment,
  topics,
  answers,
}: {
  code: string;
  comment: string;
  topics: FeedbackTopic[];
  answers: FeedbackAnswer[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const current = new Map(answers.map((answer) => [answer.line, answer.points]));

  return (
    <>
      <button
        type="button"
        title="ແກ້ໄຂຄຳຕິຊົມ"
        className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline"
        onClick={() => {
          setError("");
          setOpen(true);
        }}
      >
        <Pencil className="size-3.5" />
        ແກ້ໄຂຄຳຕິຊົມ
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <form
            className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl"
            action={(formData) =>
              start(async () => {
                const result = await updateFeedback({}, formData);
                if (result.error) setError(result.error);
                else {
                  setOpen(false);
                  router.refresh();
                }
              })
            }
          >
            <input type="hidden" name="code" value={code} />
            <div className="rounded-t-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white">
              ແກ້ໄຂແບບສອບຖາມ · {code}
            </div>

            <div className="space-y-4 p-5">
              {topics.map((topic) => (
                <fieldset key={topic.line_number} className="border-b border-slate-100 pb-3">
                  <legend className="mb-2 text-xs font-semibold text-slate-700">{topic.name_1}</legend>
                  <div className="flex flex-wrap gap-3">
                    {[1, 2, 3, 4].map((point) => (
                      <label key={point} className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
                        <input
                          type="radio"
                          required
                          name={`points_${topic.line_number}`}
                          value={point}
                          defaultChecked={current.get(topic.line_number) === point}
                          className="size-4 accent-teal-600"
                        />
                        {POINTS[point]}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">ຄຳເຫັນລູກຄ້າ</label>
                <textarea
                  name="cust_complain"
                  rows={3}
                  defaultValue={comment}
                  placeholder="ຄຳຕິຊົມຂອງລູກຄ້າ..."
                  className="w-full rounded-lg border border-slate-300 p-3 text-xs outline-none focus:border-teal-500"
                />
              </div>

              {error && <p className="text-xs text-red-600">{error}</p>}
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 p-4">
              <Button type="button" tone="neutral" className="h-9 text-xs" onClick={() => setOpen(false)}>
                ອອກ
              </Button>
              <Button type="submit" tone="primary" className="h-9 text-xs" disabled={pending}>
                {pending ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກ"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
