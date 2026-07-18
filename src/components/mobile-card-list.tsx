"use client";
import { LoaderCircle } from "lucide-react";
import { Children, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * **ບັນຊີ card ຢູ່ມືຖື — ໂຫຼດເພີ່ມຕອນເລື່ອນລົງ** (ໃຊ້ຮ່ວມທຸກໜ້າສ້ອມ).
 *
 * ສະແດງ `initial` (10) card ກ່ອນ · ເລື່ອນຮອດທ້າຍ → ໂຊ loading `loadMs` (2ວິ) → ເພີ່ມ `step` (3).
 * ຮັບ card ທີ່ render ແລ້ວເປັນ children (server component ສ້າງ card ໃຫ້ · ອັນນີ້ພຽງຄຸມ
 * ວ່າສະແດງຈັກອັນ) ⇒ ໜ້າໃດກໍ່ຫໍ່ `{rows.map(...)}` ດ້ວຍອັນນີ້ໄດ້ໂດຍບໍ່ຕ້ອງແກ້ logic card.
 */
export function MobileCardList({
  children,
  initial = 10,
  step = 3,
  loadMs = 2000,
  className = "space-y-2",
}: {
  children: ReactNode;
  initial?: number;
  step?: number;
  loadMs?: number;
  className?: string;
}) {
  const items = Children.toArray(children);
  const total = items.length;
  const [visible, setVisible] = useState(initial);
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || loadingRef.current) return;
        setVisible((v) => {
          if (v >= total) return v;
          loadingRef.current = true;
          setLoading(true);
          window.setTimeout(() => {
            setVisible((c) => Math.min(c + step, total));
            setLoading(false);
            loadingRef.current = false;
          }, loadMs);
          return v;
        });
      },
      { rootMargin: "120px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [total, step, loadMs]);

  return (
    <div>
      <div className={className}>{items.slice(0, visible)}</div>
      {visible < total && (
        <div ref={sentinelRef} className="flex items-center justify-center py-5">
          {loading ? (
            <span className="inline-flex items-center gap-2 text-sm text-slate-400">
              <LoaderCircle className="size-4 animate-spin" />
              ກຳລັງໂຫຼດ...
            </span>
          ) : (
            <span className="text-xs text-slate-300">ເລື່ອນລົງເພື່ອໂຫຼດເພີ່ມ</span>
          )}
        </div>
      )}
    </div>
  );
}
