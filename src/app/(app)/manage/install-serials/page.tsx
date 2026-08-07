import { requireRoleOrRedirect } from "@/lib/guard";
import { planInstallSerialBackfill } from "@/lib/install-serial-backfill";
import { BackfillButton } from "./backfill-button";
import { Barcode } from "lucide-react";

/**
 * **ຕື່ມ ISN/SN ຄືນໃຫ້ໃບງານຕິດຕັ້ງເກົ່າ** — ລ້າງຂໍ້ມູນເທື່ອດຽວ ໂດຍຜູ້ຈັດການກົດເອງ.
 *
 * ── ເປັນຫຍັງເປັນໜ້າ ບໍ່ແມ່ນ script ──
 * ການແກ້ຂໍ້ມູນ 1,000 ກວ່າຊ່ອງໃນຖານຈິງ ຄວນມີຄົນ**ເຫັນກ່ອນ ແລ້ວຕັດສິນໃຈກົດ** ບໍ່ແມ່ນ
 * ຄົນໃດຄົນໜຶ່ງແລ່ນ psql ຢູ່ເຄື່ອງຕົນ. ໜ້ານີ້ສະແດງແຜນ (ຈະຕື່ມຈັກຊ່ອງ · ໃບໃດແດ່ ·
 * ຄ່າຫຍັງ) ແລ້ວຈຶ່ງມີປຸ່ມ — ແລະ ທຸກແຖວທີ່ຕື່ມຖືກບັນທຶກໃນປະຫວັດຂອງໃບງານນັ້ນ.
 *
 * ໃບງານ**ໃໝ່**ບໍ່ຕ້ອງໃຊ້ໜ້ານີ້: ຊ່າງເກັບ ISN/SN ຢູ່ໜ້າງານຜ່ານແອັບ (lib/install-scan).
 */
export const dynamic = "force-dynamic";

export default async function InstallSerialBackfillPage() {
  await requireRoleOrRedirect(["manager"]);
  const plan = await planInstallSerialBackfill();

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-700">
          <Barcode className="size-5" />
          ຕື່ມ ISN/SN ຄືນໃຫ້ໃບງານຕິດຕັ້ງເກົ່າ
        </h1>
        <p className="mt-0.5 text-xs text-slate-500">
          ດຶງຈາກ <b>ໃບຈ່າຍສິນຄ້າອອກສາງ</b> ຂອງບິນ — ຕື່ມສະເພາະຊ່ອງທີ່ຫວ່າງ ບໍ່ທັບຂອງທີ່ຄົນໃສ່ໄວ້
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "ຊ່ອງທີ່ຈະຕື່ມ", value: plan.slots },
          { label: "ໃບງານ", value: plan.jobs },
          { label: "ໃນນັ້ນເປັນໜ່ວຍນອກ (ແອ)", value: plan.outdoor },
        ].map((box) => (
          <div key={box.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">{box.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-brand-800">{box.value.toLocaleString()}</p>
          </div>
        ))}
      </section>

      {plan.slots === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-400">
          ບໍ່ມີຫຍັງໃຫ້ຕື່ມ — ໃບງານທີ່ຂາດເລກ ບິນຂອງມັນບໍ່ໄດ້ລົງ ISN ໄວ້ ຫຼື ໜ່ວຍຖືກໃບອື່ນຈອງໄປແລ້ວ
        </p>
      ) : (
        <>
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-600">
              ຕົວຢ່າງ {plan.sample.length} ແຖວທຳອິດ
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-600">
                    <th className="px-3 py-2 font-semibold">ໃບງານ</th>
                    <th className="px-3 py-2 font-semibold">ໜ່ວຍ</th>
                    <th className="px-3 py-2 font-semibold">ISN ຈາກໃບຈ່າຍ</th>
                    <th className="px-3 py-2 font-semibold">ຄ່າທີ່ຈະໃສ່</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.sample.map((row) => (
                    <tr key={`${row.code}-${row.outdoor}`} className="border-b border-slate-100">
                      <td className="px-3 py-2 font-bold text-brand">{row.code}</td>
                      <td className="px-3 py-2">{row.outdoor ? "ໜ່ວຍນອກ" : "ໜ່ວຍໃນ"}</td>
                      <td className="px-3 py-2 font-mono text-[11px] text-slate-500">{row.isn}</td>
                      <td className="px-3 py-2 font-mono text-[11px]">{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <BackfillButton slots={plan.slots} jobs={plan.jobs} />
        </>
      )}
    </div>
  );
}
