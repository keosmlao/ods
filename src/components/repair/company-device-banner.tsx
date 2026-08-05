"use client";
import { receiveAsCompanyDevice } from "@/app/actions/company-device";
import { useConfirm } from "@/components/confirm-dialog";
import { LinkPending } from "@/components/link-pending";
import { ArrowLeftRight, LoaderCircle, PackagePlus } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

/**
 * **ແຖບ "ແນະນຳປ່ຽນເຄື່ອງ"** ຢູ່ໜ້າໃບງານ — ພ້ອມປຸ່ມຮັບເຄື່ອງເກົ່າເຂົ້າເປັນເຄື່ອງບໍລິສັດ.
 *
 * ສະແດງ 3 ສະພາບ:
 *   ① ໃບນີ້ແນະນຳປ່ຽນເຄື່ອງ ແລະ **ຍັງບໍ່ໄດ້ຮັບເຂົ້າ** ⇒ ປຸ່ມ "ຮັບເຂົ້າເປັນເຄື່ອງບໍລິສັດ"
 *   ② ຮັບເຂົ້າແລ້ວ ⇒ ລິ້ງໄປໃບເຄື່ອງບໍລິສັດ (ບໍ່ໃຫ້ກົດຮັບຊ້ຳ)
 *   ③ ໃບນີ້**ເປັນ**ໃບເຄື່ອງບໍລິສັດເອງ ⇒ ລິ້ງກັບໄປໃບເດີມຂອງລູກຄ້າ
 *
 * ⚠️ ການປ່ຽນເຄື່ອງເປັນໜ້າທີ່**ຝ່າຍຂາຍ** — ປຸ່ມນີ້ບໍ່ໄດ້ "ປ່ຽນເຄື່ອງ" ໃຫ້ໃຜ ມັນພຽງແຕ່
 * **ຮັບເຄື່ອງເກົ່າເຂົ້າສູນ**ເປັນເຄສສ້ອມຂອງບໍລິສັດ ຫຼັງຝ່າຍຂາຍດຳເນີນການແລ້ວ
 * ⇒ ຈຶ່ງເປັນປຸ່ມໃຫ້ຄົນກົດ ບໍ່ແມ່ນສ້າງໃຫ້ອັດຕະໂນມັດຕອນຊ່າງບັນທຶກຜົນ
 * (ຖ້າຝ່າຍຂາຍຕັດສິນວ່າ**ບໍ່ປ່ຽນ** ເຄື່ອງກັບຄືນລູກຄ້າ ⇒ ບໍ່ຄວນມີໃບຄ້າງໄວ້).
 */
export function CompanyDeviceBanner({
  code,
  checkOutcome,
  companyJob,
  companyFromJob,
}: {
  code: string;
  checkOutcome: string | null;
  companyJob: string | null;
  companyFromJob: string | null;
}) {
  const { ask, dialog } = useConfirm();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  async function receive() {
    const ok = await ask({
      title: "ຮັບເຂົ້າເປັນເຄື່ອງບໍລິສັດ",
      message:
        `ຈະເປີດໃບສ້ອມໃໝ່ໃຫ້ເຄື່ອງເກົ່າຂອງໃບ ${code} ໂດຍໃສ່ລູກຄ້າເປັນ "ເຄື່ອງບໍລິສັດ" ` +
        "ພ້ອມກ໋ອບ ຊື່ເຄື່ອງ · SN · model · brand ໃຫ້ເອງ ແລະ ຜູກສອງໃບເຂົ້າກັນ. " +
        "ກົດເມື່ອຝ່າຍຂາຍປ່ຽນເຄື່ອງໃໝ່ໃຫ້ລູກຄ້າແລ້ວເທົ່ານັ້ນ.",
      confirmLabel: "ຮັບເຂົ້າ",
    });
    if (!ok) return;
    start(async () => {
      const result = await receiveAsCompanyDevice(code);
      setError(result.error ?? "");
    });
  }

  // ③ ໃບນີ້ເປັນເຄື່ອງບໍລິສັດ — ຊີ້ກັບໄປໃບຕົ້ນທາງ
  if (companyFromJob) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-slate-800">
        <ArrowLeftRight className="size-4 shrink-0" />
        <span>
          <b>ເຄື່ອງບໍລິສັດ</b> — ຮັບເຂົ້າມາຈາກໃບສ້ອມຂອງລູກຄ້າ ຫຼັງແນະນຳໃຫ້ປ່ຽນເຄື່ອງໃໝ່
        </span>
        <Link
          href={`/service/${companyFromJob}`}
          className="ml-auto inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          ເບິ່ງໃບເດີມ #{companyFromJob}
          <LinkPending className="size-3" />
        </Link>
      </div>
    );
  }

  if (checkOutcome !== "replace_advice") return null;

  return (
    <div className="rounded-xl border border-brand-orange-400 bg-brand-orange-100 px-4 py-3 text-sm text-brand-900">
      <div className="flex flex-wrap items-center gap-2">
        <PackagePlus className="size-4 shrink-0" />
        <span>
          <b>ແນະນຳໃຫ້ປ່ຽນເຄື່ອງ</b> — ຝ່າຍຂາຍເປັນຜູ້ຕັດສິນ ແລະ ດຳເນີນການປ່ຽນເຄື່ອງໃຫ້ລູກຄ້າ
        </span>

        {/* ② ຮັບເຂົ້າແລ້ວ — ໂຊ້ວລິ້ງ ບໍ່ໃຫ້ກົດຊ້ຳ */}
        {companyJob ? (
          <Link
            href={`/service/${companyJob}`}
            className="ml-auto inline-flex h-8 items-center gap-1 rounded-lg bg-brand-700 px-3 text-xs font-semibold text-white hover:bg-brand-800"
          >
            ໃບເຄື່ອງບໍລິສັດ #{companyJob}
            <LinkPending className="size-3" />
          </Link>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={receive}
            className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-orange-700 px-3 text-xs font-semibold text-white hover:bg-brand-orange-700 disabled:opacity-60"
          >
            {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <PackagePlus className="size-3.5" />}
            ຮັບເຂົ້າເປັນເຄື່ອງບໍລິສັດ
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs font-semibold text-brand-orange-700">{error}</p>}
      {dialog}
    </div>
  );
}
