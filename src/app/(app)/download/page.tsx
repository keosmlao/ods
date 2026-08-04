import { PageTitle } from "@/components/ui";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { Download, Smartphone, TriangleAlert } from "lucide-react";

/**
 * **ດາວໂຫຼດແອັບຊ່າງ (Android)** — ໃຫ້ຊ່າງຕິດຕັ້ງເອງຈາກເວັບ ບໍ່ຕ້ອງສົ່ງໄຟລ໌ຜ່ານແຊັດ.
 *
 * ໄຟລ໌ຢູ່ `public/downloads/odss-tech.apk` ເຊິ່ງ **ບໍ່ຢູ່ໃນ git** (APK ໃຫຍ່ 100MB+).
 * ຕອນ deploy ໃຫ້ copy ໄຟລ໌ທີ່ build ແລ້ວໄປວາງໄວ້ບ່ອນນັ້ນ (ເບິ່ງ .gitignore ໃນໂຟນເດີ).
 * ບໍ່ມີໄຟລ໌ = ໜ້ານີ້ບອກວິທີເອົາມາວາງ ແທນທີ່ຈະໃຫ້ລິ້ງທີ່ກົດແລ້ວ 404.
 */
export const dynamic = "force-dynamic";

const APK_PATH = "/downloads/odss-tech.apk";

async function apkInfo() {
  try {
    const info = await stat(join(process.cwd(), "public", "downloads", "odss-tech.apk"));
    return {
      size: `${(info.size / 1024 / 1024).toFixed(1)} MB`,
      updated: info.mtime.toISOString().slice(0, 16).replace("T", " "),
    };
  } catch {
    return null;
  }
}

export default async function DownloadAppPage() {
  const apk = await apkInfo();

  return (
    <div className="w-full max-w-2xl space-y-5">
      <PageTitle sub="ຕິດຕັ້ງໃສ່ມືຖື Android ຂອງຊ່າງ">ດາວໂຫຼດແອັບຊ່າງ</PageTitle>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand-50">
            <Smartphone className="size-6 text-brand-800" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-slate-800">ODIEN Service — ແອັບຊ່າງ</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {apk ? `ຂະໜາດ ${apk.size} · ອັບເດດ ${apk.updated}` : "ຍັງບໍ່ມີໄຟລ໌ຢູ່ server"}
            </p>

            {apk ? (
              <a
                href={APK_PATH}
                download
                className="mt-4 inline-flex h-11 items-center gap-2 rounded-lg bg-brand-700 px-5 text-sm font-medium text-white transition hover:bg-brand-700"
              >
                <Download className="size-4" />
                ດາວໂຫຼດ APK
              </a>
            ) : (
              <div className="mt-4 rounded-lg border border-brand-orange-400 bg-brand-orange-100 p-3 text-sm text-brand-900">
                <p className="flex items-center gap-2 font-semibold">
                  <TriangleAlert className="size-4" />
                  ຍັງບໍ່ໄດ້ວາງໄຟລ໌ APK
                </p>
                <p className="mt-1.5">ຜູ້ດູແລລະບົບ ໃຫ້ run ຄຳສັ່ງນີ້ແລ້ວ copy ໄຟລ໌ໄປວາງທີ່ server:</p>
                <pre className="mt-2 overflow-x-auto rounded bg-white/70 p-2 text-[11px] leading-relaxed">
{`cd mobile && flutter build apk --release
cp build/app/outputs/flutter-apk/app-release.apk \\
   ../public/downloads/odss-tech.apk`}
                </pre>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-bold text-slate-800">ວິທີຕິດຕັ້ງ</h3>
        <ol className="mt-3 space-y-2.5 text-sm text-slate-600">
          <li className="flex gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">1</span>
            <span>ເປີດໜ້ານີ້ດ້ວຍ <b>ມືຖື Android</b> ແລ້ວກົດ “ດາວໂຫຼດ APK”</span>
          </li>
          <li className="flex gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">2</span>
            <span>
              ມືຖືຈະຖາມວ່າອະນຸຍາດຕິດຕັ້ງຈາກແຫຼ່ງນີ້ບໍ — ເລືອກ <b>ອະນຸຍາດ / Allow</b>
              <span className="block text-xs text-slate-400">(ຕັ້ງຄ່າ → ແອັບ → ສິດພິເສດ → ຕິດຕັ້ງແອັບທີ່ບໍ່ຮູ້ຈັກ)</span>
            </span>
          </li>
          <li className="flex gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">3</span>
            <span>ກົດ <b>ຕິດຕັ້ງ</b> ແລ້ວເປີດແອັບ ເຂົ້າສູ່ລະບົບດ້ວຍຊື່/ລະຫັດອັນດຽວກັບເວັບ</span>
          </li>
          <li className="flex gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">4</span>
            <span>ອະນຸຍາດ <b>ການແຈ້ງເຕືອນ</b> ຕອນແອັບຖາມ — ບໍ່ດັ່ງນັ້ນຈະບໍ່ໄດ້ຮັບແຈ້ງງານໃໝ່</span>
          </li>
        </ol>
      </section>
    </div>
  );
}
