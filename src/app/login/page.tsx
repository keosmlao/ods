import { LoginForm } from "@/components/login-form";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getSession } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { Wrench } from "lucide-react";
import { redirect } from "next/navigation";
export default async function LoginPage() {
  if (await getSession()) redirect("/dashboard");
  const locale = await getLocale();
  const t = (await getDictionary(locale)).login;
  return <main className="grid min-h-screen lg:grid-cols-[1.1fr_.9fr]">
    <section className="relative hidden overflow-hidden bg-slate-950 p-14 text-white lg:flex lg:flex-col lg:justify-between"><div className="absolute -right-28 -top-28 size-96 rounded-full bg-teal-500/20 blur-3xl"/><div className="relative flex items-center gap-3 text-xl font-bold"><span className="grid size-11 place-items-center rounded-xl bg-teal-500"><Wrench/></span>ODIEN SERVICE</div><div className="relative max-w-xl"><p className="mb-4 text-sm font-semibold uppercase tracking-[.28em] text-teal-300">Service management</p><h1 className="text-5xl font-bold leading-tight">ຈັດການວຽກບໍລິການ<br/>ໃຫ້ງ່າຍຂຶ້ນ</h1><p className="mt-6 text-lg leading-8 text-slate-300">ຮັບເຄື່ອງ, ກວດເຊັກ, ສ້ອມແປງ, ຕິດຕັ້ງ ແລະ ຕິດຕາມວຽກໃນລະບົບດຽວ.</p></div><p className="relative text-sm text-slate-500">© 2026 ODIEN Group</p></section>
    <section className="flex items-center justify-center p-6 sm:p-12"><div className="w-full max-w-md"><div className="mb-10 flex items-center justify-between gap-3"><div className="flex items-center gap-3 lg:hidden"><span className="grid size-11 place-items-center rounded-xl bg-teal-600 text-white"><Wrench/></span><b>ODIEN SERVICE</b></div><div className="ml-auto"><LanguageSwitcher locale={locale}/></div></div><p className="text-sm font-semibold text-teal-600">{t.welcome}</p><h2 className="mt-2 text-3xl font-bold text-slate-900">{t.title}</h2><p className="mb-8 mt-3 text-slate-500">{t.subtitle}</p><LoginForm t={t}/></div></section>
  </main>;
}
