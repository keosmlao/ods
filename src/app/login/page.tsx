import { LoginForm } from "@/components/login-form";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getSession } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { homeForRole, roleOf } from "@/lib/roles";
import { apkFileInfo, APK_PUBLIC_PATH, shippedAppVersion } from "@/lib/shipped-app-version";
import { Download, Smartphone, Wrench } from "lucide-react";
import { redirect } from "next/navigation";

/**
 * **ໜ້າເຂົ້າສູ່ລະບົບ** — ຄົນສ່ວນຫຼາຍທີ່ມາຮອດໜ້ານີ້ຖືມືຖືຢູ່ (ຊ່າງ · ພະນັກງານໜ້າຮ້ານ)
 * ⇒ ອອກແບບຈາກຈໍນ້ອຍກ່ອນ ແລ້ວຄ່ອຍຂະຫຍາຍເປັນ 2 ຖັນຢູ່ຈໍໃຫຍ່.
 *
 * ── ສິ່ງທີ່ແກ້ຮອບນີ້ ──
 * ① ແຕ່ກ່ອນຢູ່ມືຖື ເນື້ອຫາຖືກຈັດ**ກາງແນວຕັ້ງ** ⇒ ຈໍຍາວໆມີບ່ອນຫວ່າງເປົ່າເຄິ່ງໜ້າ
 *    ກ່ອນຮອດຟອມ. ດຽວນີ້ເກາະເທິງ ພ້ອມແຖບແບຣນ ⇒ ນິ້ວໂປ້ຮອດຊ່ອງປ້ອນໄວຂຶ້ນ.
 * ② ພາເນວແບຣນເກົ່າ `hidden lg:flex` ⇒ ມືຖືບໍ່ເຫັນແບຣນເລີຍ ໜ້າຂາວລ້ວນ.
 *    ດຽວນີ້ມືຖືມີແຖບ navy ສັ້ນໆ (ບໍ່ກິນຈໍ) ຈໍໃຫຍ່ຍັງໄດ້ພາເນວເຕັມຄືເກົ່າ.
 * ③ ກາດໂຫຼດແອັບຢູ່ນອກດ່ານ login ຢູ່ແລ້ວ — ບໍ່ມີໄຟລ໌ = ບໍ່ສະແດງ (ຢ່າໃຫ້ກົດແລ້ວ 404).
 */
export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(homeForRole(roleOf(session)));
  const locale = await getLocale();
  const t = (await getDictionary(locale)).login;
  const [apk, appVersion] = await Promise.all([apkFileInfo(), shippedAppVersion()]);

  return (
    <main className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[1.05fr_.95fr]">
      {/* ── ພາເນວແບຣນ (ຈໍໃຫຍ່ເທົ່ານັ້ນ) ── */}
      <section className="relative hidden overflow-hidden bg-brand-900 p-14 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -top-28 -right-28 size-96 rounded-full bg-brand-600/25 blur-3xl" />
        <div className="relative flex items-center gap-3 text-xl font-bold">
          <span className="grid size-11 place-items-center rounded-xl bg-brand-600">
            <Wrench className="size-6" />
          </span>
          ODIEN SERVICE
        </div>
        <div className="relative max-w-xl">
          <p className="mb-4 text-sm font-semibold tracking-[.28em] text-brand-300 uppercase">
            Service management
          </p>
          <h1 className="text-5xl leading-tight font-bold">
            ຈັດການວຽກບໍລິການ
            <br />
            ໃຫ້ງ່າຍຂຶ້ນ
          </h1>
          <p className="mt-6 text-lg leading-8 text-slate-300">
            ຮັບເຄື່ອງ, ກວດເຊັກ, ສ້ອມແປງ, ຕິດຕັ້ງ ແລະ ຕິດຕາມວຽກໃນລະບົບດຽວ.
          </p>
        </div>
        <p className="relative text-sm text-slate-400">© 2026 ODIEN Group</p>
      </section>

      {/* ── ຝັ່ງຟອມ ── */}
      <section className="flex flex-col lg:justify-center">
        {/* ແຖບແບຣນສຳລັບມືຖື — ຈໍໃຫຍ່ໃຊ້ພາເນວຊ້າຍແທນ ຈຶ່ງເຊື່ອງ */}
        <header className="rounded-b-3xl bg-brand-900 px-5 pt-6 pb-10 lg:hidden">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-600 text-white">
              <Wrench className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base leading-tight font-bold text-white">ODIEN SERVICE</span>
              <span className="block text-[11px] tracking-[.2em] text-brand-300 uppercase">
                Service management
              </span>
            </span>
            <LanguageSwitcher locale={locale} />
          </div>
        </header>

        <div className="mx-auto -mt-6 w-full max-w-md px-5 pb-10 lg:mt-0 lg:max-w-lg lg:px-12 lg:py-10">
          {/* ຕົວສະຫຼັບພາສາຂອງຈໍໃຫຍ່ (ມືຖືຢູ່ໃນແຖບແບຣນແລ້ວ) */}
          <div className="mb-8 hidden justify-end lg:flex">
            <LanguageSwitcher locale={locale} />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:border-0 lg:p-0 lg:shadow-none">
            <p className="text-sm font-semibold text-brand-700">{t.welcome}</p>
            <h2 className="mt-1 text-3xl font-bold text-slate-900">{t.title}</h2>
            <p className="mt-2 mb-7 text-sm leading-relaxed text-slate-500">{t.subtitle}</p>
            <LoginForm t={t} />
          </div>

          {/* ── ໂຫຼດແອັບຊ່າງ ── */}
          {apk && (
            <a
              href={APK_PUBLIC_PATH}
              download
              className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-brand-600 hover:bg-brand-50"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
                <Smartphone className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-700">{t.appDownload}</span>
                <span className="block text-xs text-slate-500">
                  {t.appDownloadSub.replace("{version}", appVersion || "-").replace("{size}", apk.size)}
                </span>
              </span>
              <span className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-brand-700 px-3 text-xs font-semibold text-white">
                <Download className="size-4" />
                {t.appDownloadCta}
              </span>
            </a>
          )}

          <p className="mt-6 text-center text-xs text-slate-400 lg:hidden">© 2026 ODIEN Group</p>
        </div>
      </section>
    </main>
  );
}
