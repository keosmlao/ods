import { DocCard } from "@/components/manual/doc-card";
import { PageTitle } from "@/components/ui";
import { type Dictionary, getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { Printer } from "lucide-react";
import Link from "next/link";

/**
 * ຄູ່ມືການໃຊ້ງານ — ຂະບວນການງານສ້ອມ. ໜ້າອ້າງອີງ static ສຳລັບພະນັກງານ (CS/ຊ່າງ/ຫົວໜ້າ/ສາງ).
 * ເນື້ອຫາຄືກັບ artifact ຄູ່ມື ແຕ່ຢູ່ໃນແອັບ (ບໍ່ຕ້ອງອອກໄປ claude.ai).
 */

type Dict = Dictionary["manualPage"];

const serviceTypes = (t: Dict) => [
  { code: "CI", tone: "sky", name: t.ciName, desc: t.ciDesc, where: t.ciWhere },
  { code: "ST", tone: "violet", name: t.stName, desc: t.stDesc, where: t.stWhere },
  { code: "IH", tone: "emerald", name: t.ihName, desc: t.ihDesc, where: t.ihWhere },
  { code: "PS", tone: "amber", name: t.psName, desc: t.psDesc, where: t.psWhere },
];

const TONE: Record<string, string> = {
  sky: "border-t-sky-500 [&_.code]:bg-sky-50 [&_.code]:text-sky-700 [&_.where]:text-sky-700",
  violet: "border-t-violet-500 [&_.code]:bg-violet-50 [&_.code]:text-violet-700 [&_.where]:text-violet-700",
  emerald: "border-t-emerald-500 [&_.code]:bg-emerald-50 [&_.code]:text-emerald-700 [&_.where]:text-emerald-700",
  amber: "border-t-amber-500 [&_.code]:bg-amber-50 [&_.code]:text-amber-700 [&_.where]:text-amber-700",
};

const stagesList = (t: Dict) => [
  t.stage1, t.stage2, t.stage3, t.stage4, t.stage5, t.stage6,
  t.stage7, t.stage8, t.stage9, t.stage10, t.stage11, t.stage12,
];

type Situation = {
  n: number;
  title: string;
  who: string;
  whoTone: "cs" | "tech" | "stock" | "ht" | "any";
  accent: "info" | "warn" | "danger";
  sit: string;
  steps: string[];
  note: string;
};

const situations = (t: Dict): Situation[] => [
  {
    n: 1, title: t.sit1Title, who: t.sit1Who, whoTone: "tech", accent: "info",
    sit: t.sit1Sit,
    steps: [t.sit1Step1, t.sit1Step2, t.sit1Step3],
    note: t.sit1Note,
  },
  {
    n: 2, title: t.sit2Title, who: t.sit2Who, whoTone: "cs", accent: "info",
    sit: t.sit2Sit,
    steps: [t.sit2Step1, t.sit2Step2],
    note: t.sit2Note,
  },
  {
    n: 3, title: t.sit3Title, who: t.sit3Who, whoTone: "cs", accent: "info",
    sit: t.sit3Sit,
    steps: [t.sit3Step1, t.sit3Step2, t.sit3Step3],
    note: t.sit3Note,
  },
  {
    n: 4, title: t.sit4Title, who: t.sit4Who, whoTone: "tech", accent: "info",
    sit: t.sit4Sit,
    steps: [t.sit4Step1, t.sit4Step2, t.sit4Step3],
    note: t.sit4Note,
  },
  {
    n: 5, title: t.sit5Title, who: t.sit5Who, whoTone: "cs", accent: "danger",
    sit: t.sit5Sit,
    steps: [t.sit5Step1, t.sit5Step2, t.sit5Step3],
    note: t.sit5Note,
  },
  {
    n: 6, title: t.sit6Title, who: t.sit6Who, whoTone: "stock", accent: "info",
    sit: t.sit6Sit,
    steps: [t.sit6Step1, t.sit6Step2, t.sit6Step3],
    note: t.sit6Note,
  },
  {
    n: 7, title: t.sit7Title, who: t.sit7Who, whoTone: "tech", accent: "info",
    sit: t.sit7Sit,
    steps: [t.sit7Step1, t.sit7Step2, t.sit7Step3],
    note: t.sit7Note,
  },
  {
    n: 8, title: t.sit8Title, who: t.sit8Who, whoTone: "any", accent: "warn",
    sit: t.sit8Sit,
    steps: [t.sit8Step1, t.sit8Step2, t.sit8Step3],
    note: t.sit8Note,
  },
];

const ACCENT: Record<string, string> = {
  info: "border-l-teal-500",
  warn: "border-l-amber-500",
  danger: "border-l-red-500",
};
const STEP_BG: Record<string, string> = { info: "bg-teal-600", warn: "bg-amber-600", danger: "bg-red-600" };
const WHO: Record<string, string> = {
  cs: "bg-amber-50 text-amber-700",
  tech: "bg-emerald-50 text-emerald-700",
  stock: "bg-violet-50 text-violet-700",
  ht: "bg-sky-50 text-sky-700",
  any: "bg-slate-100 text-slate-600",
};

const roles = (t: Dict) => [
  { role: t.role1Role, duty: t.role1Duty, where: t.role1Where },
  { role: t.role2Role, duty: t.role2Duty, where: t.role2Where },
  { role: t.role3Role, duty: t.role3Duty, where: t.role3Where },
  { role: t.role4Role, duty: t.role4Duty, where: t.role4Where },
  { role: t.role5Role, duty: t.role5Duty, where: t.role5Where },
];

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <div className="mb-4 flex items-baseline gap-3 border-b border-slate-200 pb-2">
        <span className="font-mono text-sm font-bold text-teal-700">{n}</span>
        <h2 className="text-lg font-extrabold text-slate-800">{title}</h2>
      </div>
      {children}
    </section>
  );
}


