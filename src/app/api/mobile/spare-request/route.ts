import { requireMobile } from "@/lib/mobile-auth";
import { ownMobileJob } from "@/lib/job-flow";
import { addRepairSpare, listRepairSpares, removeRepairSpare } from "@/lib/repair-spare";
import { TECH_SIDE } from "@/lib/roles";
import {
  createInstallSpareRequest,
  createSpareRequest,
  createSpareReturn,
  outstandingSpares,
  pickupSpares,
} from "@/lib/tech-flow";
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
  | { action: "request"; workflow?: "install" | "repair"; code: string; remark?: string; wh_code: string; shelf_code: string }
  | { action: "pickup"; doc_ref: string; remark?: string }
  /** ອາໄຫຼ່ທີ່ **ຢູ່ນຳຊ່າງ** ຂອງງານນີ້ (ເບີກອອກແລ້ວ ຍັງບໍ່ຂໍຄືນ) */
  | { action: "outstanding"; workflow?: "install" | "repair"; code: string }
  /**
   * ຂໍສົ່ງຄືນອາໄຫຼ່ທີ່ບໍ່ໄດ້ໃຊ້ — ເມື່ອກ່ອນເຮັດໄດ້ແຕ່ຢູ່ເວັບ ⇒ ຊ່າງທີ່ຢູ່ໜ້າງານເຮັດບໍ່ໄດ້
   * ແລ້ວອາໄຫຼ່ຄ້າງຢູ່ນຳຊ່າງໂດຍບໍ່ມີເອກະສານ.
   */
  | {
      action: "return";
      workflow?: "install" | "repair";
      code: string;
      remark?: string;
      items: { item_code: string; qty: number }[];
    }
  /** ອາໄຫຼ່ຕອນສ້ອມ (ຂັ້ນ 9) — ລາຍການ · ເພີ່ມ · ຖອດ. ຫຼັງເພີ່ມແລ້ວ ໃຊ້ action "request" ຂໍເບີກ */
  | { action: "used-list"; code: string }
  | { action: "add-used"; code: string; item: { code: string; name_1: string; unit_code: string | null }; qty: number }
  | { action: "remove-used"; code: string; roworder: number };

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
    // ທຸກຄຳສັ່ງທີ່ອ້າງເຖິງ "ງານ" ຕ້ອງເປັນງານຂອງຊ່າງຄົນນີ້ເອງ
    if (body.action === "request" || body.action === "return" || body.action === "outstanding") {
      const workflow = body.workflow === "install" ? "install" : "repair";
      const own = await ownMobileJob(guard.user, workflow, String(body.code ?? ""));
      if (!own.ok) return NextResponse.json({ error: own.error }, { status: 403 });
    }

    // ອາໄຫຼ່ທີ່ຄ້າງຢູ່ນຳຊ່າງ — ອ່ານຢ່າງດຽວ (ໃຫ້ແອັບເອົາໄປສະແດງກ່ອນເລືອກສົ່ງຄືນ)
    if (body.action === "outstanding") {
      return NextResponse.json({ data: await outstandingSpares(String(body.code ?? "")) });
    }
    // ລາຍການອາໄຫຼ່ຕອນສ້ອມ (ຂັ້ນ 9) — ownMobileJob ກວດຢູ່ໃນ add/remove ເອງ; list ກວດຢູ່ນີ້
    if (body.action === "used-list") {
      const own = await ownMobileJob(guard.user, "repair", String(body.code ?? ""));
      if (!own.ok) return NextResponse.json({ error: own.error }, { status: 403 });
      return NextResponse.json({ data: await listRepairSpares(String(body.code ?? "")) });
    }
    const result =
      body.action === "request"
        ? await (body.workflow === "install" ? createInstallSpareRequest : createSpareRequest)(guard.user, {
            code: String(body.code ?? ""),
            remark: String(body.remark ?? ""),
            wh_code: String(body.wh_code ?? ""),
            shelf_code: String(body.shelf_code ?? ""),
          })
        : body.action === "add-used"
          ? await addRepairSpare(guard.user, String(body.code ?? ""), body.item, Number(body.qty) || 1)
          : body.action === "remove-used"
            ? await removeRepairSpare(guard.user, String(body.code ?? ""), Number(body.roworder))
            : body.action === "pickup"
              ? await pickupSpares(guard.user, String(body.doc_ref ?? ""), String(body.remark ?? ""))
              : body.action === "return"
                ? await createSpareReturn(guard.user, {
                    code: String(body.code ?? ""),
                    remark: String(body.remark ?? ""),
                    items: Array.isArray(body.items) ? body.items : [],
                  })
                : { ok: false as const, error: "ຄຳສັ່ງບໍ່ຖືກຕ້ອງ" };

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

    for (const path of ["/stock/requests", "/stock/requests/pickup", "/stock/returns", "/repair", "/dashboard"]) {
      revalidatePath(path);
    }
    return NextResponse.json({ ok: true, message: result.message });
  } catch (error) {
    console.error("Mobile spare-request failed", error);
    return NextResponse.json({ error: "ດຳເນີນການບໍ່ສຳເລັດ" }, { status: 500 });
  }
}
