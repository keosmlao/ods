import { Elapsed } from "@/components/elapsed";
import { RowLink } from "@/components/row-link";
import { CONTACT_LABEL, type ContactJob, type ContactKind } from "@/lib/customer-contact";
import { contactQueue } from "@/lib/customer-contact-queue";
import { elapsedTone } from "@/lib/elapsed-tone";
import { MobileCardList } from "@/components/mobile-card-list";
import { requireRoleOrRedirect } from "@/lib/guard";
import { SERVICE_SIDE } from "@/lib/roles";
import { CalendarClock, PackageCheck, UserCheck } from "lucide-react";
import Link from "next/link";
import { ContactActions } from "./contact-row";

/**
 * ຄິວແຈ້ງລູກຄ້າ — ງານທີ່ຈະ **ບໍ່ຂະຫຍັບ** ຈົນກວ່າຈະມີຄົນຕິດຕໍ່ລູກຄ້າ.
 *
 * ແຕ່ກ່ອນບໍ່ມີບ່ອນນີ້ເລີຍ: ໃບທີ່ລໍລູກຄ້າຕັດສິນລາຄາ (24 ໃບ) ນອນຢູ່ໃນລາຍການລວມ
 * ປົນກັບໃບອື່ນ ແລະ ບໍ່ມີໃຜຮູ້ວ່າໂທໄປແລ້ວ ຫຼື ຍັງ (LINE Notify ປິດແລ້ວ).
 * ບ່ອນນີ້ບໍ່ໄດ້ສົ່ງຂໍ້ຄວາມໃຫ້ — ມັນເປັນ **ບັນຊີວຽກໂທ** ພ້ອມເບີ, ຂໍ້ຄວາມແມ່ແບບ
 * ແລະ ບັນທຶກວ່າໃຜໂທເມື່ອໃດ (ເກັບໃນ chatter ຂອງໃບນັ້ນ).
 */
export const dynamic = "force-dynamic";

const GROUP: { kind: ContactKind; icon: typeof UserCheck; hint: string; hrefOf: (code: string) => string }[] = [
  {
    kind: "quote",
    icon: UserCheck,
    hint: "ອອກໃບສະເໜີລາຄາແລ້ວ — ວຽກຢຸດຢູ່ຈົນກວ່າລູກຄ້າຈະຕັດສິນ",
    hrefOf: (code) => `/service/${encodeURIComponent(code)}`,
  },
  {
    kind: "pickup",
    icon: PackageCheck,
    hint: "ຜ່ານການກວດຮັບຄຸນນະພາບແລ້ວ — ລໍລູກຄ້າມາຮັບ ຫຼື ນັດຈັດສົ່ງ",
    hrefOf: (code) => `/service/${encodeURIComponent(code)}`,
  },
  {
    kind: "appointment",
    icon: CalendarClock,
    hint: "ນັດພາຍໃນ 2 ມື້ຂ້າງໜ້າ (ຫຼື ເລີຍນັດແລ້ວ) ແລະ ຍັງບໍ່ໄດ້ຕິດຕັ້ງ",
    hrefOf: (code) => `/installations/${encodeURIComponent(code)}`,
  },
];

