import { requireMobile } from "@/lib/mobile-auth";
import { ownMobileJob } from "@/lib/job-flow";
import {
  addInstallSpare,
  installSpareStandards,
  listInstallSpares,
  removeInstallSpare,
  setInstallSpareQty,
} from "@/lib/install-spare";
import { addRepairSpare, listRepairSpares, removeRepairSpare } from "@/lib/repair-spare";
import {
  purchaseRounds,
  withdrawLineStatuses,
  withdrawRounds,
} from "@/lib/repair-spare-rounds";
import { TECH_SIDE } from "@/lib/roles";
import {
  createInstallSpareRequest,
  createSpareRequest,
  createSpareReturn,
  outstandingSpares,
  pendingSpareLines,
  pickupSpares,
} from "@/lib/tech-flow";
import { revalidatePath } from "next/cache";
import { syncErpDispatchForJob } from "@/lib/erp-dispatch";
import { NextResponse } from "next/server";

/**
 * ອາໄຫຼ່ຂອງງານສ້ອມ — **ຊ່າງ ↔ ສາງ ເທົ່ານັ້ນ ບໍ່ຜ່ານ CS** (ນະໂຍບາຍ, ເບິ່ງ lib/roles):
 *   ຊ່າງອອກໃບຂໍເບີກ (SION) → ສາງເບີກອອກ (ERP) → ຊ່າງກົດຮັບອາໄຫຼ່ (PISP)
 *
 * ສອງຂັ້ນທີ່ **ຊ່າງ** ເຮັດ ຢູ່ນີ້: `request` ແລະ `pickup`.
 * ຕົວອອກເອກະສານຢູ່ lib/tech-flow ບ່ອນດຽວ (ອັນດຽວກັບປຸ່ມຢູ່ເວັບ).
 */
type Body =
  /**
   * `take` = item_code → ຈຳນວນທີ່ **ໃບນີ້** ຈະເອົາ (1 ສາງ ຕໍ່ 1 ໃບ — lib/spare-take).
   * ບໍ່ສົ່ງມາ = ເອົາຄ້າງທັງໝົດ ຄືເກົ່າ ⇒ ແອັບຮຸ່ນເກົ່າບໍ່ຕ້ອງແກ້.
   */
  | {
      action: "request";
      workflow?: "install" | "repair";
      code: string;
      remark?: string;
      wh_code: string;
      shelf_code: string;
      take?: Record<string, number>;
    }
  /** ລາຍການທີ່ຍັງຄ້າງຂໍເບີກ — ໃຫ້ແອັບໂຊ້ວກ່ອນເລືອກຈຳນວນ */
  | { action: "request-lines"; workflow?: "install" | "repair"; code: string }
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
  /**
   * ກະຕ່າອາໄຫຼ່ຂອງງານ — ລາຍການ · ເພີ່ມ · ຖອດ · ແກ້ຈຳນວນ. ຫຼັງເພີ່ມແລ້ວ ໃຊ້ action "request" ຂໍເບີກ.
   *
   * `workflow` ຫວ່າງ = ສ້ອມ (ຄືເກົ່າ — ແອັບຮຸ່ນເກົ່າບໍ່ສົ່ງຖັນນີ້ມາ):
   *   ສ້ອມ   ຂັ້ນ 5-9 · ຄົ້ນ ERP ແລ້ວແຕະເພີ່ມ (lib/repair-spare)
   *   ຕິດຕັ້ງ ຮັບງານແລ້ວ ຈົນກ່ອນເລີ່ມຕິດຕັ້ງ · ຊຸດຕິດຕັ້ງ + ນອກຊຸດຕາມສະວິດ (lib/install-spare)
   */
  | { action: "used-list"; workflow?: "install" | "repair"; code: string }
  | {
      action: "add-used";
      workflow?: "install" | "repair";
      code: string;
      item: { code: string; name_1: string; unit_code: string | null };
      qty: number;
    }
  | { action: "remove-used"; workflow?: "install" | "repair"; code: string; roworder: number }
  /** ແກ້ຈຳນວນແຖວກະຕ່າ — ຝັ່ງຕິດຕັ້ງເທົ່ານັ້ນ (ຈຳນວນມາຈາກຊຸດ ⇒ ຕ້ອງປັບໄດ້) */
  | { action: "set-qty"; workflow?: "install"; code: string; roworder: number; qty: number }
  /** ຊຸດຕິດຕັ້ງຂອງໃບງານ (ລາຍການມາດຕະຖານ) + ເປີດໃຫ້ຄົ້ນນອກຊຸດບໍ */
  | { action: "standards"; code: string };

