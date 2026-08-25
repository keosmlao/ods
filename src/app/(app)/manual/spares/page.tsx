import { BackLink } from "@/components/back-link";
import Link from "next/link";

/**
 * **ຄູ່ມືຂັ້ນຕອນອາໄຫຼ່** — ໜ້າອ້າງອີງ static ສຳລັບ CS · ຊ່າງ · ສາງ · ຈັດຊື້.
 *
 * ── ເປັນຫຍັງຕ້ອງມີ ──
 * ຂັ້ນອາໄຫຼ່ຄືບ່ອນທີ່ວຽກຄ້າງດົນສຸດ (ຂໍ້ມູນ 04-08-2026: ຊ່ວງ "ກວດຈົບ → ເລີ່ມສ້ອມ" ສະເລ່ຍ 13.7 ມື້)
 * ເພາະມັນມີ **2 ເສັ້ນທາງ · 6 ຊະນິດເອກະສານ ຂ້າມ 2 ລະບົບ (ODS ↔ ERP)** ແລະ ວຽກໜຶ່ງ
 * **ຂໍໄດ້ຫຼາຍຮອບ** (399 ໃບງານຂໍເບີກຫຼາຍກວ່າ 1 ຮອບ). ຄົນສັບສົນທີ່ສຸດຢູ່ຈຸດ
 * "ຂອງເຂົ້າສາງແລ້ວ (PUI) = ຈົບແລ້ວບໍ?" — ຄຳຕອບຄື **ຍັງ** ເຫຼືອອີກ 2 ຂັ້ນ.
 *
 * ເນື້ອຫາຄືກັບ artifact ຄູ່ມື ແຕ່ຢູ່ໃນແອັບ (ຫຼັກການດຽວກັບ /manual).
 */
export const metadata = { title: "ຄູ່ມືຂັ້ນຕອນອາໄຫຼ່" };

const DOCS: { code: string; name: string; by: string; means: string; next: string }[] = [
  { code: "SIO", name: "ໃບຂໍເບີກອາໄຫຼ່", by: "ຊ່າງ / CS", means: "ບອກສາງວ່າ “ວຽກນີ້ຕ້ອງໃຊ້ຂອງເຫຼົ່ານີ້”", next: "ສາງ — ຈ່າຍອອກ (ອອກ SWC)" },
  { code: "SWC", name: "ໃບເບີກ (ສາງຈ່າຍອອກ)", by: "ສາງ", means: "ຂອງອອກຈາກສາງແລ້ວ — ຕັດສະຕັອກ ERP ແລ້ວ", next: "ຊ່າງ — ກົດຮັບ (ອອກ PISP)" },
  { code: "PISP", name: "ໃບຮັບອາໄຫຼ່ຂອງຊ່າງ", by: "ຊ່າງ", means: "ຂອງຢູ່ໃນມືຊ່າງແລ້ວ — ຮອບນັ້ນຈົບ", next: "—" },
  { code: "RQ", name: "ໃບຂໍຊື້ (ຢູ່ ODS)", by: "CS / ຊ່າງ", means: "ຂໍອະນຸມັດຊື້ຂອງທີ່ສາງບໍ່ມີ", next: "ຜູ້ຈັດການ — ອະນຸມັດ" },
  { code: "SPR / PO", name: "ໃບຂໍຊື້ · ໃບສັ່ງຊື້ (ຢູ່ ERP)", by: "ຈັດຊື້", means: "ສັ່ງຜູ້ສະໜອງແລ້ວ", next: "ຈັດຊື້ — ຕິດຕາມຂອງ" },
  { code: "PUI", name: "ໃບຮັບເຂົ້າສາງ (ERP)", by: "ສາງ", means: "ຂອງເຂົ້າສາງແລ້ວ — ຍັງບໍ່ທັນຮອດມືຊ່າງ", next: "ສາງ — ຈ່າຍອອກຕາມ SIO ທີ່ຄ້າງ" },
];

