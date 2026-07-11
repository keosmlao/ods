import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import Link from "next/link";

export type SortDir = "asc" | "desc";

/**
 * ຫົວຖັນທີ່ກົດຈັດຮຽງໄດ້.
 * ກົດຖັນເກົ່າ → ສະຫຼັບທິດ; ກົດຖັນໃໝ່ → ເລີ່ມທີ່ທິດຕັ້ງຕົ້ນຂອງຖັນນັ້ນ.
 */
export function SortHeader({
  label,
  sortKey,
  current,
  dir,
  href,
  defaultDir = "asc",
  className = "",
}: {
  label: string;
  sortKey: string;
  current: string;
  dir: SortDir;
  /** ສ້າງ URL ໃໝ່ — ຮັກສາຕົວກອງອື່ນໄວ້ */
  href: (sort: string, dir: SortDir) => string;
  defaultDir?: SortDir;
  className?: string;
}) {
  const active = current === sortKey;
  const nextDir: SortDir = active ? (dir === "asc" ? "desc" : "asc") : defaultDir;
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <th className={`whitespace-nowrap px-3 py-3 font-semibold ${className}`}>
      <Link
        href={href(sortKey, nextDir)}
        className={`inline-flex items-center gap-1 transition hover:text-slate-900 ${active ? "text-slate-900" : ""}`}
      >
        {label}
        <Icon className={`size-3.5 ${active ? "text-teal-600" : "text-slate-300"}`} />
      </Link>
    </th>
  );
}
