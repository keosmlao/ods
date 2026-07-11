import { permanentRedirect } from "next/navigation";

/**
 * ສັນຍາເກົ່າຂອງ QR ໃນໃບຮັບເຄື່ອງທີ່ພິມອອກໄປແລ້ວ:
 * ods/templates/billprint/reciptpd.html → qrcode('https://www.odienmall.com/servicefuond/' + code)
 * (code = tb_product.code = "ລະຫັດເຄື່ອງສ້ອມ" ໃນໃບ).
 *
 * ເກັບ path ນີ້ໄວ້ ເພື່ອວ່າຖ້າ www.odienmall.com/servicefuond/* ຖືກ proxy/redirect ມາຫາລະບົບນີ້
 * QR ໃນໃບເກົ່າຈະຍັງໃຊ້ໄດ້ໂດຍບໍ່ຕ້ອງພິມໃບໃໝ່.
 */
export default async function ServiceFuondAlias({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  permanentRedirect(`/track/${encodeURIComponent(decodeURIComponent(code))}`);
}
