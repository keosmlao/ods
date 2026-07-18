import { verifyCredentials } from "@/lib/credentials";
import { createMobileToken } from "@/lib/mobile-auth";
import { APPROVER_SIDE, ROLE_LABEL, roleOf, STOCK_SIDE, TECH_SIDE } from "@/lib/roles";
import { NextResponse } from "next/server";

/**
 * role ທີ່ໃຊ້ແອັບໄດ້ — ຊ່າງ (ຄິວວຽກຕົນ) + ຫົວໜ້າ/ຜູ້ຈັດການ/ສາງ (ກວດນັບສະຕ໋ອກ).
 * ແອັບ route ຕາມ role: ຊ່າງ → ຄິວວຽກ · ບໍ່ແມ່ນຊ່າງ → ກວດນັບສະຕ໋ອກ.
 */
const APP_ROLES = new Set([...TECH_SIDE, ...APPROVER_SIDE, ...STOCK_SIDE]);

/**
 * ເຂົ້າສູ່ລະບົບຈາກແອັບມືຖື — ລະຫັດພະນັກງານ (ຫຼື ຊື່ຫຼິ້ນ/ຊື່ເຕັມ) + ລະຫັດຜ່ານ.
 * ກົດເກນການກວດຕົວຕົນອັນດຽວກັບເວັບ (lib/credentials) ⇒ ຄົນທີ່ຜູ້ຈັດການປິດບັນຊີໄວ້
 * ເຂົ້າທາງແອັບກໍ່ບໍ່ໄດ້.
 */
export async function POST(request: Request) {
  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "ຂໍ້ມູນບໍ່ຖືກຕ້ອງ" }, { status: 400 });
  }

  try {
    const result = await verifyCredentials(String(body.username ?? "").trim(), String(body.password ?? ""));
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 401 });

    const role = roleOf(result.session);
    if (!APP_ROLES.has(role)) {
      return NextResponse.json({ error: "ບັນຊີນີ້ບໍ່ມີສິດໃຊ້ແອັບ" }, { status: 403 });
    }
    // ຊ່າງ → ຄິວວຽກ · ບໍ່ແມ່ນຊ່າງ → ໜ້າກວດນັບສະຕ໋ອກ (ໃຫ້ແອັບ route ໄດ້ເລີຍ)
    const home = TECH_SIDE.includes(role) ? "jobs" : "stock-count";
    return NextResponse.json({
      token: await createMobileToken(result.session),
      user: { username: result.session.username, role, role_label: ROLE_LABEL[role], home },
    });
  } catch (error) {
    console.error("Mobile login failed", error);
    return NextResponse.json({ error: "ບໍ່ສາມາດເຊື່ອມຕໍ່ຖານຂໍ້ມູນໄດ້" }, { status: 500 });
  }
}
