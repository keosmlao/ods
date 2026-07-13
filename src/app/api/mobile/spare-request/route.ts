import { requireMobile } from "@/lib/mobile-auth";
import { ownMobileJob } from "@/lib/job-flow";
import { TECH_SIDE } from "@/lib/roles";
import { createSpareRequest, pickupSpares } from "@/lib/tech-flow";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

/**
 * ອາໄຫຼ່ຂອງງານສ້ອມ — **ຊ່າງ ↔ ສາງ ເທົ່ານັ້ນ ບໍ່ຜ່ານ CS** (ນະໂຍບາຍ, ເບິ່ງ lib/roles):
 *   ຊ່າງອອກໃບຂໍເບີກ (SION) → ສາງເບີກອອກ (ERP) → ຊ່າງກົດຮັບອາໄຫຼ່ (PISP)
 *
 * ສອງຂັ້ນທີ່ **ຊ່າງ** ເຮັດ ຢູ່ນີ້: `request` ແລະ `pickup`.
 * ຕົວອອກເອກະສານຢູ່ lib/tech-flow ບ່ອນດຽວ (ອັນດຽວກັບປຸ່ມຢູ່ເວັບ).
 */
type Body =
  | { action: "request"; code: string; remark?: string; wh_code: string; shelf_code: string }
  | { action: "pickup"; doc_ref: string; remark?: string };

export async function POST(request: Request) {
  const guard = await requireMobile(request, TECH_SIDE);
  if (!guard.ok) return guard.response;

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "ຂໍ້ມູນບໍ່ຖືກຕ້ອງ" }, { status: 400 });
  }

  try {
    if (body.action === "request") {
      const own = await ownMobileJob(guard.user, "repair", String(body.code ?? ""));
      if (!own.ok) return NextResponse.json({ error: own.error }, { status: 403 });
    }
    const result =
      body.action === "request"
        ? await createSpareRequest(guard.user, {
            code: String(body.code ?? ""),
            remark: String(body.remark ?? ""),
            wh_code: String(body.wh_code ?? ""),
            shelf_code: String(body.shelf_code ?? ""),
          })
        : body.action === "pickup"
          ? await pickupSpares(guard.user, String(body.doc_ref ?? ""), String(body.remark ?? ""))
          : { ok: false as const, error: "ຄຳສັ່ງບໍ່ຖືກຕ້ອງ" };

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

    for (const path of ["/stock/requests", "/stock/requests/pickup", "/stock/dispatch", "/repair", "/dashboard"]) {
      revalidatePath(path);
    }
    return NextResponse.json({ ok: true, message: result.message });
  } catch (error) {
    console.error("Mobile spare-request failed", error);
    return NextResponse.json({ error: "ດຳເນີນການບໍ່ສຳເລັດ" }, { status: 500 });
  }
}
