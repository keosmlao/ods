import { LinkPending } from "@/components/link-pending";
import {
  Boxes,
  ClipboardCheck,
  ClipboardList,
  FileBarChart,
  FileX2,
  PackageOpen,
  PackageSearch,
  ShoppingCart,
  Smile,
  Truck,
  Wrench,
} from "lucide-react";
import { type Dictionary, getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import Link from "next/link";

type Dict = Dictionary["reportsIndex"];

/** ກຸ່ມລາຍງານ — ຂໍ້ຄວາມທັງໝົດຄືເກົ່າ ພຽງແຕ່ຈັດເປັນກຸ່ມໃຫ້ຫາງ່າຍຂຶ້ນ */
const groupsOf = (t: Dict) => [
  {
    group: t.groupRepair,
    reports: [
      {
        href: "/reports/pending",
        title: t.pendingTitle,
        description: t.pendingDesc,
        icon: Wrench,
      },
      {
        href: "/reports/receipts",
        title: t.receiptsTitle,
        description: t.receiptsDesc,
        icon: FileBarChart,
      },
      {
        href: "/reports/daily-receipts",
        title: t.dailyReceiptsTitle,
        description: t.dailyReceiptsDesc,
        icon: ClipboardList,
      },
      {
        href: "/reports/cancelled-receipts",
        title: t.cancelledReceiptsTitle,
        description: t.cancelledReceiptsDesc,
        icon: FileX2,
      },
      {
        href: "/reports/checking",
        title: t.checkingTitle,
        description: t.checkingDesc,
        icon: ClipboardCheck,
      },
    ],
  },
  {
    group: t.groupSparesWarehouse,
    reports: [
      {
        href: "/reports/job-dispatch",
        title: t.jobDispatchTitle,
        description: t.jobDispatchDesc,
        icon: PackageSearch,
      },
      {
        href: "/reports/stock",
        title: t.stockTitle,
        description: t.stockDesc,
        icon: Boxes,
      },
      {
        href: "/reports/purchase-requests",
        title: t.purchaseRequestsTitle,
        description: t.purchaseRequestsDesc,
        icon: ShoppingCart,
      },
      {
        href: "/reports/purchase-orders",
        title: t.purchaseOrdersTitle,
        description: t.purchaseOrdersDesc,
        icon: ShoppingCart,
      },
    ],
  },
  {
    group: t.groupInstall,
    reports: [
      {
        href: "/reports/installations",
        title: t.installationsTitle,
        description: t.installationsDesc,
        icon: Truck,
      },
      {
        href: "/reports/install-spares-monthly",
        title: t.installSparesMonthlyTitle,
        description: t.installSparesMonthlyDesc,
        icon: PackageOpen,
      },
      {
        href: "/reports/customer-feedback",
        title: t.customerFeedbackTitle,
        description: t.customerFeedbackDesc,
        icon: Smile,
      },
    ],
  },
];

export default async function ReportsIndex() {
  const t = (await getDictionary(await getLocale())).reportsIndex;
  const groups = groupsOf(t);
  const total = groups.reduce((sum, group) => sum + group.reports.length, 0);

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-700">{t.title}</h1>
        <p className="mt-0.5 text-xs text-slate-500">{t.chooseReport} · {total} {t.reportsUnit}</p>
      </div>

      {groups.map(({ group, reports }) => (
        <section key={group} className="space-y-2">
          <h2 className="text-xs font-semibold text-slate-500">{group}</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {reports.map(({ href, title, description, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-teal-400 hover:bg-teal-50/40"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600">
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-bold text-slate-700">
                    {title}
                    <LinkPending className="size-3" />
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">{description}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