const STATES: { label: string; tone: string; means: string; who: string; slow: string }[] = [
  {
    label: "ລໍສາງເບີກ", tone: "bg-brand-orange-300 text-brand-900",
    means: "ອອກ SIO ແລ້ວ ແຕ່ຍັງບໍ່ມີ SWC", who: "ສາງ",
    slow: "ອາດເປັນວ່າຂອງບໍ່ມີ ⇒ ຕ້ອງອອກ RQ ຂໍຊື້ ບໍ່ແມ່ນປະໄວ້ຊື່ໆ",
  },
  {
    label: "ສາງເບີກແລ້ວ ລໍຊ່າງຮັບ", tone: "bg-brand-50 text-brand-700",
    means: "ມີ SWC ແລ້ວ ແຕ່ຍັງບໍ່ມີ PISP", who: "ຊ່າງ",
    slow: "ຂອງຕັດສະຕັອກໄປແລ້ວແຕ່ບໍ່ມີໃຜຮັບ ⇒ ຂອງລອຍ ບັນຊີບໍ່ຕົງ",
  },
  {
    label: "ຊ່າງຮັບແລ້ວ", tone: "bg-brand-50 text-brand-800",
    means: "ຄົບ SIO → SWC → PISP", who: "—", slow: "ຮອບນີ້ຈົບ",
  },
];

const ROLES: { title: string; color: string; rules: string[] }[] = [
  {
    title: "ຊ່າງ", color: "border-t-brand-600",
    rules: [
      "ພົບຕ້ອງໃຊ້ເພີ່ມ ⇒ ຂໍເບີກຮອບໃໝ່ໄດ້ເລີຍ ບໍ່ຕ້ອງລໍຮອບເກົ່າຈົບ (ເປີດຕັ້ງແຕ່ຂັ້ນ “ກວດ Stock” ຮອດ “ກຳລັງສ້ອມ”)",
      "ສາງແຈ້ງວ່າຈ່າຍແລ້ວ ⇒ ກົດຮັບທັນທີ. ບໍ່ກົດ = ຂອງຕັດສະຕັອກແລ້ວແຕ່ບໍ່ມີເຈົ້າຂອງ",
      "ບໍ່ໄດ້ໃຊ້ຂອງທີ່ຮັບມາ ⇒ ອອກໃບສົ່ງຄືນ ບໍ່ແມ່ນເກັບໄວ້",
    ],
  },
  {
    title: "ສາງ", color: "border-t-brand-600",
    rules: [
      "ເຫັນ SIO ໃໝ່ ⇒ ຈ່າຍອອກ ຫຼື ບອກວ່າບໍ່ມີ — ຢ່າປະໃບຄ້າງງຽບໆ",
      "ບໍ່ມີຂອງ ⇒ ໃຫ້ອອກ RQ ຂໍຊື້ຕໍ່ ໃນວັນນັ້ນ",
      "PUI ຮັບເຂົ້າແລ້ວ ⇒ ໄລ່ເບີກໃຫ້ SIO ທີ່ຄ້າງລໍຂອງນັ້ນ ທັນທີ",
    ],
  },
  {
    title: "ຈັດຊື້ / ຜູ້ຈັດການ", color: "border-t-brand-orange-500",
    rules: [
      "ອະນຸມັດ RQ ⇒ ອອກ SPR ຢູ່ ERP ດ້ວຍລະຫັດສິນຄ້າອັນດຽວກັບທີ່ຂໍ",
      "ປ່ຽນລະຫັດ/ຮຸ່ນ ⇒ ບອກ CS ແລະ ແກ້ໃນໃບຂໍ ບໍ່ດັ່ງນັ້ນລະບົບຈະຕິດຕາມບໍ່ໄດ້",
      "ໃບຂໍທີ່ອະນຸມັດແລ້ວ ຕ້ອງມີ PO ພາຍໃນມື້ນັ້ນ",
    ],
  },
  {
    title: "ຝ່າຍຮັບ / CS", color: "border-t-brand-orange-600",
    rules: [
      "ວຽກໜຶ່ງມີໄດ້ຫຼາຍຮອບ — ເບິ່ງຕາຕະລາງ “ອາໄຫຼ່ຂອງໃບງານ” ວ່າຮອບໃດຄ້າງ ກ່ອນຕອບລູກຄ້າ",
      "ຂອງເຂົ້າສາງແລ້ວ ≠ ວຽກໄປຕໍ່ໄດ້ — ຕ້ອງລໍ SWC + PISP",
      "ຄ້າງເກີນ 7 ມື້ຢູ່ຮອບໃດຮອບໜຶ່ງ ⇒ ຍົກຂຶ້ນຫາຫົວໜ້າ",
    ],
  },
];

