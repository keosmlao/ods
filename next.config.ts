import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

/**
 * ເປີດ dev server ຈາກ **ເຄື່ອງອື່ນໃນວົງ LAN** (ມືຖືຊ່າງ / ແອັບ Flutter).
 *
 * Next 16 ບລັອກ cross-origin ຫາ /_next/* ຂອງ dev ໄວ້ໂດຍຄ່າຕັ້ງຕົ້ນ ⇒ ເປີດຈາກ
 * http://<IP>:3000 ແລ້ວ HMR ຖືກກັ້ນ ("Blocked cross-origin request").
 *
 * ⚠️ IP ປ່ຽນທຸກຄັ້ງທີ່ຍ້າຍ Wi-Fi ⇒ **ຫາເອງຈາກ network interface** ບໍ່ໃຫ້ຄົນມາແກ້ໄຟລ໌
 * ທຸກເທື່ອ (ຮຸ່ນກ່ອນອາໄສ .env ແລ້ວກໍ່ລືມຕັ້ງ). ຕື່ມທາງ DEV_ORIGINS ໄດ້ອີກຖ້າຕ້ອງການ.
 *
 * ຄ່ານີ້ໃຊ້ **ສະເພາະ dev server** — ບໍ່ມີຜົນຕອນ build/ຂຶ້ນຈິງ.
 */
function localAddresses(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((item) => item && item.family === "IPv4" && !item.internal)
    .map((item) => item!.address);
}

const extra = (process.env.DEV_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  allowedDevOrigins: ["localhost", "127.0.0.1", ...localAddresses(), ...extra],
};

export default nextConfig;
