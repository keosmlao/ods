"use client";
import { useActionState } from "react";
import { loginAction } from "@/app/actions/auth";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { ArrowRight, LoaderCircle, LockKeyhole, User } from "lucide-react";
export function LoginForm({ t }: { t: Dictionary["login"] }) {
  const [state, action, pending] = useActionState(loginAction, {});
  return <form action={action} className="space-y-5">
    {/* ເຂົ້າລະບົບດ້ວຍ **ລະຫັດພະນັກງານ** (odg_employee.employee_code ຂອງ ERP) —
        actions/auth.ts ຮັບຊື່ຫຼິ້ນ/ຊື່ເຕັມໄດ້ນຳ ແຕ່ບອກທາງຫຼັກໄວ້ບ່ອນດຽວ ບໍ່ໃຫ້ຄົນເດົາ */}
    <label className="block"><span className="mb-2 block text-sm font-medium text-slate-600">{t.employeeCode}</span><span className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 focus-within:border-brand-600 focus-within:ring-4 focus-within:ring-brand-100"><User className="size-5 text-slate-400"/><input name="username" required autoComplete="username" className="h-13 w-full text-[15px] outline-none placeholder:text-slate-400" placeholder={t.employeeCodePlaceholder}/></span><span className="mt-1.5 block text-xs text-slate-400">{t.employeeCodeHint}</span></label>
    <label className="block"><span className="mb-2 block text-sm font-medium text-slate-600">{t.password}</span><span className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 focus-within:border-brand-600 focus-within:ring-4 focus-within:ring-brand-100"><LockKeyhole className="size-5 text-slate-400"/><input name="password" type="password" required autoComplete="current-password" className="h-13 w-full text-[15px] outline-none placeholder:text-slate-400" placeholder="••••••••"/></span></label>
    {state.error && <p role="alert" className="rounded-xl bg-brand-orange-50 px-4 py-3 text-sm text-brand-orange-700">{state.error}</p>}
    <button disabled={pending} className="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-brand-700 text-[15px] font-semibold text-white transition hover:bg-brand-800 active:bg-brand-900 disabled:opacity-60">{pending?<LoaderCircle className="size-5 animate-spin"/>:<ArrowRight className="size-5"/>}{pending?t.submitPending:t.submit}</button>
  </form>;
}
