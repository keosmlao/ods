import { TrackingMap } from "@/components/map/tracking-map";
import { getSession } from "@/lib/auth";
import { mapLocations } from "@/lib/map-locations";
import { CLAIM_SIDE, roleOf } from "@/lib/roles";
import { MapPin } from "lucide-react";
import { redirect } from "next/navigation";

/**
 * ແຜนที่ຕິດຕາມงาน on-site — ສ້ອมบ้าน (IH) · ໄปรับ (PS) · ຕິດຕັ້ງ ທີ່ມีพิกัด.
 * ໝุดมาจาก location_lat/lng (ຕັ້ງຕອນເປີດงาน ด้วย location-picker).
 */
export const dynamic = "force-dynamic";

export default async function MapPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!CLAIM_SIDE.includes(roleOf(session))) redirect("/forbidden");

  const markers = await mapLocations();
  const ih = markers.filter((m) => m.service_type === "IH").length;
  const ps = markers.filter((m) => m.service_type === "PS").length;
  const inst = markers.filter((m) => m.kind === "install").length;

  const legend = (color: string, label: string, n: number) => (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200">
      <span className="size-3 rounded-full" style={{ background: color }} /> {label} <b className="tabular-nums">{n}</b>
    </span>
  );

  return (
    <div className="w-full space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-lg font-bold text-slate-700">
          <MapPin className="size-5 text-teal-600" /> ແຜนที่ຕິດຕາມงาน on-site
        </h1>
        <div className="flex flex-wrap gap-2">
          {legend("#0d9488", "ສ້ອມບ້ານ IH", ih)}
          {legend("#7c3aed", "ໄປຮັບ PS", ps)}
          {legend("#d97706", "ຕິດຕັ້ງ", inst)}
        </div>
      </div>
      {markers.length === 0 ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center text-sm text-amber-800">
          ຍັງບໍ່ມີงานที่ໝາຍພິກັດ (location) — ໝາຍພິກັດຕອນເປີດงาน (IH/PS/ຕິດຕັ້ງ) ຈຶ່ງຂຶ້ນແຜนที่.
        </p>
      ) : (
        <TrackingMap markers={markers} />
      )}
    </div>
  );
}
