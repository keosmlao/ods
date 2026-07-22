import { DocCard } from "@/components/manual/doc-card";
import { PrintButton } from "@/components/print-button";
import { getCompany } from "@/components/report/print-layout";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";

/**
 * ພິມ SOP/WI ອອກເປັນເອກະສານ (A4). ?doc=<code> = ໃບດຽວ · ?set=sop|wi = ທັງຊຸດ · ບໍ່ໃສ່ = ທັງໝົດ.
 * ໜ້າพิมพ์แยก ⇒ ສະອາດ ບໍ່ມີ chrome. ກົດ “ພິມ / ບັນທຶກ PDF” ແລ້ວ Save as PDF ໄດ້.
 */
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ doc?: string; set?: string }> };

export default async function ManualDocumentsPrintPage({ searchParams }: Props) {
  const { doc, set } = await searchParams;
  const t = (await getDictionary(await getLocale())).manualPage;
  const [company] = await Promise.all([getCompany()]);

  const all = [...t.sopDocs, ...t.wiDocs];
  const isInstall = (code: string) => code.startsWith("SOP-I") || code.startsWith("WI-I");
  const isClaim = (code: string) => code.includes("CLM");
  const isMaint = (code: string) => code.startsWith("SOP-M") || code.startsWith("WI-M");
  const isPurchase = (code: string) => code.startsWith("SOP-P") || code.startsWith("WI-P");
  const isRepair = (code: string) => !isInstall(code) && !isClaim(code) && !isMaint(code) && !isPurchase(code);
  const bySet: Record<string, () => typeof all> = {
    wi: () => t.wiDocs,
    sop: () => t.sopDocs,
    install: () => all.filter((d) => isInstall(d.code)),
    claim: () => all.filter((d) => isClaim(d.code)),
    maintenance: () => all.filter((d) => isMaint(d.code)),
    purchase: () => all.filter((d) => isPurchase(d.code)),
    repair: () => all.filter((d) => isRepair(d.code)),
  };
  const docs = doc ? all.filter((d) => d.code === doc) : (bySet[set ?? ""]?.() ?? all);

  const setHeading: Record<string, string> = {
    wi: t.wiTitle,
    sop: t.sopTitle,
    install: t.printInstallTitle,
    claim: t.printClaimTitle,
    maintenance: t.printMaintTitle,
    purchase: t.printPurchaseTitle,
    repair: t.printRepairTitle,
  };
  const heading = doc
    ? `${docs[0]?.code ?? ""} — ${docs[0]?.title ?? ""}`
    : (setHeading[set ?? ""] ?? t.printAllTitle);

  return (
    <div className="mx-auto max-w-[210mm] bg-white p-8 text-black print:p-0">
      <style>{`@media print { @page { size: A4; margin: 14mm } .no-print { display: none !important } .doc-card { break-after: page; page-break-after: always } .doc-card:last-child { break-after: auto; page-break-after: auto } }`}</style>

      <div className="no-print mb-5 flex items-center justify-between gap-3 rounded-lg bg-slate-100 px-4 py-2">
        <span className="text-xs text-slate-600">{heading}</span>
        <PrintButton label={t.printBtn} />
      </div>

      <header className="mb-5 flex items-center justify-between border-b-2 border-black pb-2">
        <div>
          <p className="text-base font-black">{company.name_1 || "ODIEN SERVICE"}</p>
          {company.name_2 && <p className="text-xs text-slate-600">{company.name_2}</p>}
        </div>
        <h1 className="text-right text-lg font-extrabold text-slate-800">{heading}</h1>
      </header>

      <div className="space-y-5">
        {docs.map((d) => (
          <DocCard key={d.code} doc={d} meta={t.docMeta} />
        ))}
      </div>

      <p className="mt-8 text-[10px] text-slate-400">
        {t.docMeta.references}: {company.name_1 || "ODIEN SERVICE"} · ODSS · {new Date().getFullYear()}
      </p>
    </div>
  );
}
