import { verifyCredentials } from "@/lib/credentials";
import { createMobileToken } from "@/lib/mobile-auth";
import { ROLE_LABEL, roleOf, TECH_SIDE } from "@/lib/roles";
import { NextResponse } from "next/server";

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
    if (!TECH_SIDE.includes(role)) {
      return NextResponse.json({ error: "ແອັບນີ້ສຳລັບພະນັກງານຝ່າຍຊ່າງເທົ່ານັ້ນ" }, { status: 403 });
    }
    return NextResponse.json({
      token: await createMobileToken(result.session),
      user: { username: result.session.username, role, role_label: ROLE_LABEL[role] },
    });
  } catch (error) {
    console.error("Mobile login failed", error);
    return NextResponse.json({ error: "ບໍ່ສາມາດເຊື່ອມຕໍ່ຖານຂໍ້ມູນໄດ້" }, { status: 500 });
  }
}
