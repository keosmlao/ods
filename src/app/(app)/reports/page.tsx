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
import Link from "next/link";

/** ກຸ່ມລາຍງານ — ຂໍ້ຄວາມທັງໝົດຄືເກົ່າ ພຽງແຕ່ຈັດເປັນກຸ່ມໃຫ້ຫາງ່າຍຂຶ້ນ */
const GROUPS = [
  {
    group: "ສ້ອມແປງ",
    reports: [
      {
        href: "/reports/pending",
        title: "ລາຍງານເຄື່ອງສ້ອມຄ້າງ",
        description: "ເຄື່ອງທີ່ຍັງບໍ່ທັນສົ່ງຄືນລູກຄ້າ ພ້ອມທຸກຂັ້ນຕອນ ແລະ ສະຖານະ",
        icon: Wrench,
      },
      {
        href: "/reports/receipts",
        title: "ລາຍງານການຮັບເຄື່ອງ / ໄລຍະເວລາສ້ອມ",
        description: "ເຄື່ອງທີ່ຮັບເຂົ້າຕາມຊ່ວງວັນທີ ພ້ອມໄລຍະເວລາທີ່ໃຊ້",
        icon: FileBarChart,
      },
      {
        href: "/reports/daily-receipts",
        title: "ລາຍງານການຮັບເຄື່ອງສ້ອມປະຈຳວັນ",
        description: "ລາຍລະອຽດການຮັບເຄື່ອງສ້ອມແປງ ພ້ອມສະຫຼຸບຕາມປະເພດບໍລິການ",
        icon: ClipboardList,
      },
      {
        href: "/reports/cancelled-receipts",
        title: "ລາຍງານການຍົກເລີກບິນສ້ອມ",
        description: "ບິນຮັບເຄື່ອງທີ່ຖືກຍົກເລີກ ແລະ ອະນຸມັດແລ້ວ",
        icon: FileX2,
      },
      {
        href: "/reports/checking",
        title: "ລາຍງານການກວດເຊັກປະຈຳວັນ",
        description: "ໃບຂໍເບີກ / ໃບເບີກອາໄຫຼ່ ພ້ອມອາການຊ່າງ",
        icon: ClipboardCheck,
      },
    ],
  },
  {
    group: "ອາໄຫຼ່ ແລະ ສາງ",
    reports: [
      {
        href: "/reports/job-dispatch",
        title: "ລາຍງານການເບີກອາໄຫຼ່",
        description: "ລາຍການອາໄຫຼ່ທີ່ເບີກອອກ ແຍກຕາມເຄື່ອງສ້ອມ",
        icon: PackageSearch,
      },
      {
        href: "/reports/stock",
        title: "ລາຍງານສິນຄ້າໃນສາງສ້ອມທັງໝົດ",
        description: "ເຄື່ອງທີ່ຍັງຢູ່ໃນສາງ ພ້ອມສະຫຼຸບຕາມສະຖານະ",
        icon: Boxes,
      },
      {
        href: "/reports/purchase-requests",
        title: "ລາຍງານການສະເໜີຊື້ (ERP)",
        description: "ຕິດຕາມ SPR → ອະນຸມັດ → ສັ່ງຊື້ → ຮັບເຂົ້າ",
        icon: ShoppingCart,
      },
      {
        href: "/reports/purchase-orders",
        title: "ລາຍງານການສັ່ງຊື້ອາໄຫຼ່",
        description: "ໃບສະເໜີຊື້ອາໄຫຼ່ຂອງເຄື່ອງສ້ອມ",
        icon: ShoppingCart,
      },
    ],
  },
  {
    group: "ຕິດຕັ້ງ",
    reports: [
      {
        href: "/reports/installations",
        title: "ລາຍງານການຕິດຕັ້ງ",
        description: "ງານຕິດຕັ້ງທັງໝົດ ພ້ອມສະຖານະ ແລະ ໄລຍະເວລາ",
        icon: Truck,
      },
      {
        href: "/reports/install-spares-monthly",
        title: "ສະຫຼຸບອາໄຫຼ່ຕິດຕັ້ງປະຈຳເດືອນ",
        description: "ຈຳນວນເບີກ, ຮັບຄືນ ແລະ ໃຊ້ສຸດທິ ແຍກຕາມອາໄຫຼ່ ແລະ ຊ່າງ",
        icon: PackageOpen,
      },
      {
        href: "/reports/customer-feedback",
        title: "ລາຍງານຄວາມພໍໃຈຂອງລູກຄ້າ",
        description: "ຄະແນນປະເມີນ 5 ຂໍ້ ຂອງງານຕິດຕັ້ງທີ່ປະເມີນແລ້ວ",
        icon: Smile,
      },
    ],
  },
];

export default function ReportsIndex() {
  const total = GROUPS.reduce((sum, group) => sum + group.reports.length, 0);

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-700">ລາຍງານ</h1>
        <p className="mt-0.5 text-xs text-slate-500">ເລືອກລາຍງານທີ່ຕ້ອງການ · {total} ລາຍງານ</p>
      </div>

      {GROUPS.map(({ group, reports }) => (
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
