"use client";

import { LoaderCircle } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import { useDict } from "@/lib/i18n/context";

/**
 * **ໂຫຼດເພີ່ມຕອນເລື່ອນລົງ — ສຳລັບຕາຕະລາງທີ່ຂໍ້ມູນມາຈາກ server** (06-08-2026).
 *
 * ── ຕ່າງຈາກ `mobile-card-list` ──
 * ອັນນັ້ນ render ລູກທັງໝົດແລ້ວຄ່ອຍໆເປີດໃຫ້ເຫັນ (ຂໍ້ມູນມາຄົບແລ້ວ) ⇒ ບໍ່ຊ່ວຍຫຍັງ
 * ຖ້າຄວາມຊ້ານັ້ນຢູ່ທີ່ການດຶງຂໍ້ມູນ. ອັນນີ້ຂຶ້ນຈຳນວນຢູ່ **URL (`?n=`)** ⇒ server
 * ດຶງມາເທົ່າທີ່ຈະສະແດງຈິງ. ເປີດໜ້າມາເທື່ອທຳອິດ = 10 ແຖວ ບໍ່ແມ່ນທັງໝົດ.
 *
 * ໃຊ້ `router.replace` (ບໍ່ແມ່ນ push) + `scroll:false` ⇒ ປຸ່ມ back ບໍ່ຕິດຄ້າງ
 * ຢູ່ທຸກຄັ້ງທີ່ເລື່ອນ ແລະ ໜ້າຈໍບໍ່ກະໂດດຂຶ້ນເທິງ.
 *
 * ບໍ່ຍິງຊ້ຳ: `pending` ຂອງ transition + `askedRef` ຈື່ຈຳນວນທີ່ຂໍໄປແລ້ວ
 * (IntersectionObserver ຍິງຫຼາຍເທື່ອລະຫວ່າງລໍ server).
 */
export function LoadMore({
  shown,
  total,
  step = 10,
}: {
  /** ຈຳນວນແຖວທີ່ກຳລັງສະແດງຢູ່ */
  shown: number;
  /** ຈຳນວນທັງໝົດທີ່ຕົງເງື່ອນໄຂ */
  total: number;
  step?: number;
}) {
  const t = useDict().common;
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const sentinel = useRef<HTMLDivElement>(null);
  const asked = useRef(0);

  const done = shown >= total;

  useEffect(() => {
    const node = sentinel.current;
    if (!node || done) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || pending || asked.current > shown) return;
        asked.current = shown + step;
        const next = new URLSearchParams(params.toString());
        next.set("n", String(shown + step));
        start(() => router.replace(`${pathname}?${next}`, { scroll: false }));
      },
      { rootMargin: "300px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [shown, step, done, pending, params, pathname, router]);

  if (done) return null;

  return (
    <div ref={sentinel} className="flex justify-center py-4">
      <span className="inline-flex items-center gap-2 text-xs text-slate-400">
        {pending && <LoaderCircle className="size-3.5 animate-spin" />}
        {t.loadingMore.replace("{n}", String(total - shown))}
      </span>
    </div>
  );
}