/**
 * ລ້າງຮູບແບບ `take` ທີ່ມາຈາກແອັບ — ຮັບແຕ່ຕົວເລກ ≥ 0; ອັນອື່ນເປັນ 0 (ບໍ່ເອົາລາຍການນັ້ນ).
 * ບໍ່ແມ່ນດ່ານຄວາມປອດໄພ: ຕົວຕັດຈິງແມ່ນ `takeQty` ຢູ່ lib/tech-flow ທີ່ຕັດບໍ່ໃຫ້ເກີນ
 * "ຈຳນວນຄ້າງ" ທີ່ server ຄິດເອງ. ຢູ່ນີ້ພຽງກັນ NaN/null ລາມເຂົ້າໄປເປັນ qty ຜິດ.
 * ບໍ່ສົ່ງມາ (undefined) = ເອົາຄ້າງທັງໝົດ ຄືເກົ່າ ⇒ ແອັບຮຸ່ນເກົ່າບໍ່ຕ້ອງແກ້.
 */
function sanitizeTake(take: unknown): Record<string, number> | undefined {
  if (!take || typeof take !== "object" || Array.isArray(take)) return undefined;
  const clean: Record<string, number> = {};
  for (const [itemCode, value] of Object.entries(take as Record<string, unknown>)) {
    const qty = Number(value);
    clean[itemCode] = Number.isFinite(qty) && qty > 0 ? qty : 0;
  }
  return Object.keys(clean).length ? clean : undefined;
}

/**
 * **ບັນຊີອາໄຫຼ່ແບ່ງຕາມຮອບ** (GET ?code=…&workflow=…) — ຂໍ້ມູນຊຸດດຽວກັບເວັບ
 * (lib/repair-spare-rounds): ຮອບໃດເບີກແລ້ວ/ຄ້າງ/ກຳລັງສັ່ງຊື້. ສະຖານະແຖວຂອງແຕ່ລະໃບ
 * ນິຍາມດຽວກັບຄິວເວັບ (status=5 + arrive_at) ⇒ ມືຖື ແລະ ເວັບເຫັນຢ່າງດຽວກັນ.
 */
