import { PageTitle } from "@/components/ui";
import { shippedAppVersion } from "@/lib/shipped-app-version";
import { SETTING, settingEnabled } from "@/lib/settings";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { Download, TriangleAlert } from "lucide-react";
import Image from "next/image";

/**
 * **ດາວໂຫຼດແອັບຊ່າງ (Android)** — ໃຫ້ຊ່າງຕິດຕັ້ງເອງຈາກເວັບ ບໍ່ຕ້ອງສົ່ງໄຟລ໌ຜ່ານແຊັດ.
 *
 * ໄຟລ໌ຢູ່ `public/downloads/ods.apk` ເຊິ່ງ **ບໍ່ຢູ່ໃນ git** (APK ໃຫຍ່ 100MB+).
 * ຕອນ deploy ໃຫ້ copy ໄຟລ໌ທີ່ build ແລ້ວໄປວາງໄວ້ບ່ອນນັ້ນ (ເບິ່ງ .gitignore ໃນໂຟນເດີ).
 * ບໍ່ມີໄຟລ໌ = ໜ້ານີ້ບອກວິທີເອົາມາວາງ ແທນທີ່ຈະໃຫ້ລິ້ງທີ່ກົດແລ້ວ 404.
 */
export const dynamic = "force-dynamic";

const APK_PATH = "/downloads/ods.apk";

async function apkInfo() {
  try {
    const info = await stat(join(process.cwd(), "public", "downloads", "ods.apk"));
    return {
      size: `${(info.size / 1024 / 1024).toFixed(1)} MB`,
      updated: info.mtime.toISOString().slice(0, 16).replace("T", " "),
    };
  } catch {
    return null;
  }
}

export default async function DownloadAppPage() {
  const [apk, version, forcing] = await Promise.all([
    apkInfo(),
    shippedAppVersion(),
    settingEnabled(SETTING.MOBILE_FORCE_UPDATE),
  ]);

  return (
    <div className="w-full max-w-2xl space-y-5">
      <PageTitle sub="ຕິດຕັ້ງໃສ່ມືຖື Android ຂອງຊ່າງ">ດາວໂຫຼດແອັບຊ່າງ</PageTitle>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-4">
          {/* ໂລໂກ້ຈິງຂອງແອັບ (ອັນດຽວກັບໄອຄອນໃນມືຖື) — ຊ່າງຈຳໄດ້ວ່າກຳລັງໂຫຼດອັນຖືກ */}
          <Image
            src="/ods-logo.png"
            alt="ODIEN Service & Spare Parts"
            width={48}
            height={48}
            priority
            className="size-12 shrink-0 rounded-xl border border-slate-200 object-contain"
          />
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-slate-800">ODIEN Service — ແອັບຊ່າງ</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {apk
                ? `${version ? `ເວີຊັນ ${version} · ` : ""}ຂະໜາດ ${apk.size} · ອັບເດດ ${apk.updated}`
                : "ຍັງບໍ່ມີໄຟລ໌ຢູ່ server"}
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
{`./scripts/publish-apk.sh`}
                </pre>
              </div>
            )}
          </div>
        </div>
      </section>

      {/*
        ບອກໃຫ້ຜູ້ດູແລເຫັນວ່າ "ວາງ APK ແລ້ວ ແຕ່ບໍ່ມີ .version" = ບໍ່ມີໃຜຖືກບັງຄັບອັບເດດ
        — ເປັນຂໍ້ຜິດພາດທີ່ງຽບທີ່ສຸດຂອງລະບົບນີ້ (copy ດ້ວຍມືແລ້ວລືມໄຟລ໌ເວີຊັນ).
      */}
      {apk && (
        <section
          className={`rounded-xl border p-4 text-sm ${
            version && forcing
              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
              : "border-brand-orange-400 bg-brand-orange-100 text-brand-900"
          }`}
        >
          {!version ? (
            <>
              <p className="font-semibold">ຍັງບໍ່ມີໄຟລ໌ເວີຊັນ (ods.apk.version) — ບໍ່ມີໃຜຖືກບັງຄັບອັບເດດ</p>
              <p className="mt-1.5">ວາງ APK ດ້ວຍຄຳສັ່ງນີ້ ຈຶ່ງຈະຂຽນເວີຊັນໃຫ້ພ້ອມ:</p>
              <pre className="mt-2 overflow-x-auto rounded bg-white/70 p-2 text-[11px]">./scripts/publish-apk.sh</pre>
            </>
          ) : forcing ? (
            <p>
              <b>ບັງຄັບອັບເດດເປີດຢູ່</b> — ແອັບທີ່ເກົ່າກວ່າ {version} ໃຊ້ງານບໍ່ໄດ້ຈົນກວ່າຈະອັບເດດ
              (ປິດ/ເປີດໄດ້ທີ່ ຕັ້ງຄ່າລະບົບ)
            </p>
          ) : (
            <p>
              <b>ບັງຄັບອັບເດດປິດຢູ່</b> — ແອັບເກົ່າຍັງໃຊ້ໄດ້ຕໍ່ (ພຽງແຕ່ຖືກແຈ້ງວ່າມີເວີຊັນ {version})
            </p>
          )}
        </section>
      )}

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
