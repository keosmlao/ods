import { Empty, LinkButton, PageTitle, Table } from "@/components/ui";
import { BillDismissButton, BillRestoreButton } from "@/components/installation/bill-dismiss-button";
import { pendingInstallBills } from "@/lib/pending-bills";
import { CalendarClock, FilePlus2, Phone, Search, TriangleAlert } from "lucide-react";
import Link from "next/link";

/**
 * **ບິນທີ່ຄ້າງອອກໃບງານ** — ລູກຄ້າຈ່າຍຄ່າຕິດຕັ້ງແລ້ວ ແຕ່ຍັງບໍ່ມີໃບງານ (ຫຼື ມີບໍ່ຄົບ).
 *
 * ຄິວທຸກໜ້າຂອງໂມດູນຕິດຕັ້ງເລີ່ມນັບຈາກ "ໃບງານທີ່ເປີດແລ້ວ" ⇒ ບິນທີ່ລືມເປີດ **ບໍ່ປາກົດຢູ່ໃສເລີຍ**.
 * ໜ້ານີ້ຄືດ້ານກົງກັນຂ້າມ: ເລີ່ມຈາກ **ເງິນທີ່ຮັບມາແລ້ວ** ແລ້ວຖາມວ່າ "ງານຢູ່ໃສ".
 *
 * ── ອອກແບບ ──
 * ນີ້ຄື **ຄິວວຽກ** ບໍ່ແມ່ນລາຍງານ ⇒ ແຕ່ລະແຖວຕ້ອງຕອບ 3 ຄຳຖາມທັນທີ:
 *   ຄ້າງດົນປານໃດ (ສີບອກຄວາມຮ້ອນ) · ໃຜ/ໂທຫາໃສ · ຂາດຈັກໜ່ວຍ ⇒ ກົດເປີດ
 * ຮຸ່ນກ່ອນເປັນຕາຕະລາງ 8 ຖັນ ທີ່ມີ 3 ຖັນຕົວເລກ (ຈ່າຍ · ເປີດແລ້ວ · ຂາດ) ⇒ ຄົນຕ້ອງລົບເລກເອງ.
 * ດຽວນີ້ເປັນ **ແຖບຄວາມຄືບໜ້າ** (ເປີດແລ້ວ 1/2) ອ່ານໄດ້ທັນທີ.
 */
export const dynamic = "force-dynamic";

type Tab = "all" | "dismissed";
type Props = { searchParams: Promise<{ tab?: string; q?: string }> };

/** ຄ້າງເກີນນີ້ = ລູກຄ້າລໍດົນເກີນໄປ (ຈ່າຍເງິນແລ້ວ) */
const LATE = 7;

