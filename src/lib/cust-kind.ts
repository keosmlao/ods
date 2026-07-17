/**
 * **ປະເພດລູກຄ້າ — ຄ່າຄົງທີ່ລ້ວນໆ (ບໍ່ແຕະຖານຂໍ້ມູນ).**
 *
 * ── ເປັນຫຍັງແຍກອອກຈາກ lib/service-money ──
 * `service-money` import `lib/db` (ຕົວ `pg`) ⇒ ໄຟລ໌ນັ້ນເປັນ **server ເທົ່ານັ້ນ**.
 * ພໍ client component (`kind-cell.tsx`) import ປ້າຍຊື່ຈາກມັນ, bundler ດຶງ `pg`
 * ເຂົ້າ browser ແລ້ວ **build ພັງ** (`Module not found: Can't resolve 'util/types'`)
 * — dev server ແລະ typecheck ຈັບບໍ່ໄດ້ ເຫັນແຕ່ຕອນ `next build`.
 * ⇒ ຄ່າທີ່ **ສອງຝັ່ງໃຊ້ຮ່ວມກັນ** ຕ້ອງຢູ່ໄຟລ໌ທີ່ບໍ່ import ຫຍັງເລີຍ ຄືອັນນີ້.
 */

/** `ar_customer.cust_kind` — null = ຍັງບໍ່ລະບຸ (ຢ່າເດົາຈາກຊື່) */
export type CustKind = "shop" | "general";

export const CUST_KIND_LABEL: Record<CustKind, string> = {
  shop: "ຮ້ານຄ້າ / ບໍລິສັດ",
  general: "ລູກຄ້າທົ່ວໄປ",
};

export const UNSET_KIND_LABEL = "ຍັງບໍ່ລະບຸ";
