import { LoginForm } from "@/components/login-form";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getSession } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { homeForRole, roleOf } from "@/lib/roles";
import { apkFileInfo, APK_PUBLIC_PATH, shippedAppVersion } from "@/lib/shipped-app-version";
import { Download, Smartphone, Wrench } from "lucide-react";
import { redirect } from "next/navigation";
export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(homeForRole(roleOf(session)));
  const locale = await getLocale();
  const t = (await getDictionary(locale)).login;
  /*
    ── ລິ້ງໂຫຼດແອັບຊ່າງ ຢູ່ໜ້າ login ──
    ຊ່າງທີ່ຖືກ **ບັງຄັບອັບເດດ** (lib/app-update-gate) ຕ້ອງໄດ້ APK ໃໝ່ ແຕ່ຍັງເຂົ້າ
    ລະບົບບໍ່ໄດ້/ບໍ່ຢາກເຂົ້າ ⇒ ວາງລິ້ງໄວ້ໜ້າ login ເລີຍ. ໄຟລ໌ຢູ່ນອກດ່ານ login ຢູ່ແລ້ວ
    (proxy matcher ຂ້າມ path ທີ່ມີຈຸດ). ບໍ່ມີໄຟລ໌ = ບໍ່ສະແດງຫຍັງ (ຢ່າໃຫ້ກົດແລ້ວ 404).
  */
  const [apk, appVersion] = await Promise.all([apkFileInfo(), shippedAppVersion()]);
  return <main className="grid min-h-screen lg:grid-cols-[1.1fr_.9fr]">
    <section className="relative hidden overflow-hidden bg-brand-900 p-14 text-white lg:flex lg:flex-col lg:justify-between"><div className="absolute -right-28 -top-28 size-96 rounded-full bg-brand-600/20 blur-3xl"/><div className="relative flex items-center gap-3 text-xl font-bold"><span className="grid size-11 place-items-center rounded-xl bg-brand-600"><Wrench/></span>ODIEN SERVICE</div><div className="relative max-w-xl"><p className="mb-4 text-sm font-semibold uppercase tracking-[.28em] text-brand-300">Service management</p><h1 className="text-5xl font-bold leading-tight">ຈັດການວຽກບໍລິການ<br/>ໃຫ້ງ່າຍຂຶ້ນ</h1><p className="mt-6 text-lg leading-8 text-slate-300">ຮັບເຄື່ອງ, ກວດເຊັກ, ສ້ອມແປງ, ຕິດຕັ້ງ ແລະ ຕິດຕາມວຽກໃນລະບົບດຽວ.</p></div><p className="relative text-sm text-slate-500">© 2026 ODIEN Group</p></section>
    <section className="flex items-center justify-center p-6 sm:p-12"><div className="w-full max-w-md"><div className="mb-10 flex items-center justify-between gap-3"><div className="flex items-center gap-3 lg:hidden"><span className="grid size-11 place-items-center rounded-xl bg-brand-700 text-white"><Wrench/></span><b>ODIEN SERVICE</b></div><div className="ml-auto"><LanguageSwitcher locale={locale}/></div></div><p className="text-sm font-semibold text-brand-700">{t.welcome}</p><h2 className="mt-2 text-3xl font-bold text-slate-900">{t.title}</h2><p className="mb-8 mt-3 text-slate-500">{t.subtitle}</p><LoginForm t={t}/>
      {apk && (
        <a
          href={APK_PUBLIC_PATH}
          download
          className="mt-8 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-brand-600 hover:bg-brand-50"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
            <Smartphone className="size-5"/>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-slate-700">{t.appDownload}</span>
            <span className="block text-xs text-slate-500">
              {t.appDownloadSub.replace("{version}", appVersion || "-").replace("{size}", apk.size)}
            </span>
          </span>
          <span className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-brand-700 px-3 text-xs font-semibold text-white">
            <Download className="size-4"/>
            {t.appDownloadCta}
          </span>
        </a>
      )}
    </div></section>
  </main>;
}
