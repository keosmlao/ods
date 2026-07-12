import { NewSpareForm } from "@/components/stock/new-spare-form";
import { Elapsed } from "@/components/elapsed";
import { ListShell, PAGE_SIZE, pageCount, type ListColumn } from "@/components/manage/list-shell";
import { Card, ErrorBox } from "@/components/ui";
import { query } from "@/lib/db";
import { elapsedTone } from "@/lib/elapsed-tone";
import { PP_NOT_CONFIGURED, ppDb, queryPp } from "@/lib/stock-db";
import type { SortDir } from "@/components/sort-header";
import Link from "next/link";

/**
 * ຂໍສ້າງລະຫັດອາໄຫຼ່ — ods: newspare.py /request_create_spare + /save_newspare
 * (templates/newspare/home_create.html)
 *
 * ຕ່າງຈາກ ods:
 *  • ods ດຶງທຸກແຖວອອກມາໜ້າດຽວ → ບ່ອນນີ້ ຄົ້ນຫາ + ຈັດຮຽງ + ແບ່ງໜ້າ ຢູ່ຝັ່ງ server (20 ແຖວ/ໜ້າ)
 *  • ods ຢຸດຢູ່ຄຳວ່າ "ກຳລັງສ້າງ / ic_code" ເສີຍໆ — ບໍ່ມີໃຜຮູ້ວ່າລະຫັດທີ່ SML ອອກໃຫ້ແລ້ວນັ້ນ
 *    **ເຂົ້າ ic_inventory ຂອງ ODS ຫຼືຍັງ** (ຖ້າຍັງ ຊ່າງເບີກ/ສັ່ງຊື້ອາໄຫຼ່ຕົວນັ້ນບໍ່ໄດ້ເລີຍ).
 *    ບ່ອນນີ້ກວດຂ້າມຖານໃຫ້ ແລ້ວຊີ້ທາງໄປປຸ່ມ "ດຶງອາໄຫຼ່ໃໝ່" ຢູ່ໜ້າ /stock/spare-parts.
 */
type Props = { searchParams: Promise<{ q?: string; page?: string; sort?: string; dir?: string }> };

type Draft = {
  roworder: number;
  created_at: string | null;
  name_1: string | null;
  unit_code: string | null;
  user_created: string | null;
  elapsed_seconds: number | null;
  ic_code: string | null;
};

/** ຖັນທີ່ຈັດຮຽງໄດ້ — whitelist ກັນ SQL injection */
const SORT_SQL: Record<string, string> = {
  created: "create_date_time_now",
  name: "name_1",
  unit: "unit_code",
  user: "user_created",
};

const COLUMNS: ListColumn[] = [
  { label: "ລະຫັດອາໄຫຼ່ SML" },
  { key: "name", label: "ຊື່ອາໄຫຼ່" },
  { key: "unit", label: "ຫົວໜ່ວຍ" },
  { key: "created", label: "ວັນທີຂໍສ້າງ", defaultDir: "desc" },
  { label: "ຮອດປັດຈຸບັນ" },
  { key: "user", label: "ຜູ້ຂໍສ້າງ" },
];

