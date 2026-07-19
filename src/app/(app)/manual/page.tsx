import { PageTitle } from "@/components/ui";

/**
 * ຄູ່ມືການໃຊ້ງານ — ຂະບວນການງານສ້ອມ. ໜ້າອ້າງອີງ static ສຳລັບພະນັກງານ (CS/ຊ່າງ/ຫົວໜ້າ/ສາງ).
 * ເນື້ອຫາຄືກັບ artifact ຄູ່ມື ແຕ່ຢູ່ໃນແອັບ (ບໍ່ຕ້ອງອອກໄປ claude.ai).
 */

const SERVICE_TYPES = [
  { code: "CI", tone: "sky", name: "ລູກຄ້ານຳເຄື່ອງເຂົ້າ", desc: "ລູກຄ້າເອົາເຄື່ອງມາທີ່ສູນເອງ. ສ້ອມຢູ່ສູນ ແລ້ວສົ່ງຄືນ.", where: "ເຄື່ອງຢູ່ສູນ" },
  { code: "ST", tone: "violet", name: "ສ້ອມເຄື່ອງໃນສາງ", desc: "ເຄື່ອງຂອງບໍລິສັດ/ສາງ. ສ້ອມຢູ່ສູນ.", where: "ເຄື່ອງຢູ່ສູນ" },
  { code: "IH", tone: "emerald", name: "ໄປສ້ອມບ້ານລູກຄ້າ", desc: "ຊ່າງໄປສ້ອມທີ່ບ້ານ. ເຄື່ອງບໍ່ເຄີຍມາສູນ — ຈົບໜ້າງານ.", where: "ເຄື່ອງຢູ່ບ້ານລູກຄ້າ" },
  { code: "PS", tone: "amber", name: "ໄປຮັບເຄື່ອງມາສ້ອມຢູ່ສູນ", desc: "ໄປຮັບເຄື່ອງບ້ານລູກຄ້າ → ສ້ອມສູນ → ສົ່ງຄືນ.", where: "ບ້ານ → ສູນ → ບ້ານ" },
] as const;

const TONE: Record<string, string> = {
  sky: "border-t-sky-500 [&_.code]:bg-sky-50 [&_.code]:text-sky-700 [&_.where]:text-sky-700",
  violet: "border-t-violet-500 [&_.code]:bg-violet-50 [&_.code]:text-violet-700 [&_.where]:text-violet-700",
  emerald: "border-t-emerald-500 [&_.code]:bg-emerald-50 [&_.code]:text-emerald-700 [&_.where]:text-emerald-700",
  amber: "border-t-amber-500 [&_.code]:bg-amber-50 [&_.code]:text-amber-700 [&_.where]:text-amber-700",
};