export default async function ManualPage() {
  const t = (await getDictionary(await getLocale())).manualPage;
  const SERVICE_TYPES = serviceTypes(t);
  const STAGES = stagesList(t);
  const SITUATIONS = situations(t);
  const ROLES = roles(t);

  return (
    <div className="w-full pb-16">
      <PageTitle sub={t.pageSub}>
        {t.pageTitle}
      </PageTitle>

      <Section n="01" title={t.section1Title}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICE_TYPES.map((s) => (
            <div key={s.code} className={`rounded-xl border border-slate-200 border-t-[3px] bg-white p-4 shadow-sm ${TONE[s.tone]}`}>
              <span className="code inline-block rounded-md px-2 py-0.5 font-mono text-xs font-bold">{s.code}</span>
              <h3 className="mt-3 text-[15px] font-bold text-slate-800">{s.name}</h3>
              <p className="mt-1 text-[13px] text-slate-500">{s.desc}</p>
              <p className="where mt-3 text-xs font-semibold">◆ {s.where}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section n="02" title={t.section2Title}>
        <p className="mb-4 max-w-[68ch] text-sm text-slate-500">
          {t.pipelineIntroA}<b>{t.pipelineIntroBold}</b>{t.pipelineIntroB}
        </p>
        <div className="flex flex-wrap gap-2">
          {STAGES.map((label, i) => (
            <div key={i} className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <span className="font-mono text-[11px] font-bold text-slate-400">{String(i + 1).padStart(2, "0")}</span>
              <span className="ml-2 text-[13px] font-medium text-slate-700">{label}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-[13px] text-slate-500">
          {t.stageNoteA}<b>3–4</b>{t.stageNoteB}<b>5–7</b>{t.stageNoteC}
        </p>
        <div className="mt-5 space-y-3">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <span className="font-mono text-xs font-bold text-amber-700">PS</span>
            <span className="ml-2 text-[13px] text-slate-700">{t.psFlowA}<b>{t.psFlowBold1}</b>{t.psFlowB}<b>{t.psFlowBold2}</b>{t.psFlowC}</span>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <span className="font-mono text-xs font-bold text-emerald-700">IH</span>
            <span className="ml-2 text-[13px] text-slate-700">{t.ihFlowA}<b>{t.ihFlowBold}</b>{t.ihFlowB}</span>
          </div>
        </div>
      </Section>

      <Section n="03" title={t.section3Title}>
        <div className="grid gap-4 xl:grid-cols-2">
          {SITUATIONS.map((c) => (
            <div key={c.n} className={`rounded-xl border border-slate-200 border-l-4 bg-white p-5 shadow-sm ${ACCENT[c.accent]}`}>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="flex-1 text-[17px] font-extrabold text-slate-800">
                  {c.n} · {c.title}
                </h3>
                <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${WHO[c.whoTone]}`}>{c.who}</span>
              </div>
              <p className="mb-3 mt-1 text-sm text-slate-500">{c.sit}</p>
              <ol className="space-y-2">
                {c.steps.map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm text-slate-700">
                    <span className={`mt-0.5 grid size-[22px] shrink-0 place-items-center rounded-md font-mono text-xs font-bold text-white ${STEP_BG[c.accent]}`}>
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-[13px] text-slate-500">{c.note}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section n="04" title={t.section4Title}>
        <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
          <table className="w-full min-w-[620px] border-collapse bg-white text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-bold">{t.colDept}</th>
                <th className="px-4 py-3 font-bold">{t.colDuty}</th>
                <th className="px-4 py-3 font-bold">{t.colMenu}</th>
              </tr>
            </thead>
            <tbody>
              {ROLES.map((r) => (
                <tr key={r.role} className="border-t border-slate-100 align-top">
                  <td className="whitespace-nowrap px-4 py-3 font-bold text-slate-700">{r.role}</td>
                  <td className="px-4 py-3 text-slate-600">{r.duty}</td>
                  <td className="px-4 py-3 text-slate-500">{r.where}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {t.extraSections.map((s, i) => (
        <Section key={i} n={String(5 + i).padStart(2, "0")} title={s.title}>
          {s.intro && <p className="mb-4 max-w-[90ch] text-sm text-slate-500">{s.intro}</p>}
          <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {s.items.map((item, j) => (
              <li
                key={j}
                className="flex gap-2.5 rounded-xl border border-slate-200 bg-white p-3.5 text-[13px] leading-relaxed text-slate-700 shadow-sm"
              >
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-teal-500" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Section>
      ))}

      <Section n={String(5 + t.extraSections.length).padStart(2, "0")} title={t.sopTitle}>
        <div className="mb-4 flex flex-wrap gap-2">
          <Link href="/manual/documents/print?set=sop" target="_blank" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 text-xs font-semibold text-teal-700 hover:bg-teal-100">
            <Printer className="size-4" /> {t.printSet}
          </Link>
          <Link href="/manual/documents/print?set=repair" target="_blank" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50">
            <Printer className="size-4" /> {t.printRepairSet}
          </Link>
          <Link href="/manual/documents/print?set=install" target="_blank" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50">
            <Printer className="size-4" /> {t.printInstallSet}
          </Link>
        </div>
        <div className="space-y-4">
          {t.sopDocs.map((doc) => (
            <DocCard key={doc.code} doc={doc} meta={t.docMeta} printHref={`/manual/documents/print?doc=${doc.code}`} printLabel={t.printOne} />
          ))}
        </div>
      </Section>

      <Section n={String(6 + t.extraSections.length).padStart(2, "0")} title={t.wiTitle}>
        <div className="mb-4 flex flex-wrap gap-2">
          <Link
            href="/manual/documents/print?set=wi"
            target="_blank"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 text-xs font-semibold text-teal-700 hover:bg-teal-100"
          >
            <Printer className="size-4" /> {t.printSet}
          </Link>
        </div>
        <div className="space-y-4">
          {t.wiDocs.map((doc) => (
            <DocCard key={doc.code} doc={doc} meta={t.docMeta} printHref={`/manual/documents/print?doc=${doc.code}`} printLabel={t.printOne} />
          ))}
        </div>
      </Section>
    </div>
  );
}