export default function SpareManualPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 pb-10">
      <div>
        <BackLink fallback="/manual" label="ກັບຄູ່ມືການໃຊ້ງານ" />
        <h1 className="text-xl font-bold text-slate-700">ຄູ່ມືຂັ້ນຕອນອາໄຫຼ່ — ຂໍເບີກ · ສາງເບີກ · ສັ່ງຊື້</h1>
        <p className="mt-1 max-w-3xl text-xs text-slate-500">
          ຂັ້ນນີ້ສັບສົນເພາະມີ <b>2 ເສັ້ນທາງ</b> ແລະ <b>6 ຊະນິດເອກະສານ</b> ຂ້າມ 2 ລະບົບ (ODS ກັບ ERP)
          ແລະ ວຽກໜຶ່ງ <b>ຂໍໄດ້ຫຼາຍຮອບ</b>. ໜ້ານີ້ບອກວ່າແຕ່ລະໃບໝາຍເຖິງຫຍັງ ໃຜຕ້ອງລົງມືຕອນໃດ ແລະ ເບິ່ງຂໍ້ມູນຢູ່ໃສ.
        </p>
      </div>

      {/* ① ຮູບເສັ້ນທາງ */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 border-b border-slate-100 pb-2 text-sm font-bold text-slate-700">1. ພາບລວມ — ອ່ານ 30 ວິນາທີ</h2>
        <figure className="m-0">
          <div className="overflow-x-auto">
            <svg
              viewBox="0 0 980 440"
              role="img"
              aria-label="ເສັ້ນທາງເອກະສານອາໄຫຼ່: ກະຕ່າ ໄປ SIO ຂໍເບີກ ໄປ SWC ສາງເບີກ ໄປ PISP ຊ່າງຮັບ ແລ້ວພ້ອມສ້ອມ; ຖ້າສາງບໍ່ມີ ແຖວນັ້ນລົງໄປ RQ ຂໍຊື້ ອະນຸມັດ SPR PO ຢູ່ ERP ແລ້ວ PUI ຮັບເຂົ້າສາງ ຈຶ່ງກັບຂຶ້ນມາໃຫ້ສາງເບີກ"
              className="h-auto w-full min-w-[860px] text-slate-700"
            >
              <defs>
                <marker id="sp-ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
                </marker>
                <marker id="sp-ar-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#1e5b9a" />
                </marker>
              </defs>

              <text x="20" y="30" fontSize="11.5" fontWeight="700" fill="currentColor" opacity="0.55">ເສັ້ນທາງປົກກະຕິ — ສາງມີເຄື່ອງ</text>
              <g fontSize="11" textAnchor="middle" fill="currentColor" opacity="0.62">
                <text x="95" y="60">ຊ່າງ / CS</text>
                <text x="287" y="60">ຊ່າງ / CS</text>
                <text x="479" y="60">ສາງ</text>
                <text x="671" y="60">ຊ່າງ</text>
                <text x="863" y="60">ຊ່າງ</text>
              </g>
              <g fill="none" stroke="currentColor" strokeWidth="1.4">
                <rect x="20" y="70" width="150" height="56" rx="9" opacity="0.5" />
                <rect x="212" y="70" width="150" height="56" rx="9" />
                <rect x="404" y="70" width="150" height="56" rx="9" />
                <rect x="596" y="70" width="150" height="56" rx="9" />
                <rect x="788" y="70" width="150" height="56" rx="9" stroke="#1e5b9a" strokeWidth="2" />
              </g>
              <g textAnchor="middle" fontSize="12" fill="currentColor">
                <text x="95" y="94" fontWeight="700">ກະຕ່າອາໄຫຼ່</text>
                <text x="95" y="112" fontSize="11" opacity="0.65">ລາຍການທີ່ຈະໃຊ້</text>
                <text x="287" y="94" fontWeight="700">SIO — ໃບຂໍເບີກ</text>
                <text x="287" y="112" fontSize="11" opacity="0.65">1 ໃບ = 1 ຮອບ</text>
                <text x="479" y="94" fontWeight="700">SWC — ໃບເບີກ</text>
                <text x="479" y="112" fontSize="11" opacity="0.65">ຕັດສະຕັອກ ERP</text>
                <text x="671" y="94" fontWeight="700">PISP — ໃບຮັບ</text>
                <text x="671" y="112" fontSize="11" opacity="0.65">ຊ່າງກົດຮັບ</text>
                <text x="863" y="94" fontWeight="700" fill="#1e5b9a">ພ້ອມລົງມືສ້ອມ</text>
              </g>
              <g stroke="currentColor" strokeWidth="1.5" markerEnd="url(#sp-ar)">
                <line x1="170" y1="98" x2="206" y2="98" />
                <line x1="362" y1="98" x2="398" y2="98" />
                <line x1="554" y1="98" x2="590" y2="98" />
                <line x1="746" y1="98" x2="782" y2="98" />
              </g>
              <g fontSize="10.5" textAnchor="middle" fill="currentColor" opacity="0.7">
                <text x="188" y="90">ຂໍເບີກ</text>
                <text x="380" y="90">ຈ່າຍອອກ</text>
                <text x="572" y="90">ກົດຮັບ</text>
              </g>

              <path d="M 287 126 L 287 250" stroke="#1e5b9a" strokeWidth="1.8" fill="none" markerEnd="url(#sp-ar-a)" />
              <text x="297" y="196" fontSize="11.5" fill="#1e5b9a" fontWeight="700">ສາງບໍ່ມີເຄື່ອງ ⇒ ແຖວນັ້ນຄ້າງ</text>

              <text x="20" y="238" fontSize="11.5" fontWeight="700" fill="currentColor" opacity="0.55">ທາງອ້ອມ — ຕ້ອງສັ່ງຊື້</text>
              <g fontSize="11" textAnchor="middle" fill="currentColor" opacity="0.62">
                <text x="287" y="272">CS / ຊ່າງ</text>
                <text x="479" y="272">ຜູ້ຈັດການ</text>
                <text x="671" y="272">ຈັດຊື້ (ERP)</text>
                <text x="863" y="272">ສາງ (ERP)</text>
              </g>
              <g fill="none" stroke="currentColor" strokeWidth="1.4">
                <rect x="212" y="282" width="150" height="56" rx="9" />
                <rect x="404" y="282" width="150" height="56" rx="9" />
                <rect x="596" y="282" width="150" height="56" rx="9" />
                <rect x="788" y="282" width="150" height="56" rx="9" />
              </g>
              <g textAnchor="middle" fontSize="12" fill="currentColor">
                <text x="287" y="306" fontWeight="700">RQ — ໃບຂໍຊື້</text>
                <text x="287" y="324" fontSize="11" opacity="0.65">ຢູ່ ODS</text>
                <text x="479" y="306" fontWeight="700">ອະນຸມັດ</text>
                <text x="479" y="324" fontSize="11" opacity="0.65">ຜ່ານ / ບໍ່ຜ່ານ</text>
                <text x="671" y="306" fontWeight="700">SPR → PO</text>
                <text x="671" y="324" fontSize="11" opacity="0.65">ສັ່ງຜູ້ສະໜອງ</text>
                <text x="863" y="306" fontWeight="700">PUI — ຮັບເຂົ້າສາງ</text>
                <text x="863" y="324" fontSize="11" opacity="0.65">ຂອງມາຮອດ</text>
              </g>
              <g stroke="currentColor" strokeWidth="1.5" markerEnd="url(#sp-ar)">
                <line x1="362" y1="310" x2="398" y2="310" />
                <line x1="554" y1="310" x2="590" y2="310" />
                <line x1="746" y1="310" x2="782" y2="310" />
              </g>

              <path d="M 863 282 L 863 200 L 479 200 L 479 130" stroke="#1e5b9a" strokeWidth="1.8" fill="none" markerEnd="url(#sp-ar-a)" />
              <text x="671" y="192" fontSize="11.5" fill="#1e5b9a" fontWeight="700" textAnchor="middle">ຂອງເຂົ້າສາງແລ້ວ ⇒ ກັບໄປໃຫ້ສາງເບີກ</text>

              <g fontSize="11" fill="currentColor" opacity="0.7">
                <text x="20" y="390">ວຽກໜຶ່ງມີໄດ້ຫຼາຍ SIO — ແຕ່ລະໃບຄື “ຮອບ 1 · ຮອບ 2 · ຮອບ 3 …” ແລ່ນຂະໜານກັນ ບໍ່ຕ້ອງລໍກັນ</text>
                <text x="20" y="410">ຂໍ້ມູນຈິງ 04-08-2026: 399 ໃບງານຂໍເບີກຫຼາຍກວ່າ 1 ຮອບ (ຮອດ 4 ຮອບ) · 81 ໃບສັ່ງຊື້ຫຼາຍຮອບ</text>
              </g>
            </svg>
          </div>
          <figcaption className="mt-2 text-xs text-slate-500">
            ເສັ້ນສີຄື <b>ທາງອ້ອມຕອນສາງບໍ່ມີເຄື່ອງ</b> — ບ່ອນທີ່ຄົນສັບສົນທີ່ສຸດ ເພາະມັນອອກໄປ ERP ແລ້ວກັບເຂົ້າມາ.
          </figcaption>
        </figure>
        <p className="mt-3 rounded-lg border-l-4 border-brand-600 bg-brand-50 p-3 text-xs text-slate-700">
          <b>ກົດເຫຼັກ 1 ຂໍ້:</b> ວຽກຈະອອກຈາກຂັ້ນອາໄຫຼ່ໄດ້ ກໍ່ຕໍ່ເມື່ອ <b>ທຸກ SIO ໄດ້ SWC ຄົບ</b> ແລະ{" "}
          <b>ທຸກ SWC ໄດ້ PISP ຄົບ</b> — ບໍ່ແມ່ນເມື່ອ “ຂອງມາຮອດສາງ”.
        </p>
      </section>

      {/* ② ເອກະສານ */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 border-b border-slate-100 pb-2 text-sm font-bold text-slate-700">2. ເອກະສານແຕ່ລະໃບໝາຍເຖິງຫຍັງ</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                <th className="px-3 py-2 font-semibold">ໃບ</th>
                <th className="px-3 py-2 font-semibold">ຊື່ເຕັມ</th>
                <th className="px-3 py-2 font-semibold">ໃຜອອກ</th>
                <th className="px-3 py-2 font-semibold">ອອກແລ້ວໝາຍຄວາມວ່າ</th>
                <th className="px-3 py-2 font-semibold">ຖ້າຄ້າງ ໃຜຕ້ອງລົງມື</th>
              </tr>
            </thead>
            <tbody>
              {DOCS.map((doc) => (
                <tr key={doc.code} className="border-b border-slate-100 last:border-0">
                  <td className="whitespace-nowrap px-3 py-2">
                    <span className="rounded bg-brand-50 px-2 py-0.5 font-mono text-[11px] font-bold text-brand-800">{doc.code}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-700">{doc.name}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">{doc.by}</td>
                  <td className="px-3 py-2 text-slate-600">{doc.means}</td>
                  <td className="px-3 py-2 font-medium text-slate-800">{doc.next}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          ຂໍ້ຜິດພາດທີ່ພົບເລື້ອຍທີ່ສຸດ: ເຫັນ <b>PUI</b> ແລ້ວຄິດວ່າ “ຈົບແລ້ວ” — ຄວາມຈິງຍັງເຫຼືອ 2 ຂັ້ນ (SWC ແລ້ວ PISP).
        </p>
      </section>

      {/* ③ ສະຖານະ */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 border-b border-slate-100 pb-2 text-sm font-bold text-slate-700">3. ອ່ານສະຖານະຂອງແຕ່ລະຮອບ</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                <th className="px-3 py-2 font-semibold">ປ້າຍ</th>
                <th className="px-3 py-2 font-semibold">ໝາຍຄວາມວ່າ</th>
                <th className="px-3 py-2 font-semibold">ໃຜຕ້ອງເຮັດ</th>
                <th className="px-3 py-2 font-semibold">ຖ້າຊ້າຜິດປົກກະຕິ</th>
              </tr>
            </thead>
            <tbody>
              {STATES.map((state) => (
                <tr key={state.label} className="border-b border-slate-100 last:border-0">
                  <td className="whitespace-nowrap px-3 py-2">
                    <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${state.tone}`}>{state.label}</span>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{state.means}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-800">{state.who}</td>
                  <td className="px-3 py-2 text-slate-600">{state.slow}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-600">
          ຝັ່ງສັ່ງຊື້ມີ 3 ປ້າຍ:{" "}
          <span className="rounded bg-brand-orange-300 px-2 py-0.5 text-[11px] font-semibold text-brand-900">ລໍອະນຸມັດ</span> (ຜູ້ຈັດການ) ·{" "}
          <span className="rounded bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">ອະນຸມັດແລ້ວ — ຕິດຕາມຢູ່ ERP</span> (ຈັດຊື້) ·{" "}
          <span className="rounded bg-brand-orange-50 px-2 py-0.5 text-[11px] font-semibold text-brand-orange-700">ບໍ່ອະນຸມັດ</span> (CS ຫາທາງອື່ນ)
        </p>
      </section>

      {/* ④ ວິທີເຮັດ */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 border-b border-slate-100 pb-2 text-sm font-bold text-slate-700">4. ເຮັດແນວໃດໃຫ້ຖືກຕ້ອງ</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {ROLES.map((role) => (
            <div key={role.title} className={`rounded-xl border border-slate-200 border-t-4 bg-white p-3 ${role.color}`}>
              <h3 className="mb-2 text-sm font-bold text-slate-700">{role.title}</h3>
              <ul className="list-disc space-y-1.5 pl-4 text-xs text-slate-600">
                {role.rules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ⑤ ເບິ່ງຢູ່ໃສ */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 border-b border-slate-100 pb-2 text-sm font-bold text-slate-700">5. ເບິ່ງຂໍ້ມູນຢູ່ໃສ</h2>
        <ol className="list-decimal space-y-2 pl-5 text-xs text-slate-600 marker:font-bold marker:text-brand-700">
          <li>
            <b>ໜ້າວຽກສ້ອມຂອງໃບນັ້ນ</b> <span className="font-mono">/repair/&lt;ເລກງານ&gt;</span> — ຕາຕະລາງ{" "}
            <b>“ອາໄຫຼ່ຂອງໃບງານ”</b> ແຍກເປັນຮອບ (ໃບຂໍເບີກ · ວັນທີ · ສາງ · SWC · PISP · ສະຖານະ · ລໍໃຜ)
            ພ້ອມປຸ່ມ <b>+ ຂໍເບີກຮອບໃໝ່</b> ແລະ <b>+ ຂໍຊື້ຮອບໃໝ່</b>
          </li>
          <li>
            <Link href="/work/spares" className="font-semibold text-brand-800 hover:underline">ອາໄຫຼ່ (ທັງສາຍ)</Link> — ວຽກອາໄຫຼ່ຄ້າງທັງໝົດ ຈັດກຸ່ມຕາມ “ໃຜຕ້ອງເຮັດຕໍ່”
          </li>
          <li>
            <Link href="/work/repair/purchasing" className="font-semibold text-brand-800 hover:underline">ຄິວກຳລັງສັ່ງຊື້</Link> — ກ່ອງຂຽວ “ວຽກຄວນໄປຕໍ່ໄດ້ແລ້ວ” = ERP ຢືນຢັນວ່າຂອງເຂົ້າສາງຄົບແລ້ວ ແຕ່ວຽກຍັງບໍ່ຂະຫຍັບ
          </li>
          <li>ກົດເລກໃບໃນຕາຕະລາງ ⇒ ເປີດເບິ່ງລາຍການຂອງໃບນັ້ນໄດ້ເລີຍ</li>
        </ol>
      </section>
    </div>
  );
}
