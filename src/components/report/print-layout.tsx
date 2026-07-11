import { query } from "@/lib/db";
import type { ReactNode } from "react";

type Company = { name_1: string | null; name_2: string | null; address: string | null; tel: string | null };

export async function getCompany() {
  return (
    (await query<Company>("select name_1, name_2, address, tel from company_profile limit 1")).rows[0] ?? {
      name_1: null,
      name_2: null,
      address: null,
      tel: null,
    }
  );
}

/** ຫົວກະດາດພິມ — ຮູບແບບດຽວກັນກັບ templates/pdrcreport/print_pdrcd.html */
export async function PrintLayout({
  title,
  from,
  to,
  children,
}: {
  title: string;
  from: string;
  to: string;
  children: ReactNode;
}) {
  const company = await getCompany();
  return (
    <div className="mx-auto max-w-[1400px] bg-white p-6 text-slate-950">
      <p className="no-print mb-4 rounded-lg bg-slate-100 px-4 py-2 text-center text-sm text-slate-600">
        ກົດ Ctrl/Cmd + P ເພື່ອພິມ
      </p>
      <header className="border-b-2 border-slate-900 pb-4 text-center">
        <h1 className="text-xl font-bold">{company.name_1}</h1>
        <p className="text-sm">{company.name_2}</p>
        <p className="text-xs">{company.address}</p>
        <p className="text-xs">ໂທ: {company.tel}</p>
      </header>
      <div className="mt-4 text-center">
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="text-sm">
          ແຕ່ວັນທີ {from} ຫາ {to}
        </p>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

/** ຕາຕະລາງແບບພິມ (ບໍ່ມີ search/paging) */
export function PrintTable({ head, rows }: { head: string[]; rows: (string | number | null)[][] }) {
  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr className="bg-slate-100">
          {head.map((cell) => (
            <th key={cell} className="border border-slate-400 px-2 py-1 text-center font-bold">
              {cell}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index}>
            {row.map((cell, cellIndex) => (
              <td key={cellIndex} className="border border-slate-300 px-2 py-1 align-top">
                {cell ?? "-"}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
