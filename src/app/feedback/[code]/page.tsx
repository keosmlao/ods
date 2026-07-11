import { feedbackGate } from "@/app/actions/installation";
import { FeedbackForm, type Topic } from "@/components/installation/feedback-form";
import { query } from "@/lib/db";
import { notFound } from "next/navigation";

/**
 * ແບບສອບຖາມລູກຄ້າ — ໜ້ານີ້ເປັນ "ສາທາລະນະ" (ບໍ່ຕ້ອງ login) ຈຶ່ງຢູ່ນອກກຸ່ມ (app).
 * ຖອດແບບຈາກ ods: /feedback2/<id> + /feedback3/<id> + /save_cust_complain[_new]
 * + /feedback_finish + /feedback_finish_already (install_admin.py).
 *
 * ໃນ ods ມີ 2 ສະບັບ (feedback2 ເກົ່າ / feedback3 ໃໝ່) ທີ່ໃຊ້ຄຳຖາມຊຸດດຽວກັນ (topic_code '002')
 * — ບ່ອນນີ້ລວມເປັນໜ້າດຽວ.
 *
 * ── ຄວາມປອດໄພ (B1) ──
 * ໜ້ານີ້ບໍ່ມີ session ແລະ ລະຫັດ INST-xxxx ເປັນເລກລຽງ (ເດົາໄດ້). ດ່ານກວດຢູ່ຝັ່ງ server
 * (feedbackGate/saveFeedback): ຕອບໄດ້ສະເພາະງານທີ່ **ຕິດຕັ້ງສຳເລັດແລ້ວ** ແລະ **ບໍ່ຖືກຍົກເລີກ**
 * ແລະ ຕອບໄດ້ເທື່ອດຽວ. ນອກນັ້ນສະແດງຂໍ້ຄວາມແທນຟອມ.
 *
 * ── ເລື່ອງ token ໃນ URL ──
 * ບໍ່ໄດ້ເພີ່ມ. ຕາຕະລາງ ods_tb_install ບໍ່ມີຖັນເກັບ token ແລະ ການເພີ່ມຖັນເປັນ DDL ເຊິ່ງນອກຂອບເຂດ.
 * ເຖິງຈະສ້າງ token ແບບ HMAC(AUTH_SECRET, code) ໂດຍບໍ່ຕ້ອງມີຖັນກໍ່ຕາມ — ລິ້ງເກົ່າທີ່ພິມ/ສົ່ງ
 * ໃຫ້ລູກຄ້າໄປແລ້ວບໍ່ມີ token ຈຶ່ງຕ້ອງຍອມຮັບ URL ທີ່ບໍ່ມີ token ຕໍ່ໄປ ⇒ token ຈະບໍ່ກັນຫຍັງໄດ້ເລີຍ
 * (ຄົນເດົາລະຫັດກໍ່ພຽງແຕ່ບໍ່ໃສ່ token). ດ່ານກວດສະຖານະຂ້າງເທິງຈຶ່ງເປັນຕົວປິດຮູທີ່ແທ້ຈິງ:
 * ງານທີ່ຍັງບໍ່ຕິດຕັ້ງ ຫຼື ຖືກຍົກເລີກ ຖືກປະຕິເສດ ແລະ ງານທີ່ຕິດຕັ້ງແລ້ວ ຄຳຕອບກໍ່ບໍ່ຍ້າຍຂັ້ນ
 * ຂ້າມການຕິດຕັ້ງໄດ້ອີກ (ຮ້າຍແຮງສຸດຄື ຄະແນນປອມ ເຊິ່ງພະນັກງານແກ້ໄດ້ຢູ່ /installations/close).
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ code: string }>; searchParams: Promise<{ done?: string }> };

const POINTS: Record<number, string> = { 1: "ດີຫຼາຍ", 2: "ດີ", 3: "ພໍໃຈ", 4: "ຄວນປັບປຸງ" };

export default async function FeedbackPage({ params, searchParams }: Props) {
  const code = decodeURIComponent((await params).code);
  const { done } = await searchParams;

  const job = await query<{ code: string; item_name: string | null; cust_name: string | null }>(
    `select a.code, a.item_name, c.name_1 as cust_name
     from ods_tb_install a
     left join ar_customer c on c.code = a.cust_code
     where a.code = $1 limit 1`,
    [code],
  );
  if (!job.rows[0]) notFound();

  const answered = await query<{ line_number: number; points: number; name_1: string | null }>(
    `select a.line_number, a.points, t.name_1
     from cust_complain a
     left join topic_complain t on t.code = a.topic_code and t.line_number = a.line_number
     where a.product_code = $1 and a.topic_code = '002'
     order by a.line_number asc`,
    [code],
  );

  const shell = (children: React.ReactNode) => (
    <main className="min-h-dvh bg-slate-50 p-4">
      <div className="mx-auto max-w-2xl rounded-2xl bg-white p-6 shadow-sm sm:p-8">
        <header className="border-b border-slate-200 pb-5 text-center">
          <h1 className="text-2xl font-bold text-slate-800">ແບບສອບຖາມ</h1>
          <p className="mt-3 text-sm text-slate-600">
            ນີ້ແມ່ນແບບສອບຖາມຄວາມພື່ງພໍໃຈຂອງລູກຄ້າ ຄວາມເຫັນຂອງທ່ານຈະຊ່ວຍພັກດັນພວກເຮົາໃຫ້ດີຂື້ນ
          </p>
          <p className="mt-2 text-sm text-slate-600">ຂໍຂອບໃຈທີ່ທ່ານເລືອກ odienmall</p>
          <p className="mt-3 text-xs text-slate-400">
            {job.rows[0].code} · {job.rows[0].item_name}
          </p>
        </header>
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );

  // ຕອບແລ້ວ (ຫຼືຫາກໍບັນທຶກສຳເລັດ) → ສະແດງຄຳຕອບ
  if (answered.rows.length > 0) {
    return shell(
      <div className="space-y-5">
        {done && (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center text-sm font-semibold text-emerald-700">
            ບັນທຶກສຳເລັດ — ຂໍຂອບໃຈຫຼາຍໆ
          </p>
        )}
        <p className="text-center text-sm text-slate-500">ທ່ານໄດ້ຕອບແບບສອບຖາມນີ້ແລ້ວ</p>
        <dl className="space-y-3">
          {answered.rows.map((row) => (
            <div key={row.line_number} className="flex items-center justify-between border-b border-slate-100 pb-3">
              <dt className="text-sm text-slate-600">{row.name_1}</dt>
              <dd className="text-sm font-semibold text-slate-800">{POINTS[row.points] ?? row.points}</dd>
            </div>
          ))}
        </dl>
      </div>,
    );
  }

  // ຍັງບໍ່ຕິດຕັ້ງສຳເລັດ / ຖືກຍົກເລີກ → ບໍ່ສະແດງຟອມ (ດ່ານດຽວກັນກັບທີ່ saveFeedback ບັງຄັບ)
  const gate = await feedbackGate(code);
  if (!gate.ok) {
    return shell(
      <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-5 text-center">
        <p className="text-sm font-semibold text-amber-800">{gate.message}</p>
        <p className="text-xs text-amber-700">
          ຖ້າທ່ານຄິດວ່ານີ້ບໍ່ຖືກຕ້ອງ ກະລຸນາຕິດຕໍ່ພະນັກງານຂອງພວກເຮົາ
        </p>
      </div>,
    );
  }

  const topics = await query<Topic>(
    "select line_number, name_1 from topic_complain where code='002' order by line_number asc",
  );

  return shell(<FeedbackForm code={code} topics={topics.rows} />);
}