export default async function NewSparePage({ searchParams }: Props) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

  // ຖານ pp_od_manage ເປັນຖານທີ 3 — ຖ້າບໍ່ໄດ້ຕັ້ງ PP_DATABASE_URL ໃຫ້ບອກຜູ້ໃຊ້ ບໍ່ແມ່ນລົ້ມ
  if (!ppDb) {
    return (
      <div className="w-full space-y-4">
        <h1 className="text-xl font-bold text-slate-700">ຂໍສ້າງລະຫັດອາໄຫຼ່</h1>
        <ErrorBox>{PP_NOT_CONFIGURED} — ກະລຸນາຕັ້ງຄ່າ PP_DATABASE_URL</ErrorBox>
      </div>
    );
  }

  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const page = Math.max(1, Number(params.page) || 1);
  const sort = SORT_SQL[params.sort ?? ""] ? (params.sort as string) : "created";
  // ລາຍການໃໝ່ສຸດຢູ່ເທິງສຸດເປັນຄ່າຕັ້ງຕົ້ນ (ຄື ods)
  const dir: SortDir = params.dir === "asc" ? "asc" : "desc";

  const where = q ? "where (name_1 ilike $1 or unit_code ilike $1 or user_created ilike $1 or ic_code ilike $1)" : "";
  const args: unknown[] = q ? [`%${q}%`] : [];
  const orderBy = `${SORT_SQL[sort]} ${dir} nulls last, roworder ${dir}`;

  const [rows, total] = await Promise.all([
    queryPp<Draft>(
      `select roworder,
          to_char(create_date_time_now,'dd/mm/yyyy hh24:mi:ss') created_at,
          name_1, unit_code, user_created, ic_code,
          greatest(0, round(extract(epoch from
            (localtimestamp - create_date_time_now::timestamp(0)))))::int elapsed_seconds
        from ods_spare_draft ${where}
        order by ${orderBy} limit ${PAGE_SIZE} offset $${args.length + 1}`,
      [...args, (page - 1) * PAGE_SIZE],
    ),
    queryPp<{ count: string }>(`select count(*) from ods_spare_draft ${where}`, args),
  ]);

  const count = Number(total.rows[0]?.count ?? 0);

  /**
   * ລະຫັດທີ່ SML ອອກໃຫ້ແລ້ວ ຈະໃຊ້ໄດ້ຈິງກໍ່ຕໍ່ເມື່ອມັນເຂົ້າ ic_inventory ຂອງ ODS ແລ້ວເທົ່ານັ້ນ
   * (ໜ້າ /stock/spare-parts ມີປຸ່ມດຶງເຂົ້າ — ods: /loadspa). ກວດໃຫ້ເຫັນຢູ່ນີ້ເລີຍ.
   */
  const issued = rows.rows.map((draft) => draft.ic_code).filter((code): code is string => !!code);
  const inStock = new Set<string>(
    issued.length > 0
      ? (await query<{ code: string }>(`select code from ic_inventory where code = any($1::varchar[])`, [issued])).rows.map(
          (row) => row.code,
        )
      : [],
  );

  const base = () => ({ ...(q && { q }) });
  const sortHref = (key: string, nextDir: SortDir) =>
    `/spare-parts/new?${new URLSearchParams({ ...base(), sort: key, dir: nextDir })}`;
  const pageHref = (n: number) =>
    `/spare-parts/new?${new URLSearchParams({ ...base(), sort, dir, ...(n > 1 && { page: String(n) }) })}`;

  return (
    <div className="w-full space-y-4">
      <Card title="ຂໍສ້າງລະຫັດອາໄຫຼ່">
        <NewSpareForm today={today} />
      </Card>

      <ListShell
        title="ລາຍການຂໍສ້າງລະຫັດອາໄຫຼ່"
        total={count}
        page={page}
        perPage={PAGE_SIZE}
        pages={pageCount(count)}
        q={q}
        searchPlaceholder="ຄົ້ນຫາ ຊື່ອາໄຫຼ່, ຫົວໜ່ວຍ, ຜູ້ຂໍສ້າງ..."
        columns={COLUMNS}
        sort={sort}
        dir={dir}
        sortHref={sortHref}
        pageHref={pageHref}
        minWidth={960}
        actions={false}
      >
        {rows.rows.map((draft, index) => {
          const tone = elapsedTone(draft.elapsed_seconds);
          const ready = draft.ic_code ? inStock.has(draft.ic_code) : false;
          return (
            <tr key={draft.roworder} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="px-3 py-2.5 text-center text-slate-500">{(page - 1) * PAGE_SIZE + index + 1}</td>
              <td className="whitespace-nowrap px-3 py-2.5">
                {/* ic_code = ລະຫັດທີ່ SML ອອກໃຫ້ແລ້ວ; ຍັງບໍ່ມີ = ຍັງລໍຖ້າ */}
                {draft.ic_code ? (
                  <div className="flex flex-col gap-0.5">
                    <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                      {draft.ic_code}
                    </span>
                    {ready ? (
                      <span className="text-[10px] text-slate-400">ພ້ອມໃຊ້ໃນສາງ</span>
                    ) : (
                      // ລະຫັດອອກແລ້ວ ແຕ່ຍັງບໍ່ເຂົ້າ ic_inventory ⇒ ເບີກ/ສັ່ງຊື້ອາໄຫຼ່ຕົວນີ້ຍັງບໍ່ໄດ້
                      <Link
                        href="/stock/spare-parts"
                        className="text-[10px] font-semibold text-amber-700 underline underline-offset-2"
                      >
                        ຍັງບໍ່ເຂົ້າສາງ — ກົດ “ດຶງອາໄຫຼ່ໃໝ່”
                      </Link>
                    )}
                  </div>
                ) : (
                  <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                    ກຳລັງສ້າງ
                  </span>
                )}
              </td>
              <td className="max-w-72 truncate px-3 py-2.5 font-medium text-slate-800" title={draft.name_1 ?? ""}>
                {draft.name_1 ?? "-"}
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{draft.unit_code ?? "-"}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{draft.created_at ?? "-"}</td>
              <td className="whitespace-nowrap px-3 py-2.5">
                <Elapsed
                  seconds={draft.elapsed_seconds}
                  className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${tone.chip}`}
                />
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{draft.user_created ?? "-"}</td>
            </tr>
          );
        })}
      </ListShell>
    </div>
  );
}