export default async function CustomerContactPage() {
  await requireRoleOrRedirect(SERVICE_SIDE);
  const jobs = await contactQueue();

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-700">ຄິວແຈ້ງລູກຄ້າ</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          ງານທີ່ຢຸດຢູ່ ຈົນກວ່າຈະມີຄົນຕິດຕໍ່ລູກຄ້າ — ບັນທຶກໄວ້ວ່າໃຜໂທເມື່ອໃດ · {jobs.length.toLocaleString()} ລາຍການ
        </p>
      </div>

      {GROUP.map((group) => {
        const rows = jobs.filter((job) => job.kind === group.kind);
        const Icon = group.icon;
        return (
          <div key={group.kind} className="space-y-2">
            <h2 className="inline-flex items-center gap-2 text-sm font-bold text-slate-700">
              <Icon className="size-4 text-teal-600" />
              {CONTACT_LABEL[group.kind]}
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                {rows.length}
              </span>
              <span className="hidden text-xs font-normal text-slate-400 sm:inline">· {group.hint}</span>
            </h2>

            {/* ── desktop: ຕາຕະລາງເດີມ (ເຊື່ອງໃນມືຖື) ── */}
            <section className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs" style={{ minWidth: 980 }}>
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                      <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ລະຫັດ</th>
                      <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ລູກຄ້າ</th>
                      <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ສິນຄ້າ</th>
                      <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ວັນທີ</th>
                      <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ລໍມາແລ້ວ</th>
                      <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ແຈ້ງລ່າສຸດ</th>
                      <th className="px-3 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((job) => (
                      <Row key={`${job.kind}-${job.code}`} job={job} href={group.hrefOf(job.code)} />
                    ))}
                  </tbody>
                </table>
              </div>

              {rows.length === 0 && <p className="py-12 text-center text-xs text-slate-400">ບໍ່ມີງານທີ່ຕ້ອງແຈ້ງ</p>}
            </section>

            {/* ── mobile: card ຕໍ່ແຖວ — ຂໍ້ມູນ ແລະ ປຸ່ມດຽວກັນກັບ desktop ── */}
            <div className="md:hidden">
              {rows.length === 0 ? (
                <p className="rounded-xl border border-slate-200 bg-white py-10 text-center text-xs text-slate-400">
                  ບໍ່ມີງານທີ່ຕ້ອງແຈ້ງ
                </p>
              ) : (
                <MobileCardList className="space-y-2">
                  {rows.map((job) => (
                    <MobileCard key={`${job.kind}-${job.code}`} job={job} href={group.hrefOf(job.code)} />
                  ))}
                </MobileCardList>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Row({ job, href }: { job: ContactJob; href: string }) {
  return (
    <RowLink href={href} className="border-b border-slate-100 hover:bg-slate-50">
      <td className="px-3 py-2.5 text-center">
        <Link href={href} className="font-semibold text-teal-700 hover:underline">
          {job.code}
        </Link>
      </td>
      <td className="px-3 py-2.5">{job.customer ?? "-"}</td>
      <td className="px-3 py-2.5">{job.product ?? "-"}</td>
      <td className="px-3 py-2.5 text-center whitespace-nowrap">{job.at ?? "-"}</td>
      <td className="px-3 py-2.5 text-center">
        <Elapsed
          seconds={job.waiting_seconds}
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${elapsedTone(job.waiting_seconds).chip}`}
        />
      </td>
      <td className="px-3 py-2.5 text-center text-xs">
        {job.last_contact ? (
          <span className="text-slate-600">
            {job.last_contact}
            {job.contacts > 1 && <span className="ml-1 text-slate-400">({job.contacts} ຄັ້ງ)</span>}
          </span>
        ) : (
          // ຍັງບໍ່ເຄີຍແຈ້ງ — ນີ້ຄືເຫດຜົນທີ່ໜ້ານີ້ມີຢູ່
          <span className="rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-600">ຍັງບໍ່ໄດ້ແຈ້ງ</span>
        )}
      </td>
      <td className="px-3 py-2.5">
        <ContactActions job={job} />
      </td>
    </RowLink>
  );
}

// ── card ສຳລັບມືຖື — ຂໍ້ມູນ ແລະ ປຸ່ມ (ContactActions) ດຽວກັນກັບແຖວ desktop ──
function MobileCard({ job, href }: { job: ContactJob; href: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <Link href={href} className="text-base font-bold text-teal-700 hover:underline">
          {job.code}
        </Link>
        <Elapsed
          seconds={job.waiting_seconds}
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${elapsedTone(job.waiting_seconds).chip}`}
        />
      </div>

      <p className="mt-1 text-sm font-medium text-slate-800">{job.product ?? "-"}</p>
      <p className="text-xs text-slate-500">{job.customer ?? "-"}</p>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
        {job.at && <span>ວັນທີ {job.at}</span>}
        {job.last_contact ? (
          <span className="text-slate-600">
            ແຈ້ງລ່າສຸດ {job.last_contact}
            {job.contacts > 1 && <span className="ml-1 text-slate-400">({job.contacts} ຄັ້ງ)</span>}
          </span>
        ) : (
          <span className="rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-600">ຍັງບໍ່ໄດ້ແຈ້ງ</span>
        )}
      </div>

      <div className="mt-2.5 border-t border-slate-100 pt-2.5">
        <ContactActions job={job} />
      </div>
    </div>
  );
}
