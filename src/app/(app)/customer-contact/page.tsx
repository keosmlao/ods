import { Elapsed } from "@/components/elapsed";
import { Card, Empty, PageTitle, Table } from "@/components/ui";
import { CONTACT_LABEL, type ContactJob, type ContactKind } from "@/lib/customer-contact";
import { contactQueue } from "@/lib/customer-contact-queue";
import { elapsedTone } from "@/lib/elapsed-tone";
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
    <div className="space-y-6">
      <PageTitle sub="ງານທີ່ຢຸດຢູ່ ຈົນກວ່າຈະມີຄົນຕິດຕໍ່ລູກຄ້າ — ບັນທຶກໄວ້ວ່າໃຜໂທເມື່ອໃດ">ຄິວແຈ້ງລູກຄ້າ</PageTitle>

      {GROUP.map((group) => {
        const rows = jobs.filter((job) => job.kind === group.kind);
        const Icon = group.icon;
        return (
          <Card
            key={group.kind}
            title={
              <span className="inline-flex items-center gap-2">
                <Icon className="size-4 text-teal-600" />
                {CONTACT_LABEL[group.kind]}
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                  {rows.length}
                </span>
                <span className="hidden text-xs font-normal text-slate-400 sm:inline">· {group.hint}</span>
              </span>
            }
          >
            {rows.length === 0 ? (
              <Empty>ບໍ່ມີງານທີ່ຕ້ອງແຈ້ງ</Empty>
            ) : (
              <Table head={["ລະຫັດ", "ລູກຄ້າ", "ສິນຄ້າ", "ວັນທີ", "ລໍມາແລ້ວ", "ແຈ້ງລ່າສຸດ", ""]} minWidth={980}>
                {rows.map((job) => (
                  <Row key={`${job.kind}-${job.code}`} job={job} href={group.hrefOf(job.code)} />
                ))}
              </Table>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function Row({ job, href }: { job: ContactJob; href: string }) {
  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50">
      <td className="px-3 py-2 text-center">
        <Link href={href} className="font-semibold text-teal-700 hover:underline">
          {job.code}
        </Link>
      </td>
      <td className="px-3 py-2">{job.customer ?? "-"}</td>
      <td className="px-3 py-2">{job.product ?? "-"}</td>
      <td className="px-3 py-2 text-center whitespace-nowrap">{job.at ?? "-"}</td>
      <td className="px-3 py-2 text-center">
        <Elapsed
          seconds={job.waiting_seconds}
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${elapsedTone(job.waiting_seconds).chip}`}
        />
      </td>
      <td className="px-3 py-2 text-center text-xs">
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
      <td className="px-3 py-2">
        <ContactActions job={job} />
      </td>
    </tr>
  );
}
