import { Elapsed } from "@/components/elapsed";
import { RowLink } from "@/components/row-link";
import { CONTACT_LABEL, type ContactJob, type ContactKind } from "@/lib/customer-contact";
import { contactQueue } from "@/lib/customer-contact-queue";
import { elapsedTone } from "@/lib/elapsed-tone";
import { type Dictionary, getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
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

type Dict = Dictionary["customerContact"];

const GROUP: { kind: ContactKind; icon: typeof UserCheck; hintKey: keyof Dict; hrefOf: (code: string) => string }[] = [
  {
    kind: "quote",
    icon: UserCheck,
    hintKey: "reasonQuotation",
    hrefOf: (code) => `/service/${encodeURIComponent(code)}`,
  },
  {
    kind: "pickup",
    icon: PackageCheck,
    hintKey: "reasonQc",
    hrefOf: (code) => `/service/${encodeURIComponent(code)}`,
  },
  {
    kind: "appointment",
    icon: CalendarClock,
    hintKey: "reasonAppointment",
    hrefOf: (code) => `/installations/${encodeURIComponent(code)}`,
  },
];

export default async function CustomerContactPage() {
  await requireRoleOrRedirect(SERVICE_SIDE);
  const jobs = await contactQueue();
  const t = (await getDictionary(await getLocale())).customerContact;

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-700">{t.title}</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          {t.subtitle} · {jobs.length.toLocaleString()} {t.items}
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
              <span className="hidden text-xs font-normal text-slate-400 sm:inline">· {t[group.hintKey]}</span>
            </h2>

            {/* ── desktop: ຕາຕະລາງເດີມ (ເຊື່ອງໃນມືຖື) ── */}
            <section className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs" style={{ minWidth: 980 }}>
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                      <th className="whitespace-nowrap px-3 py-2.5 font-semibold">{t.code}</th>
                      <th className="whitespace-nowrap px-3 py-2.5 font-semibold">{t.customer}</th>
                      <th className="whitespace-nowrap px-3 py-2.5 font-semibold">{t.product}</th>
                      <th className="whitespace-nowrap px-3 py-2.5 font-semibold">{t.date}</th>
                      <th className="whitespace-nowrap px-3 py-2.5 font-semibold">{t.waited}</th>
                      <th className="whitespace-nowrap px-3 py-2.5 font-semibold">{t.lastContact}</th>
                      <th className="px-3 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((job) => (
                      <Row key={`${job.kind}-${job.code}`} job={job} href={group.hrefOf(job.code)} t={t} />
                    ))}
                  </tbody>
                </table>
              </div>

              {rows.length === 0 && <p className="py-12 text-center text-xs text-slate-400">{t.noJobs}</p>}
            </section>

            {/* ── mobile: card ຕໍ່ແຖວ — ຂໍ້ມູນ ແລະ ປຸ່ມດຽວກັນກັບ desktop ── */}
            <div className="md:hidden">
              {rows.length === 0 ? (
                <p className="rounded-xl border border-slate-200 bg-white py-10 text-center text-xs text-slate-400">
                  {t.noJobs}
                </p>
              ) : (
                <MobileCardList className="space-y-2">
                  {rows.map((job) => (
                    <MobileCard key={`${job.kind}-${job.code}`} job={job} href={group.hrefOf(job.code)} t={t} />
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

function Row({ job, href, t }: { job: ContactJob; href: string; t: Dict }) {
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
            {job.contacts > 1 && <span className="ml-1 text-slate-400">({job.contacts} {t.timesUnit})</span>}
          </span>
        ) : (
          // ຍັງບໍ່ເຄີຍແຈ້ງ — ນີ້ຄືເຫດຜົນທີ່ໜ້ານີ້ມີຢູ່
          <span className="rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-600">{t.notContacted}</span>
        )}
      </td>
      <td className="px-3 py-2.5">
        <ContactActions job={job} />
      </td>
    </RowLink>
  );
}

// ── card ສຳລັບມືຖື — ຂໍ້ມູນ ແລະ ປຸ່ມ (ContactActions) ດຽວກັນກັບແຖວ desktop ──
function MobileCard({ job, href, t }: { job: ContactJob; href: string; t: Dict }) {
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
        {job.at && <span>{t.date} {job.at}</span>}
        {job.last_contact ? (
          <span className="text-slate-600">
            {t.lastContact} {job.last_contact}
            {job.contacts > 1 && <span className="ml-1 text-slate-400">({job.contacts} {t.timesUnit})</span>}
          </span>
        ) : (
          <span className="rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-600">{t.notContacted}</span>
        )}
      </div>

      <div className="mt-2.5 border-t border-slate-100 pt-2.5">
        <ContactActions job={job} />
      </div>
    </div>
  );
}
