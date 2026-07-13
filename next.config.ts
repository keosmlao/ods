import type { NextConfig } from "next";

/**
 * ເປີດ dev server ຈາກ **ເຄື່ອງອື່ນໃນວົງ LAN** (ມືຖືຊ່າງ / ແອັບ Flutter).
 *
 * Next 16 ບລັອກ cross-origin ຫາ /_next/* ຂອງ dev ໄວ້ໂດຍຄ່າຕັ້ງຕົ້ນ ⇒ ເປີດຈາກ
 * http://<IP>:3000 ແລ້ວ HMR ຖືກກັ້ນ ("Blocked cross-origin request").
 *
 * ຄ່ານີ້ໃຊ້ **ສະເພາະຕອນ dev** (ບໍ່ມີຜົນຕອນ build/ຂຶ້ນຈິງ).
 * IP ປ່ຽນຕາມ Wi-Fi ⇒ ໃສ່ເພີ່ມທາງ .env: DEV_ORIGINS=10.0.40.9,192.168.1.51
 */
const devOrigins = (process.env.DEV_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  allowedDevOrigins: ["localhost", "127.0.0.1", ...devOrigins],
};

export default nextConfig;