const STAGES = [
  "ຮັບງານ / ລໍກວດເຊັກ", "ກຳລັງກວດເຊັກ", "ລໍສະເໜີລາຄາ", "ກຳລັງສະເໜີລາຄາ", "ກວດ Stock / ອາໄຫຼ່",
  "ກຳລັງເບີກອາໄຫຼ່", "ກຳລັງສັ່ງຊື້", "ລໍຖ້າສ້ອມ", "ກຳລັງສ້ອມ", "ລໍກວດ QC", "ລໍສົ່ງຄືນ", "ສົ່ງຄືນສຳເລັດ",
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

const SITUATIONS: Situation[] = [
  {
    n: 1, title: "IH ສ້ອມໜ້າງານບໍ່ໄດ້ → ນຳເຂົ້າສູນ", who: "ຊ່າງ (ແອປ)", whoTone: "tech", accent: "info",
    sit: "ຊ່າງໄປຮອດບ້ານແລ້ວ ສ້ອມໜ້າງານບໍ່ໄດ້ (ຕ້ອງໃຊ້ເຄື່ອງມືສູນ / ກວດເລິກ).",
    steps: ["ຊ່າງກົດ “ສ້ອມໜ້າງານບໍ່ໄດ້ — ນຳເຂົ້າສູນ” ໃນແອປ (ຕອນຂັ້ນ 1–2) ພ້ອມໃສ່ເຫດຜົນ", "ວຽກແປງເປັນ PS ອັດຕະໂນມັດ → ເຂົ້າຄິວ “ກຳລັງໄປຮັບ”", "CS ກົດ “ຮັບເຂົ້າສູນ” ຕອນເຄື່ອງມາຮອດ → ກວດ+ສ້ອມຢູ່ສູນ → ສົ່ງຄືນ"],
    note: "ພໍເປັນ PS ແລ້ວ ຈະໄດ້ຂັ້ນ “ສົ່ງຄືນ” ອັດຕະໂນມັດ (ຕ້ອງເອົາເຄື່ອງໄປສົ່ງລູກຄ້າຄືນ).",
  },
  {
    n: 2, title: "IH ຕ້ອງສັ່ງຊື້ອາໄຫຼ່ (ບໍ່ມີ stock)", who: "CS / ຊ່າງ", whoTone: "cs", accent: "info",
    sit: "ກວດແລ້ວພົບຕ້ອງໃຊ້ອາໄຫຼ່ທີ່ບໍ່ມີໃນສາງ. ຕັດສິນຕອນກວດເຊັກ:",
    steps: ["ຢາກສ້ອມທີ່ສູນ → ກົດ “ນຳເຂົ້າສູນ” ກ່ອນ (ເປັນ PS) → ສັ່ງຊື້ຕາມ flow → ອາໄຫຼ່ມາ → ສ້ອມສູນ", "ຢາກສ້ອມໜ້າງານ → ບໍ່ນຳເຂົ້າ, ສັ່ງຊື້ໄວ້ → ອາໄຫຼ່ມາຮອດ (ຂັ້ນ 8) → ນັດຊ່າງໄປສ້ອມຮອບ 2"],
    note: "ກົນໄກສັ່ງຊື້ (ຂັ້ນ 7) ໃຊ້ຄືເກົ່າ — ຕ່າງກັນແຕ່ຈະ ນຳເຂົ້າສູນ ຫຼື ໄປຮອບ 2.",
  },
  {
    n: 3, title: "ຊ່າງກວດ ≠ ຊ່າງສ້ອມ", who: "CS / ຫົວໜ້າ", whoTone: "cs", accent: "info",
    sit: "ຄົນທີ່ກວດເຊັກ ກັບ ຄົນທີ່ຈະສ້ອມ ເປັນຄົນລະຄົນ.",
    steps: ["ຊ່າງ A ກວດເຊັກຕາມປົກກະຕິ", "CS/ຫົວໜ້າ ເປີດໃບທີ່ໜ້າ /service/<ເລກທີ> → ກົດ “ປ່ຽນຊ່າງ” ເປັນ B", "ຊ່າງ B ຮັບງານ (ໃນແອປ) ແລ້ວສ້ອມຕໍ່"],
    note: "ປ່ຽນຊ່າງຫຼັງຂໍເບີກອາໄຫຼ່ແລ້ວບໍ່ໄດ້ (ໃບເບີກອອກໃນນາມ A). ຄ່າແຮງໄປຄົນທີ່ປິດງານ (B).",
  },
  {
    n: 4, title: "ຂໍເບີກ / ປ່ຽນ ອາໄຫຼ່ ຕອນກຳລັງສ້ອມ", who: "ຊ່າງ · CS", whoTone: "tech", accent: "info",
    sit: "ລົງມືສ້ອມ (ຂັ້ນ 9) ແລ້ວພົບຕ້ອງໃຊ້ອາໄຫຼ່ເພີ່ມ ຫຼື ຜິດຕົວ. ວຽກຄົງຢູ່ “ກຳລັງສ້ອມ”.",
    steps: ["ເວັບ: ໜ້າ /service/<ເລກທີ> ໃນກ່ອງ “ອາໄຫຼ່ຕອນສ້ອມ” — ຄົ້ນ+ເພີ່ມ / ຖອດ", "ແອປ: ປຸ່ມ “ຂໍເບີກ / ປ່ຽນ ອາໄຫຼ່ (ຕອນສ້ອມ)”", "ກົດ “ຂໍເບີກອາໄຫຼ່ເພີ່ມ” → ອອກໃບຂໍເບີກຮອບ 2 → ສາງເບີກໃຫ້"],
    note: "ປ່ຽນອາໄຫຼ່ = ສົ່ງຄືນຕົວເກົ່າ + ເພີ່ມຕົວໃໝ່. ແຖວທີ່ເບີກແລ້ວ (ລັອກ) ຖອດບໍ່ໄດ້.",
  },
  {
    n: 5, title: "ຍົກເລີກງານທີ່ມີອາໄຫຼ່ຄ້າງ", who: "CS", whoTone: "cs", accent: "danger",
    sit: "ຈະປິດງານຍົກເລີກ ແຕ່ອາໄຫຼ່ທີ່ເບີກໄປໃຊ້ (ກວດ/ສ້ອມ) ຍັງບໍ່ຄືນ.",
    steps: ["ລະບົບ ບໍ່ໃຫ້ປິດຟຣີ ຖ້າມີອາໄຫຼ່ຄ້າງ (ຂຶ້ນເຕືອນ)", "ເລືອກ 1 ໃນ 2: ສົ່ງຄືນອາໄຫຼ່ (ໜ້າກູ້ອາໄຫຼ່) ຫຼື ອອກໃບຮັບເງິນເກັບຄ່າອາໄຫຼ່", "ຈາກນັ້ນຈຶ່ງປິດງານ / ສົ່ງເຄື່ອງຄືນລູກຄ້າໄດ້"],
    note: "ກັນຮູເກົ່າ: ໃບຍົກເລີກປິດໄປໂດຍອາໄຫຼ່ບໍ່ເຄີຍຄືນ ⇒ ສະຕ໋ອກໜ້ອຍກວ່າຂອງຈິງ.",
  },
  {
    n: 6, title: "ໂອນອາໄຫຼ່ມາຫ້ອງສ້ອມ (ບໍ່ເບີກ)", who: "ສາງ", whoTone: "stock", accent: "info",
    sit: "ຢາກໃຫ້ອາໄຫຼ່ຢູ່ຫ້ອງສ້ອມ ແຕ່ຍັງເປັນ stock (ບໍ່ຕັດ/ບໍ່ບິນໃສ່ວຽກ).",
    steps: ["ໄປ ເມນູ ສາງ → “ຂໍໂອນອາໄຫຼ່ມາຫ້ອງສ້ອມ”", "ເລືອກສາງຫ້ອງສ້ອມ (1104 ຂົວຫຼວງ / 1206 ດອນຕີ້ວ) + ຄົ້ນ/ເພີ່ມ ອາໄຫຼ່ → ສ້າງໃບຂໍໂອນ", "ສາງໃຫຍ່ອອກໃບໂອນຈິງ (FT) ໃນ ERP → ກົດ “ຮັບ” ທີ່ ຕິດຕາມການໂອນ"],
    note: "ໃບຂໍໂອນບໍ່ຕັດສະຕ໋ອກ — ເປັນຄຳຂໍໃຫ້ສາງໃຫຍ່ໂອນ. ຕ່າງຈາກ “ເບີກ” ທີ່ຕັດ stock ໃສ່ວຽກ.",
  },
  {
    n: 7, title: "ອາໄຫຼ່ທົດລອງ ຕອນກວດເຊັກ", who: "ຊ່າງ", whoTone: "tech", accent: "info",
    sit: "ຢາກລອງໃສ່ອາໄຫຼ່ເພື່ອວິນິດໄສ (ອາດໃຊ້ຈິງ ຫຼື ບໍ່).",
    steps: ["ຕອນກວດ ເພີ່ມອາໄຫຼ່ເຂົ້າລາຍການ ແລ້ວລອງ", "ໃຊ້ຈິງ → ເກັບໄວ້ໃນລາຍການ (ໄປເບີກຕໍ່)", "ບໍ່ໃຊ້ → ຖອດອອກ (ກ່ອນເບີກ) ຫຼື ສົ່ງຄືນສາງ (ຫຼັງເບີກແລ້ວ)"],
    note: "ໃຊ້ກົນໄກເພີ່ມ/ຖອດ/ສົ່ງຄືນ ທີ່ມີຢູ່ແລ້ວ — ບໍ່ຕ້ອງໝາຍພິເສດ.",
  },
  {
    n: 8, title: "ກວດນັບສະຕ໋ອກເຄື່ອງສ້ອມ", who: "ທຸກຝ່າຍ (ຍົກເວັ້ນຊ່າງ)", whoTone: "any", accent: "warn",
    sit: "ນັບເຄື່ອງລູກຄ້າທີ່ຄວນຢູ່ໃນສູນຈິງ (ຂັ້ນ 1–11).",
    steps: ["ເປີດ ເມນູ ສາງ → ກວດນັບ (ເວັບ = ຕາຕະລາງ · ມືຖື = ສະແກນ)", "ສະແກນ barcode / SN ຂອງເຄື່ອງ — ພົບແລ້ວໝາຍອັດຕະໂນມັດ", "ສະຫຼຸບ: ຄົບ / ຂາດ / ເກີນ"],
    note: "IH ຖືກຂ້າມ (ຢູ່ບ້ານລູກຄ້າ) · PS ນັບສະເພາະທີ່ຮັບເຂົ້າສູນແລ້ວ.",
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

const ROLES = [
  { role: "CS / ບໍລິການ", duty: "ຮັບເຂົ້າສູນ (PS) · ນັດ+ຈັດຊ່າງ (IH) · ປ່ຽນຊ່າງ · ຍົກເລີກ · ອອກໃບຮັບເງິນ", where: "/service, /dashboard, ໜ້າຍົກເລີກ" },
  { role: "ຊ່າງ", duty: "ຮັບງານ · ກວດເຊັກ · check-in/out GPS · ສ້ອມ · ນຳເຂົ້າສູນ · ຂໍເບີກ/ປ່ຽນ ອາໄຫຼ່", where: "ແອປຊ່າງ (ມືຖື)" },
  { role: "ຫົວໜ້າຊ່າງ", duty: "ອະນຸມັດລາຄາ/ຍົກເລີກ · ກວດ QC · ຈັດ/ປ່ຽນຊ່າງ", where: "/approvals, /qc, /service" },
  { role: "ສາງ", duty: "ເບີກອາໄຫຼ່ · ໂອນມາຫ້ອງສ້ອມ · ຮັບໂອນ · ຮັບຄືນອາໄຫຼ່ · ຕິດຕາມສິນຄ້າຄົງເຫຼືອ", where: "ເມນູ ສາງ" },
  { role: "ຂົນສົ່ງ", duty: "ໄປຮັບເຄື່ອງບ້ານລູກຄ້າ (PS) · ສົ່ງເຄື່ອງຄືນ", where: "—" },
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

export default function ManualPage() {
  return (
    <div className="mx-auto max-w-4xl pb-16">
      <PageTitle sub="ຄູ່ມືອ້າງອີງ: 4 ປະເພດບໍລິການ · ຂັ້ນຕອນ pipeline · ວິທີຈັດການ 8 ສະຖານະການພິເສດ">
        ຄູ່ມືຂະບວນການງານສ້ອມ
      </PageTitle>

      <Section n="01" title="ປະເພດບໍລິການ 4 ແບບ">
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

      <Section n="02" title="ຂັ້ນຕອນຫຼັກ (pipeline)">
        <p className="mb-4 max-w-[68ch] text-sm text-slate-500">
          ງານສ້ອມທຸກໃບໄຫຼຜ່ານຂັ້ນ 1–12. PS ແລະ IH ມີ <b>ຂັ້ນໜ້າ (0)</b> ພິເສດຂອງຕົນກ່ອນເຂົ້າຂັ້ນ 1.
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
          ຂັ້ນ <b>3–4</b> (ສະເໜີລາຄາ) ເກີດສະເພາະ ໝົດຮັບປະກັນ · ຂັ້ນ <b>5–7</b> (ອາໄຫຼ່) ເກີດສະເພາະ ຕ້ອງໃຊ້ອາໄຫຼ່. ຮັບປະກັນ+ບໍ່ໃຊ້ອາໄຫຼ່ → ຂ້າມໄປຂັ້ນ 8.
        </p>
        <div className="mt-5 space-y-3">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <span className="font-mono text-xs font-bold text-amber-700">PS</span>
            <span className="ml-2 text-[13px] text-slate-700">ລໍໄປຮັບເຄື່ອງ → <b>ອອກໄປຮັບ</b> → ກຳລັງໄປຮັບ → <b>ຮັບເຂົ້າສູນ</b> (CS) → ຂັ້ນ 1… → ສົ່ງຄືນ</span>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <span className="font-mono text-xs font-bold text-emerald-700">IH</span>
            <span className="ml-2 text-[13px] text-slate-700">ລໍນັດໝາຍ/ຈັດຊ່າງ → <b>ນັດ+ຈັດຊ່າງ</b> (CS, ຕ້ອງໃສ່ວັນນັດ) → ຊ່າງໄປ (check-in GPS) → ກວດ+ສ້ອມ → QC → ປິດງານ (ບໍ່ມີ “ສົ່ງຄືນ”)</span>
          </div>
        </div>
      </Section>

      <Section n="03" title="8 ສະຖານະການພິເສດ — ວິທີຈັດການ">
        <div className="space-y-4">
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

      <Section n="04" title="ໃຜເຮັດຫຍັງ">
        <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
          <table className="w-full min-w-[620px] border-collapse bg-white text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-bold">ຝ່າຍ</th>
                <th className="px-4 py-3 font-bold">ໜ້າທີ່ຫຼັກ</th>
                <th className="px-4 py-3 font-bold">ເມນູ/ໜ້າ ທີ່ໃຊ້</th>
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
    </div>
  );
}