export default async function PendingBillsPage({ searchParams }: Props) {
  const params = await searchParams;
  const tab: Tab = params.tab === "dismissed" ? "dismissed" : "all";
  const q = (params.q ?? "").trim().toLowerCase();

  // ບິນທີ່ຄ້າງຈິງ + ບິນທີ່ **ຖືກໝາຍວ່າຄົບແລ້ວ** (ເກັບໄວ້ໃຫ້ຍົກເລີກການໝາຍໄດ້)
  const [all, dismissed] = await Promise.all([pendingInstallBills(), pendingInstallBills(true)]);
  const bucket = tab === "dismissed" ? dismissed : all;
  const rows = q
    ? bucket.filter((bill) =>
        `${bill.doc_no} ${bill.cust_name ?? ""} ${bill.telephone ?? ""}`.toLowerCase().includes(q),
      )
    : bucket;

  // ບິນທີ່ຍັງບໍ່ມີໃບງານຈັກໃບ ⇒ ໜ່ວຍທີ່ຄ້າງ = ຈຳນວນຄ່າຕິດຕັ້ງທີ່ຈ່າຍມາທັງໝົດ
  const units = all.reduce((sum, bill) => sum + bill.paid, 0);
  const oldest = all[0]?.days ?? 0;
  const late = all.filter((bill) => bill.days >= LATE).length;

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: "all", label: "ຍັງບໍ່ມີໃບງານ", count: all.length },
    { key: "dismissed", label: "ໝາຍວ່າຄົບແລ້ວ", count: dismissed.length },
  ];

  const href = (next: Tab) =>
    `/installations/pending-bills?${new URLSearchParams({ ...(next !== "all" && { tab: next }), ...(q && { q }) })}`;

  return (
    <div className="w-full space-y-4">
      <PageTitle sub="ລູກຄ້າຈ່າຍຄ່າຕິດຕັ້ງແລ້ວ ແຕ່ຍັງບໍ່ມີໃບງານ — ຄ້າງດົນສຸດຂຶ້ນກ່ອນ">
        ບິນຄ້າງອອກໃບງານ
      </PageTitle>

      {/* ສະຫຼຸບ 3 ຕົວເລກທີ່ຕັດສິນໃຈໄດ້ — ບໍ່ແມ່ນປະໂຫຍກຍາວ */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="ໜ່ວຍທີ່ຍັງບໍ່ມີໃຜໄປຕິດ" value={units} tone="danger" note={`${all.length} ບິນ`} />
        <Stat label={`ຄ້າງເກີນ ${LATE} ມື້`} value={late} tone="warn" note="ລູກຄ້າຈ່າຍເງິນແລ້ວ" />
        <Stat label="ບິນເກົ່າສຸດຄ້າງມາ" value={oldest} tone="plain" note="ມື້" />
      </div>

      {/* ແທັບ + ຄົ້ນຫາ (ຮູບແບບດຽວກັບໜ້າຄິວອື່ນ) */}
      <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
        {TABS.map((item) => (
          <Link
            key={item.key}
            href={href(item.key)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition ${
              tab === item.key ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {item.label}
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                tab === item.key ? "bg-white/20" : "bg-slate-100 text-slate-500"
              }`}
            >
              {item.count}
            </span>
          </Link>
        ))}

        <form className="ml-auto flex min-w-64 items-center md:max-w-sm">
          {tab !== "all" && <input type="hidden" name="tab" value={tab} />}
          <div className="flex h-9 w-full items-center gap-2 rounded-lg border border-slate-300 bg-white px-2.5 focus-within:border-teal-500">
            <Search className="size-3.5 shrink-0 text-slate-400" />
            <input
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="ຄົ້ນຫາ ເລກບິນ, ລູກຄ້າ, ເບີໂທ..."
              className="w-full text-xs outline-none"
            />
          </div>
        </form>
      </div>

      {rows.length === 0 ? (
        <Empty>{q ? "ບໍ່ພົບບິນຕາມຄຳຄົ້ນ" : "ບໍ່ມີບິນຄ້າງ — ທຸກບິນທີ່ຈ່າຍຄ່າຕິດຕັ້ງ ມີໃບງານຄົບແລ້ວ"}</Empty>
      ) : (
        <Table head={["ຄ້າງມາ", "ເລກບິນ", "ສິນຄ້າທີ່ຈະຕິດຕັ້ງ", "ລູກຄ້າ", "ຈ່າຍຄ່າຕິດຕັ້ງ", ""]} minWidth={1150}>
          {rows.map((bill) => {
            const overdue = bill.days >= LATE;
            return (
              <tr key={bill.doc_no} className="border-b border-slate-100 hover:bg-slate-50">
                {/* ① ຄ້າງດົນປານໃດ — ຄ່າທີ່ຈັດລຳດັບຄວາມສຳຄັນ */}
                <td className="whitespace-nowrap px-3 py-2.5 text-center">
                  <span
                    className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-bold tabular-nums ${
                      overdue ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    <CalendarClock className="size-3" />
                    {bill.days} ມື້
                  </span>
                </td>

                <td className="whitespace-nowrap px-3 py-2.5">
                  <span className="block font-bold text-slate-800">{bill.doc_no}</span>
                  <span className="block text-[11px] text-slate-400">
                    {bill.doc_date.split("-").reverse().join("-")}
                  </span>
                  {/* ຖືກໝາຍໄວ້ ⇒ ບອກເຫດຜົນ ແລະ ໃຜໝາຍ (ຫຼັກຖານ) */}
                  {bill.dismissed && (
                    <span className="mt-0.5 block text-[11px] font-semibold text-slate-500">
                      ຄົບແລ້ວ: {bill.dismissed.reason} · {bill.dismissed.by}
                    </span>
                  )}
                </td>

                {/* ② ບິນນີ້ຈະໄປຕິດ **ຫຍັງ** — ບອກແຕ່ "ຄ້າງ 1 ໜ່ວຍ" ບໍ່ພຽງພໍ ⇒ ຈັດຊ່າງ/ອາໄຫຼ່ບໍ່ຖືກ */}
                <td className="px-3 py-2.5">
                  {bill.items.length === 0 ? (
                    <span className="text-xs text-slate-400">
                      — ບໍ່ພົບສິນຄ້າທີ່ຕິດຕັ້ງໄດ້ໃນບິນ (ອາດເປັນຄ່າບໍລິການລ້ວນ) —
                    </span>
                  ) : (
                    <ul className="space-y-0.5">
                      {bill.items.map((item) => (
                        <li key={item.item_code} className="text-xs text-slate-700">
                          <span className="font-semibold">{item.item_name}</span>
                          <span className="ml-1 text-slate-400">× {item.qty}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {/* ຄ່າບໍລິການຕິດຕັ້ງທີ່ພະນັກງານຂາຍໃສ່ໄວ້ — ນີ້ຄືສາເຫດທີ່ບິນນີ້ຢູ່ໃນຄິວ */}
                  {bill.services.map((service) => (
                    <p key={service.item_code} className="mt-0.5 text-[11px] font-semibold text-teal-700">
                      🛠 {service.item_name} × {service.qty}
                    </p>
                  ))}
                </td>

                <td className="px-3 py-2.5">
                  <span className="block truncate text-sm text-slate-700">{bill.cust_name || "-"}</span>
                  {bill.telephone && (
                    <a
                      href={`tel:${bill.telephone}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"
                    >
                      <Phone className="size-3" />
                      {bill.telephone}
                    </a>
                  )}
                </td>

                {/* ② ຈຳນວນທີ່ຈ່າຍຄ່າຕິດຕັ້ງ = ຈຳນວນໃບງານທີ່ຄວນເປີດ */}
                <td className="whitespace-nowrap px-3 py-2.5 text-center text-sm font-bold text-red-600 tabular-nums">
                  {bill.paid} ໜ່ວຍ
                </td>

                {/* ③ ລົງມື — ເປີດໃບງານ ຫຼື ໝາຍວ່າຄົບແລ້ວ (ບາງບິນບໍ່ຕ້ອງມີໃບງານແທ້ໆ) */}
                <td className="whitespace-nowrap px-3 py-2.5 text-right">
                  {bill.dismissed ? (
                    <BillRestoreButton docNo={bill.doc_no} />
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <BillDismissButton docNo={bill.doc_no} />
                      <LinkButton
                        href={`/installations/new?bill=${encodeURIComponent(bill.doc_no)}`}
                        tone="success"
                        className="h-9 text-xs"
                      >
                        <FilePlus2 className="size-3.5" />
                        ເປີດໃບງານ
                      </LinkButton>
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </Table>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: number;
  note: string;
  tone: "danger" | "warn" | "plain";
}) {
  const color =
    tone === "danger"
      ? "border-red-200 bg-red-50 text-red-700"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-slate-200 bg-white text-slate-700";
  return (
    <div className={`rounded-xl border p-3 ${color}`}>
      <p className="flex items-center gap-1.5 text-xs font-semibold">
        {tone !== "plain" && <TriangleAlert className="size-3.5" />}
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums">
        {value.toLocaleString()}
        <span className="ml-1 text-xs font-normal opacity-70">{note}</span>
      </p>
    </div>
  );
}