export async function GET(request: Request) {
  const guard = await requireMobile(request, TECH_SIDE);
  if (!guard.ok) return guard.response;

  const params = new URL(request.url).searchParams;
  const code = String(params.get("code") ?? "").trim();
  const workflow = params.get("workflow") === "install" ? "install" : "repair";
  if (!code) return NextResponse.json({ error: "ບໍ່ພົບເລກວຽກ" }, { status: 400 });

  try {
    const own = await ownMobileJob(guard.user, workflow, code);
    if (!own.ok) return NextResponse.json({ error: own.error }, { status: 403 });

    /**
     * ດຶງໃບເບີກທີ່ສາງອອກຢູ່ **ERP** ກ່ອນອ່ານຮອບ — ຄືກັບໜ້າໃບງານຝັ່ງເວັບ (05-08-2026).
     * ບໍ່ດັ່ງນັ້ນແອັບຊ່າງຂຶ້ນ "ລໍສາງເບີກ" ຄ້າງ ທັງທີ່ສາງເບີກໄປແລ້ວ — ຊ່າງຢູ່ໜ້າງານ
     * ເຫັນສະຖານະຜິດ ແລ້ວໄປທວງສາງລ້າໆ. ບໍ່ມີແຖວລໍເບີກ ⇒ ຂ້າມທັນທີ (ບໍ່ແຕະ ERP).
     */
    await syncErpDispatchForJob(code);

    const [withdrawals, purchases, statuses] = await Promise.all([
      withdrawRounds(code),
      purchaseRounds(code),
      withdrawLineStatuses(code),
    ]);
    return NextResponse.json({
      withdrawals: withdrawals.map((round) => ({
        ...round,
        ...(statuses[round.doc_no] ?? { status: null, on_order: 0, arrived: 0 }),
      })),
      purchases,
    });
  } catch (error) {
    console.error("Mobile spare rounds failed", error);
    return NextResponse.json({ error: "ໂຫຼດຮອບອາໄຫຼ່ບໍ່ສຳເລັດ" }, { status: 500 });
  }
}

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
    if (
      body.action === "request" ||
      body.action === "request-lines" ||
      body.action === "return" ||
      body.action === "outstanding"
    ) {
      const workflow = body.workflow === "install" ? "install" : "repair";
      const own = await ownMobileJob(guard.user, workflow, String(body.code ?? ""));
      if (!own.ok) return NextResponse.json({ error: own.error }, { status: 403 });
    }

    // ອາໄຫຼ່ທີ່ຄ້າງຢູ່ນຳຊ່າງ — ອ່ານຢ່າງດຽວ (ໃຫ້ແອັບເອົາໄປສະແດງກ່ອນເລືອກສົ່ງຄືນ)
    if (body.action === "outstanding") {
      return NextResponse.json({ data: await outstandingSpares(String(body.code ?? "")) });
    }
    // ລາຍການທີ່ຍັງຄ້າງຂໍເບີກ — ອ່ານຢ່າງດຽວ (ໃຫ້ຊ່າງເລືອກຈຳນວນຂອງໃບນີ້)
    if (body.action === "request-lines") {
      return NextResponse.json({ data: await pendingSpareLines(String(body.code ?? "")) });
    }
    // ລາຍການອາໄຫຼ່ຂອງງານ — ownMobileJob ກວດຢູ່ໃນ add/remove ເອງ; ອ່ານຢ່າງດຽວກວດຢູ່ນີ້
    if (body.action === "used-list" || body.action === "standards") {
      const workflow = body.action === "standards" || body.workflow === "install" ? "install" : "repair";
      const own = await ownMobileJob(guard.user, workflow, String(body.code ?? ""));
      if (!own.ok) return NextResponse.json({ error: own.error }, { status: 403 });
      if (body.action === "standards") {
        return NextResponse.json(await installSpareStandards(String(body.code ?? "")));
      }
      return NextResponse.json({
        data: await (workflow === "install" ? listInstallSpares : listRepairSpares)(String(body.code ?? "")),
      });
    }
    // "pickup" ບໍ່ມີຖັນ workflow (ອ້າງເອກະສານ ບໍ່ແມ່ນງານ) ⇒ ກວດດ້ວຍ `in` ບໍ່ໃຫ້ TS ຟ້ອງ
    const install = "workflow" in body && body.workflow === "install";
    const result =
      body.action === "request"
        ? await (install ? createInstallSpareRequest : createSpareRequest)(guard.user, {
            code: String(body.code ?? ""),
            remark: String(body.remark ?? ""),
            wh_code: String(body.wh_code ?? ""),
            shelf_code: String(body.shelf_code ?? ""),
            take: sanitizeTake(body.take),
          })
        : body.action === "add-used"
          ? install
            ? await addInstallSpare(guard.user, String(body.code ?? ""), String(body.item?.code ?? ""))
            : await addRepairSpare(guard.user, String(body.code ?? ""), body.item, Number(body.qty) || 1)
          : body.action === "remove-used"
            ? await (install ? removeInstallSpare : removeRepairSpare)(
                guard.user,
                String(body.code ?? ""),
                Number(body.roworder),
              )
            : body.action === "set-qty"
              ? await setInstallSpareQty(
                  guard.user,
                  String(body.code ?? ""),
                  Number(body.roworder),
                  Number(body.qty),
                )
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

    // ແອັບແກ້ກະຕ່າຝັ່ງຕິດຕັ້ງໄດ້ແລ້ວ ⇒ ລ້າງແຄສໜ້າຕິດຕັ້ງນຳ ບໍ່ດັ່ງນັ້ນເວັບຍັງເຫັນລາຍການເກົ່າ
    for (const path of [
      "/stock/requests",
      "/stock/requests/pickup",
      "/stock/returns",
      "/repair",
      "/installations",
      `/installations/spare-requests/${"code" in body ? String(body.code ?? "") : ""}`,
      "/dashboard",
    ]) {
      revalidatePath(path);
    }
    return NextResponse.json({ ok: true, message: result.message });
  } catch (error) {
    console.error("Mobile spare-request failed", error);
    return NextResponse.json({ error: "ດຳເນີນການບໍ່ສຳເລັດ" }, { status: 500 });
  }
}
