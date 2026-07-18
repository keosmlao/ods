"use client";
import { ServiceForm, type ServicePrefill } from "@/components/service-form";
import { ServiceScan, type ScanResult } from "@/components/service-scan";
import { ScanLine } from "lucide-react";
import { useState } from "react";

type Option = { code: string; name_1: string };

/**
 * ຮັບເຄື່ອງເຂົ້າສ້ອມ — "ຍິງບາໂຄດກ່ອນ".
 *
 * ຍິງເທື່ອດຽວ ໄດ້ ສິນຄ້າ/ຍີ່ຫໍ້/Model/ບິນ/ວັນທີ → ຄຳນວນການຮັບປະກັນໃຫ້ເລີຍ.
 * ພະນັກງານເຫຼືອປ້ອນແຕ່ສິ່ງທີ່ເຄື່ອງຈັກບອກແທນບໍ່ໄດ້: ອາການ, ອຸປະກອນ, ຮູບ, ຊ່າງ.
 * ບໍ່ມີບາໂຄດ ຫຼືບໍ່ພົບ → ກົດ "ປ້ອນເອງ" ໄປໃຊ້ຟອມເຕັມ.
 */
export function ServiceIntake({
  types,
  brands,
  techs,
  prefill = {},
}: {
  types: Option[];
  brands: Option[];
  techs: { code: string; name_1: string; department?: string }[];
  prefill?: ServicePrefill;
}) {
  // ມີຄ່າຕື່ມມາທາງ URL ແລ້ວ → ຂ້າມຂັ້ນຍິງເລີຍ
  const hasPrefill = Boolean(prefill.proname || prefill.sn);
  const [mode, setMode] = useState<"scan" | "form">(hasPrefill ? "form" : "scan");
  const [scanned, setScanned] = useState<ScanResult | null>(null);
  const [manualSn, setManualSn] = useState("");

  if (mode === "scan") {
    return (
      <ServiceScan
        types={types}
        onResolved={(result) => { setManualSn(""); setScanned(result); setMode("form"); }}
        onManual={(sn) => { setManualSn(sn); setScanned(null); setMode("form"); }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <p className="text-sm text-slate-600">
          {scanned ? (
            <>
              ຕື່ມຂໍ້ມູນຈາກບາໂຄດ <b className="font-mono text-slate-800">{scanned.sn}</b> ແລ້ວ — ແກ້ໄດ້ທຸກຊ່ອງ
            </>
          ) : manualSn ? (
            <>
              ບໍ່ພົບໃນ ERP — ເກັບ SN <b className="font-mono text-slate-800">{manualSn}</b> ໄວ້ໃນຟອມແລ້ວ; ກະລຸນາເລືອກສິນຄ້າ ແລະກວດສິດປະກັນເອງ
            </>
          ) : (
            "ປ້ອນຂໍ້ມູນເອງ"
          )}
        </p>
        <button
          type="button"
          onClick={() => { setManualSn(""); setScanned(null); setMode("scan"); }}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <ScanLine className="size-4" />
          ຍິງບາໂຄດໃໝ່
        </button>
      </div>

      <ServiceForm
        types={types}
        brands={brands}
        techs={techs}
        prefill={{ ...prefill, sn: manualSn || prefill.sn }}
        scanned={scanned}
      />
    </div>
  );
}
