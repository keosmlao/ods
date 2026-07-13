import { getSession } from "@/lib/auth";
import type { PermissionAction } from "@/lib/permission-catalog";
import { canUser } from "@/lib/permissions";
import { NextResponse } from "next/server";

/**
 * ດ່ານກວດຂອງ **API route** — ຄູ່ກັບ lib/guard.ts ຂອງ server action.
 *
 * matcher ຂອງ src/proxy.ts ຂຽນວ່າ `/((?!api|_next/static|…).*)` ⇒ **ຕັດ /api ອອກ**.
 * ດ່ານກວດ role ຂອງໜ້າຈຶ່ງບໍ່ຄຸມມາຮອດ route ພວກນີ້ເລີຍ ແລະ ທຸກ route ກວດແຕ່
 * "login ຢູ່ບໍ" ⇒ ຊ່າງ ຫຼື ພະນັກງານທົ່ວໄປ ດຶງລາຍງານໃບຮັບເງິນ, ຂໍ້ມູນລູກຄ້າ ອອກໄດ້ໝົດ.
 *
 * ບໍ່ສ້າງຕາຕະລາງສິດອັນທີສອງ — ອີງໃສ່ກົດຂອງ "ໜ້າ" ທີ່ route ນັ້ນຮັບໃຊ້ໂດຍກົງ
 * (canAccess ອັນດຽວກັນກັບ proxy ແລະ ເມນູ) ⇒ ແກ້ສິດຢູ່ lib/roles ບ່ອນດຽວ ຄຸມທັງສາມ.
 *
 * ໃຊ້:
 *   const denied = await guardApi("/reports/receipts");
 *   if (denied) return denied;
 */
export async function guardApi(pagePath: string, action: PermissionAction = "read"): Promise<NextResponse | null> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await canUser(session, pagePath, action))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return null;
}

/**
 * ຄືກັນ ແຕ່ຄືນພຽງ true/false — ໃຫ້ route ສ້າງ response ຮູບແບບຂອງຕົນເອງ.
 * route ຄົ້ນຫາ (customers/products/brands/…) ຄືນ `[]` ຕອນປະຕິເສດ ບໍ່ແມ່ນ `{error}`
 * ⇒ ຖ້າບັງຄັບໃຫ້ຄືນ {error} ຝັ່ງ client ທີ່ຄາດຫວັງ array ຈະພັງ.
 */
export async function apiAllowed(pagePath: string, action: PermissionAction = "read"): Promise<boolean> {
  const session = await getSession();
  return Boolean(session) && Boolean(session && (await canUser(session, pagePath, action)));
}
