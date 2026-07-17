import { CustomerTable, type CustomerRow } from "@/app/(app)/customers/customer-table";
import type { SortDir } from "@/components/sort-header";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { permissionFor } from "@/lib/permissions";
import { redirect } from "next/navigation";

/**
 * ກຳນົດລູກຄ້າ — ແທນ /customer ຂອງ ods (customer.py)
 *
 * ຕ່າງຈາກ ods:
 *  - ods ດຶງລູກຄ້າທັງໝົດ (~10,000 ແຖວ) ອອກມາໜ້າດຽວ ແລ້ວໃຫ້ DataTables ແບ່ງໜ້າຢູ່ browser
 *    → ບ່ອນນີ້ແບ່ງໜ້າຢູ່ຝັ່ງ server (20 ແຖວ/ໜ້າ) ພ້ອມຄົ້ນຫາ ແລະ ຈັດຮຽງ
 *  - ods ໃຊ້ address||', ເມືອງ '||... ເຊິ່ງກາຍເປັນ NULL ຖ້າຂາດຂໍ້ມູນໃດໜຶ່ງ → ໃຊ້ concat_ws ແທນ
 *  - ods order by code::int ເສີຍໆ ເຊິ່ງພັງຖ້າມີລະຫັດທີ່ບໍ່ແມ່ນຕົວເລກ → ກັນໄວ້
 */
type Props = { searchParams: Promise<{ q?: string; page?: string; sort?: string; dir?: string }> };

const PAGE_SIZE = 20;

const FROM = `from ar_customer a
  left join province b on b.code = a.provine
  left join city c on c.province = a.provine and c.code = a.city`;

const SEARCH = `(a.code ilike $1 or a.name_1 ilike $1 or a.name_2 ilike $1
  or a.tel ilike $1 or a.address ilike $1)`;

/** ຖັນທີ່ຈັດຮຽງໄດ້ — whitelist ກັນ SQL injection */
const SORT_SQL: Record<string, string> = {
  // ລະຫັດເປັນ text ແຕ່ຄ່າສ່ວນໃຫຍ່ເປັນຕົວເລກ → ຮຽງແບບຕົວເລກກ່ອນ
  code: "case when a.code ~ '^[0-9]+$' then a.code::bigint end",
  name: "a.name_1",
  tel: "a.tel",
  address: "a.address",
};

export default async function CustomersPage({ searchParams }: Props) {
  // ສິດແກ້ຂໍ້ມູນລູກຄ້າ — ຄຸມຊ່ອງ "ປະເພດ" (ຮ້ານຄ້າ/ທົ່ວໄປ) ຢູ່ຕາຕະລາງ
  const session = await getSession();
  if (!session) redirect("/login");
  const permission = await permissionFor(session, "/customers");

  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const page = Math.max(1, Number(params.page) || 1);
  const dir: SortDir = params.dir === "desc" ? "desc" : "asc";
  const sort = (params.sort ?? "code").trim();

  const where = q ? `where ${SEARCH}` : "";
  const args: (string | number)[] = q ? [`%${q}%`] : [];
  const orderBy = `${SORT_SQL[sort] ?? SORT_SQL.code} ${dir} nulls last, a.code ${dir}`;

  const [list, total] = await Promise.all([
    query<Omit<CustomerRow, "jobs">>(
      `select a.code, a.name_1, a.name_2, a.cust_kind,
         concat_ws(', ', nullif(a.address,''), nullif('ເມືອງ ' || c.name_1, 'ເມືອງ '), nullif('ເເຂວງ ' || b.name_1, 'ເເຂວງ ')) address,
         a.tel
       ${FROM} ${where}
       order by ${orderBy}
       limit $${args.length + 1} offset $${args.length + 2}`,
      [...args, PAGE_SIZE, (page - 1) * PAGE_SIZE],
    ),
    query<{ count: string }>(`select count(*) ${FROM} ${where}`, args),
  ]);

  // ນັບໃບຮັບເຄື່ອງ ສະເພາະລູກຄ້າ 20 ຄົນຂອງໜ້ານີ້ — ບໍ່ນັບທັງຖານຂໍ້ມູນ
  const codes = list.rows.map((row) => row.code);
  const jobs = codes.length
    ? (
        await query<{ cust_code: string; count: number }>(
          "select cust_code, count(*)::int count from tb_product where cust_code = any($1) group by cust_code",
          [codes],
        )
      ).rows
    : [];
  const jobCount = new Map(jobs.map((row) => [row.cust_code, row.count]));

  const count = Number(total.rows[0]?.count ?? 0);

  return (
    <CustomerTable
      rows={list.rows.map((row) => ({ ...row, jobs: jobCount.get(row.code) ?? 0 }))}
      q={q}
      page={page}
      pageSize={PAGE_SIZE}
      total={count}
      pages={Math.max(1, Math.ceil(count / PAGE_SIZE))}
      sort={sort}
      dir={dir}
      canUpdate={permission.update}
    />
  );
}
