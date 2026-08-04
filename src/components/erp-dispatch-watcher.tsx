"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * **ຮູ້ທັນທີທີ່ສາງເບີກ** — ໜ້າຄິວໃສ່ຄອມໂພເນັນນີ້ ຈະຍິງ /api/sync/erp-dispatch
 * ທຸກ 15 ວິ (ຕອນ tab ເປີດຢູ່) ເພື່ອດຶງໃບເບີກໃໝ່ຈາກ ERP; ພໍມີໃບເຂົ້າມາ
 * ກໍ່ router.refresh() ໃຫ້ຄິວສະແດງຜົນທັນທີ ບໍ່ຕ້ອງລໍ cron ຫຼື refresh ເອງ.
 *
 * ບໍ່ພົບໃບໃໝ່ ⇒ ບໍ່ refresh (ບໍ່ກະພິບໜ້າຈໍ). session ໝົດ/ERP ລົ້ມ ⇒ ນິ້ງໄວ້ຄືເກົ່າ.
 */
export function ErpDispatchWatcher({ intervalMs = 15_000 }: { intervalMs?: number }) {
  const router = useRouter();
  const busy = useRef(false);

  useEffect(() => {
    const check = async () => {
      if (document.visibilityState !== "visible" || busy.current) return;
      busy.current = true;
      try {
        const response = await fetch("/api/sync/erp-dispatch", { cache: "no-store" });
        if (response.ok) {
          const data = (await response.json()) as { imported: number };
          if (data.imported > 0) router.refresh();
        }
      } catch {
        // ເຄືອຂ່າຍ/ERP ລົ້ມ ⇒ ລອງໃໝ່ຮອບຕໍ່ໄປ (ບໍ່ລົບກວນໜ້າຈໍ)
      } finally {
        busy.current = false;
      }
    };
    const timer = window.setInterval(check, intervalMs);
    check();
    return () => window.clearInterval(timer);
  }, [intervalMs, router]);

  return null;
}
