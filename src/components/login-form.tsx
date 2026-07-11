"use client";
import { useActionState } from "react";
import { loginAction } from "@/app/actions/auth";
import { ArrowRight, LoaderCircle, LockKeyhole, User } from "lucide-react";
export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, {});
  return <form action={action} className="space-y-5">
    <label className="block"><span className="mb-2 block text-sm font-medium text-slate-600">ຊື່ຜູ້ໃຊ້</span><span className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 focus-within:border-teal-500 focus-within:ring-4 focus-within:ring-teal-100"><User className="size-5 text-slate-400"/><input name="username" required autoComplete="username" className="h-12 w-full outline-none" placeholder="ປ້ອນຊື່ຜູ້ໃຊ້"/></span></label>
    <label className="block"><span className="mb-2 block text-sm font-medium text-slate-600">ລະຫັດຜ່ານ</span><span className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 focus-within:border-teal-500 focus-within:ring-4 focus-within:ring-teal-100"><LockKeyhole className="size-5 text-slate-400"/><input name="password" type="password" required autoComplete="current-password" className="h-12 w-full outline-none" placeholder="••••••••"/></span></label>
    {state.error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</p>}
    <button disabled={pending} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-teal-600 font-semibold text-white shadow-lg shadow-teal-600/20 hover:bg-teal-700 disabled:opacity-60">{pending?<LoaderCircle className="size-5 animate-spin"/>:<ArrowRight className="size-5"/>}{pending?"ກຳລັງເຂົ້າ...":"ເຂົ້າສູ່ລະບົບ"}</button>
  </form>;
}
