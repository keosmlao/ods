import { verifyCredentials } from "@/lib/credentials";
import { recordLogin } from "@/lib/login-log";
import { createMobileToken } from "@/lib/mobile-auth";
import { mobileTabsFor } from "@/lib/mobile-nav";
import { ROLE_LABEL, roleOf } from "@/lib/roles";
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
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null;
    await recordLogin(result.session.username, "mobile", ip, request.headers.get("user-agent"));
    // ພະນັກງານ ACTIVE ທຸກຄົນໃຊ້ແອັບໄດ້ (verifyCredentials ກັນຄົນປິດບັນຊີແລ້ວ) —
    // ແຖບລຸ່ມ (ສ່ວນງານ) ຕາມ role · tab ທຳອິດ = ໜ້າຕັ້ງຕົ້ນ (home)
    const tabs = mobileTabsFor(role);
    const home = tabs[0].key;
    return NextResponse.json({
      token: await createMobileToken(result.session),
      user: { username: result.session.username, role, role_label: ROLE_LABEL[role], home, tabs },
    });
  } catch (error) {
    console.error("Mobile login failed", error);
    return NextResponse.json({ error: "ບໍ່ສາມາດເຊື່ອມຕໍ່ຖານຂໍ້ມູນໄດ້" }, { status: 500 });
  }
}
