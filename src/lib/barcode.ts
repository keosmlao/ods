/**
 * **Code 128 → SVG** — ບາໂຄດເສັ້ນ ທີ່ເຄື່ອງສະແກນທົ່ວໄປອ່ານໄດ້, ສ້າງຝັ່ງ server ບໍ່ຕ້ອງ dependency.
 *
 * ── ເປັນຫຍັງບໍ່ໃຊ້ library ──
 * ໜ້າພິມຂອງລະບົບໃຊ້ browser print (ບໍ່ມີ canvas lib) — ບາໂຄດເປັນ SVG vector ຈຶ່ງພິມຄົມ
 * ທຸກຂະໜາດ ໂດຍບໍ່ຕ້ອງເພີ່ມ jsbarcode/bwip. ໃຊ້ Code128-B (ຮັບ ASCII 32–126)
 * ⇒ ອ່ານໄດ້ທັງເລກງານສ້ອມ (ເຊັ່ນ 5863) ແລະ ເລກຕິດຕັ້ງ (ເຊັ່ນ INST-7026).
 *
 * ── ໂຄງ Code128 ──
 *   Start-B (104) · ຂໍ້ມູນ · check · Stop(106)
 *   check = (104 + Σ value_i × i) mod 103   (i ເລີ່ມ 1)
 * ແຕ່ລະ symbol = 6 ໂມດູນ (ກວ້າງ 11) ຍົກເວັ້ນ Stop (13). ຄ່າ 1 ໂມດູນ = 1 ໜ່ວຍ SVG.
 */

// ຄວາມກວ້າງ 6 ຊ່ອງ (ແຖບ,ຫວ່າງ,ແຖບ,ຫວ່າງ,ແຖບ,ຫວ່າງ) ຂອງແຕ່ລະຄ່າ 0..106 — ຕາຕະລາງມາດຕະຖານ Code128
const PATTERNS = [
  "212222","222122","222221","121223","121322","131222","122213","122312","132212","221213",
  "221312","231212","112232","122132","122231","113222","123122","123221","223211","221132",
  "221231","213212","223112","312131","311222","321122","321221","312212","322112","322211",
  "212123","212321","232121","111323","131123","131321","112313","132113","132311","211313",
  "231113","231311","112133","112331","132131","113123","113321","133121","313121","211331",
  "231131","213113","213311","213131","311123","311321","331121","312113","312311","332111",
  "314111","221411","431111","111224","111422","121124","121421","141122","141221","112214",
  "112412","122114","122411","142112","142211","241211","221114","413111","241112","134111",
  "111242","121142","121241","114212","124112","124211","411212","421112","421211","212141",
  "214121","412121","111143","111341","131141","114113","114311","411113","411311","113141",
  "114131","311141","411131","211412","211214","211232","2331112", // 106 = Stop (7 ຊ່ອງ)
];

const START_B = 104;
const STOP = 106;

/**
 * ຄືນ SVG ຂອງບາໂຄດ (string). ຄວາມສູງ default 60, ໂມດູນ default 2.
 * ຄ່າຢູ່ນອກ ASCII 32–126 ຖືກຕັດ (Code128-B ບໍ່ຮັບ) — ບໍ່ໂຍນ error ໃຫ້ໜ້າພັງ.
 *
 * `fit: true` → SVG ຍືດເຕັມກ່ອງທີ່ຄຸມມັນ (width/height 100% · preserveAspectRatio none)
 * ⇒ ເລກງານຍາວ/ສັ້ນ ກໍ່ພໍດີປ້າຍ 50mm ສະເໝີ (ຍືດແນວນອນ Code128 ຍັງສະແກນໄດ້).
 */
export function code128Svg(text: string, opts: { height?: number; module?: number; fit?: boolean } = {}): string {
  const height = opts.height ?? 60;
  const unit = opts.module ?? 2;
  const clean = [...text].filter((c) => c.charCodeAt(0) >= 32 && c.charCodeAt(0) <= 126).join("");
  if (!clean) return "";

  const values = [START_B, ...[...clean].map((c) => c.charCodeAt(0) - 32)];
  let sum = START_B;
  [...clean].forEach((c, i) => { sum += (c.charCodeAt(0) - 32) * (i + 1); });
  values.push(sum % 103); // check symbol
  values.push(STOP);

  // ແປງ pattern ເປັນແຖບດຳ: ຕົວເລກຄີກ (index 0,2,4…) = ແຖບ · ຄູ່ = ຫວ່າງ
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  for (const v of values) {
    const pattern = PATTERNS[v];
    for (let i = 0; i < pattern.length; i++) {
      const w = Number(pattern[i]) * unit;
      if (i % 2 === 0) bars.push({ x, w });
      x += w;
    }
  }
  const width = x;
  const rects = bars.map((b) => `<rect x="${b.x}" y="0" width="${b.w}" height="${height}"/>`).join("");
  const size = opts.fit
    ? `width="100%" height="100%" preserveAspectRatio="none"`
    : `width="${width}" height="${height}"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" ${size} shape-rendering="crispEdges"><g fill="#000">${rects}</g></svg>`;
}
