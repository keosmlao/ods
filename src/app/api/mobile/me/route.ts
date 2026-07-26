import { requireMobile } from "@/lib/mobile-auth";
import { mobileTabsFor } from "@/lib/mobile-nav";
import { ROLE_LABEL, roleOf } from "@/lib/roles";
import { NextResponse } from "next/server";

/**
 * ຕົວຕົນ + ແຖບລຸ່ມ **ປັດຈຸບັນ** ຂອງ token ນີ້ — ໃຫ້ແອັບດຶງ manifest ໃໝ່ຕອນເປີດແອັບ
 * ໂດຍ **ບໍ່ຕ້ອງ login ຄືນ**. ⇒ ປ່ຽນ tab/ສິດຂອງ role ຢູ່ server ແລ້ວ ຄົນທີ່ login ຄ້າງ
 * (token ອາຍຸ 30 ມື້) ກໍ່ໄດ້ tab ໃໝ່ໃນຄັ້ງເປີດຕໍ່ໄປ. ບໍ່ຈຳກັດ role (ທຸກຄົນທີ່ login ໄດ້).
 */
export async function GET(request: Request) {
  const guard = await requireMobile(request);
  if (!guard.ok) return guard.response;

  const role = roleOf(guard.user);
  const tabs = mobileTabsFor(role);
  return NextResponse.json({
    user: {
      username: guard.user.username,
      role,
      role_label: ROLE_LABEL[role],
      home: tabs[0].key,
      tabs,
    },
  });
}
