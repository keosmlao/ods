"use client";
import "leaflet/dist/leaflet.css";
import { Crosshair, MapPin, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * ເລືອກ **ພິກັດສະຖານທີ່ຕິດຕັ້ງ** ເທິງແຜນທີ່.
 *
 * ── ເປັນຫຍັງຕ້ອງມີ ──
 * location_inst ເປັນຂໍ້ຄວາມລ້ວນ ("ບ້ານ ໂພນທັນ, ເມືອງ ໄຊເສດຖາ") ⇒ ຊ່າງຕ້ອງໂທຖາມທາງ
 * ທຸກເທື່ອ ແລະ ຄິວປະຈຳວັນຈັດເສັ້ນທາງບໍ່ໄດ້. ມີພິກັດ ⇒ ແອັບຊ່າງກົດນຳທາງໄດ້ເລີຍ
 * ແລະ ທຽບກັບພິກັດ check-in ໄດ້ວ່າໄປຮອດຈຸດທີ່ນັດຫຼືບໍ່.
 *
 * ── ເປັນຫຍັງ Leaflet + OpenStreetMap ──
 * ບໍ່ຕ້ອງມີ API key ແລະ ບໍ່ມີຄ່າໃຊ້ຈ່າຍ (Google Maps ຕ້ອງມີ key + ບັດເຄຣດິດ).
 * ໂຫຼດແຜນທີ່ **ຕໍ່ເມື່ອຄົນກົດເປີດ** — ບໍ່ໃຫ້ໜ້າຮັບເຄື່ອງໜັກຂຶ້ນໂດຍບໍ່ຈຳເປັນ.
 *
 * ພິກັດ **ບໍ່ບັງຄັບ** — ບໍ່ຮູ້ຈຸດກໍ່ເປີດງານໄດ້ຄືເກົ່າ (ຂໍ້ຄວາມທີ່ຢູ່ຍັງເປັນຫຼັກ).
 */

/** ນະຄອນຫຼວງວຽງຈັນ — ຈຸດເລີ່ມຕົ້ນຂອງແຜນທີ່ເມື່ອຍັງບໍ່ມີພິກັດ */
const VIENTIANE: [number, number] = [17.9757, 102.6331];

export type Point = { lat: number; lng: number };

export function LocationPicker({
  value,
  onChange,
}: {
  value: Point | null;
  onChange: (point: Point | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <MapPin className="size-3.5 text-teal-600" />
          {value ? "ປ່ຽນຈຸດເທິງແຜນທີ່" : "ປັກໝຸດເທິງແຜນທີ່"}
        </button>

        <button
          type="button"
          disabled={locating}
          onClick={() => {
            // ຄົນຮັບເຄື່ອງນັ່ງຢູ່ຮ້ານ ⇒ ຕຳແໜ່ງປັດຈຸບັນມັກບໍ່ແມ່ນບ້ານລູກຄ້າ
            // ແຕ່ມີປະໂຫຍດເມື່ອເປີດງານຢູ່ໜ້າງານ (ຫຼື ໃຊ້ເປັນຈຸດເລີ່ມແລ້ວລາກໝຸດ)
            setLocating(true);
            navigator.geolocation.getCurrentPosition(
              (position) => {
                onChange({ lat: position.coords.latitude, lng: position.coords.longitude });
                setLocating(false);
              },
              () => setLocating(false),
              { enableHighAccuracy: true, timeout: 8000 },
            );
          }}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <Crosshair className="size-3.5" />
          {locating ? "ກຳລັງຫາ..." : "ໃຊ້ຕຳແໜ່ງປັດຈຸບັນ"}
        </button>

        {value && (
          <>
            <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
              {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
            </span>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-xs font-semibold text-slate-400 hover:text-red-600"
            >
              ລຶບຈຸດ
            </button>
          </>
        )}
      </div>

      {open && <MapDialog value={value} onClose={() => setOpen(false)} onPick={onChange} />}
    </div>
  );
}

function MapDialog({
  value,
  onClose,
  onPick,
}: {
  value: Point | null;
  onClose: () => void;
  onPick: (point: Point) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [picked, setPicked] = useState<Point | null>(value);

  useEffect(() => {
    let map: import("leaflet").Map | undefined;
    let marker: import("leaflet").Marker | undefined;

    // ໂຫຼດ leaflet ຕອນເປີດເທົ່ານັ້ນ (import ແບບ dynamic ⇒ ບໍ່ຕິດໄປໃນ bundle ຂອງໜ້າ)
    import("leaflet").then((L) => {
      if (!container.current) return;

      const start: [number, number] = value ? [value.lat, value.lng] : VIENTIANE;
      map = L.map(container.current).setView(start, value ? 17 : 13);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      const icon = L.divIcon({
        className: "",
        html: '<div style="width:18px;height:18px;border-radius:9999px;background:#0d9488;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      if (value) marker = L.marker(start, { icon }).addTo(map);

      map.on("click", (event: import("leaflet").LeafletMouseEvent) => {
        const point = { lat: event.latlng.lat, lng: event.latlng.lng };
        setPicked(point);
        if (marker) marker.setLatLng(event.latlng);
        else marker = L.marker(event.latlng, { icon }).addTo(map!);
      });
    });

    return () => {
      map?.remove();
    };
  }, [value]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4">
      <div className="flex h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 p-4">
          <div>
            <h2 className="font-bold text-slate-800">ປັກໝຸດສະຖານທີ່ຕິດຕັ້ງ</h2>
            <p className="text-xs text-slate-500">ກົດເທິງແຜນທີ່ເພື່ອວາງໝຸດ — ຊ່າງຈະກົດນຳທາງໄປຈຸດນີ້</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
          >
            <X className="size-4" />
          </button>
        </header>

        <div ref={container} className="flex-1" />

        <footer className="flex items-center gap-3 border-t border-slate-100 p-3">
          <span className="text-xs text-slate-500">
            {picked ? `${picked.lat.toFixed(5)}, ${picked.lng.toFixed(5)}` : "ຍັງບໍ່ໄດ້ວາງໝຸດ"}
          </span>
          <button
            type="button"
            disabled={!picked}
            onClick={() => {
              if (picked) onPick(picked);
              onClose();
            }}
            className="ml-auto inline-flex h-9 items-center rounded-lg bg-teal-600 px-4 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
          >
            ໃຊ້ຈຸດນີ້
          </button>
        </footer>
      </div>
    </div>
  );
}
