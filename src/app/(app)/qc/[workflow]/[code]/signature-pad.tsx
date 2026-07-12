"use client";
import { Eraser, PenLine } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * ແຜ່ນແຕ້ມລາຍເຊັນລູກຄ້າ — ຄືນຄ່າເປັນ data URI (PNG) ໃຫ້ຟອມ QC.
 *
 * ⚠️ ເກັບເປັນ base64 ໃນຖານ (ods_qc_signature.signature) ⇒ **ຕ້ອງນ້ອຍ**.
 * ແຜ່ນເປັນ 600×200 ຂາວດຳ ⇒ PNG ປະມານ 5-15 KB (ຮູບຖ່າຍໃຫຍ່ກວ່າ 20 ເທົ່າ).
 * ບໍ່ຂະຫຍາຍຄວາມລະອຽດຕາມ devicePixelRatio ດ້ວຍເຫດຜົນນີ້ — ລາຍເຊັນບໍ່ຕ້ອງຄົມ
 * ພຽງແຕ່ອ່ານອອກ ແລະ ພິສູດການຮັບມອບໄດ້.
 */

const WIDTH = 600;
const HEIGHT = 200;

export function SignaturePad({ name, disabled }: { name: string; disabled?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [value, setValue] = useState("");

  useEffect(() => {
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    context.lineWidth = 2.5;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#0f172a";
  }, []);

  /** ຈຸດໃນລະບົບພິກັດຂອງ canvas — ແຜ່ນຖືກຫຍໍ້ດ້ວຍ CSS ຈຶ່ງຕ້ອງແປງມາດຕາສ່ວນ */
  function pointOf(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget;
    const box = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - box.left) / box.width) * canvas.width,
      y: ((event.clientY - box.top) / box.height) * canvas.height,
    };
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    drawing.current = true;
    const point = pointOf(event);
    context.beginPath();
    context.moveTo(point.x, point.y);
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    const point = pointOf(event);
    context.lineTo(point.x, point.y);
    context.stroke();
  }

  function end(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    drawing.current = false;
    setValue(event.currentTarget.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    setValue("");
  }

  return (
    <div>
      <input type="hidden" name={name} value={value} />
      <div className="flex items-center justify-between pb-1">
        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
          <PenLine className="size-3.5" /> ລາຍເຊັນລູກຄ້າ (ແຕ້ມໃນຊ່ອງ)
        </span>
        <button
          type="button"
          onClick={clear}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
        >
          <Eraser className="size-3.5" /> ລຶບ
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        // touch-none: ບໍ່ດັ່ງນັ້ນນິ້ວທີ່ແຕ້ມຢູ່ມືຖືຈະເລື່ອນໜ້າແທນທີ່ຈະຂຽນ
        className="h-32 w-full touch-none rounded-lg border border-dashed border-slate-300 bg-white"
      />
    </div>
  );
}
