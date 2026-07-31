import { getCart, getRates, seedCart } from "@/app/actions/return";
import { Chatter } from "@/components/chatter/chatter";
import { InvoiceEditor } from "@/components/return/invoice-editor";
import { LinkPending } from "@/components/link-pending";
import { LinkButton } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { getBanks, getHead, getServices, previewDocNo } from "@/lib/return-page-data";
import { CLAIM_SIDE, roleOf } from "@/lib/roles";
import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

/**
 * **ສົ່ງເຄື່ອງເຄມຄືນຮ້ານ** — route ຂອງເຄມເອງ (ບໍ່ໄປ /returns/<code> ຂອງສ້ອມ).
 *
 * ຂໍ້ມູນ/ຟອມ ໃຊ້ຮ່ວມກັບຝັ່ງສ້ອມ (lib/return-page-data + InvoiceEditor) ⇒ ກົດເກນເງິນ
 * ຢູ່ບ່ອນດຽວ. ສິ່ງທີ່ຕ່າງ: ບໍລິບົດເປັນ "ຄືນຮ້ານ" (ບໍ່ແມ່ນຄືນລູກຄ້າ) ແລະ ກັບຄືນຄິວເຄມ.
 *
 * ⚠️ ດ່ານກ່ອນສົ່ງຄືນ (ເຄື່ອງສຳຮອງຄ້າງ · ເຄື່ອງຢູ່ຄົນລະສູນ) ຢູ່ໃນ action ບໍ່ແມ່ນໜ້ານີ້
 * ⇒ ໃຊ້ route ໃດກໍ່ຖືກກວດຄືກັນ (actions/return).
 */
export const dynamic = "force-dynamic";

export default async function ClaimReturnPage({ params }: { params: Promise<{ code: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!CLAIM_SIDE.includes(roleOf(session))) redirect("/forbidden");

  const code = decodeURIComponent((await params).code);
  // ຢືນຢັນວ່າເປັນ **ງານເຄມ** ແທ້ — ບໍ່ດັ່ງນັ້ນງານສ້ອມຈະຖືກສົ່ງຄືນຜ່ານ route ຂອງເຄມ
  const claim = (
    await query<{ scope: string | null; part: string | null; claim_no: string | null }>(
      `select a.claim_scope scope, a.claim_part_name part,
          (select cl.claim_no from ods_claim cl where cl.ref_job = a.code order by cl.id desc limit 1) claim_no
        from tb_product a where a.code = $1 and coalesce(a.job_kind,'repair') = 'claim' limit 1`,
      [code],
    )
  ).rows[0];
  if (!claim) notFound();

  const head = await getHead(code);
  if (!head) notFound();
  await seedCart(head.code, head.warranty, head.used_spare);

  const [cart, rates, banks, services, docNo] = await Promise.all([
    getCart(head.code),
    getRates().catch(() => ({ "01": 1, "02": 0, "03": 0 })),
    getBanks().catch(() => []),
    getServices().catch(() => []),
    previewDocNo().catch(() => ""),
  ]);

  return (
    <div className="w-full space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/claims/jobs/claim-return" className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-600 hover:underline">
          <ArrowLeft className="size-3.5" />
          ກັບຄິວ “ລໍສົ່ງຄືນຮ້ານ”
          <LinkPending className="size-3" />
        </Link>
        <LinkButton href={`/returns/${encodeURIComponent(head.code)}/handover-print`} tone="neutral">
          <Printer className="size-4" />
          ພິມໃບຄືນເຄື່ອງ
        </LinkButton>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-slate-700">🛡️ ສົ່ງເຄື່ອງເຄມຄືນຮ້ານ #{head.code}</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          {claim.scope === "part" ? `ເຄມສະເພາະອາໄຫຼ່: ${claim.part || "-"}` : "ເຄມທັງເຄື່ອງ"}
          {claim.claim_no ? ` · ໃບເຄມ ${claim.claim_no}` : ""}
        </p>
      </div>

      <InvoiceEditor
        head={head}
        cart={cart}
        rates={rates}
        banks={banks}
        services={services}
        docNo={docNo}
        today={new Date().toISOString().slice(0, 10)}
      />
      <Chatter model="tb_product" resId={head.code} />
    </div>
  );
}
