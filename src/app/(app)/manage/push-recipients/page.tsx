import { PushEventMatrix } from "@/components/manage/push-event-matrix";
import { PushStatusMatrix } from "@/components/manage/push-status-matrix";
import { PushRecipientManager, type KindState } from "@/components/manage/push-recipient-manager";
import { getSession } from "@/lib/auth";
import { ROLE_APPROVER } from "@/lib/chatter";
import { recipientsForRoles } from "@/lib/notify";
import { listPushEvents } from "@/lib/push-event";
import { pushStatusOverrides } from "@/lib/push-status";
import { pushEventKey } from "@/lib/push-event-shared";
import { listPushChoices, pushAudience } from "@/lib/push-recipient";
import { PUSH_KINDS, type PushKind } from "@/lib/push-recipient-shared";
import { APPROVER_SIDE, roleOf } from "@/lib/roles";
import { BellRing } from "lucide-react";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * ກຳນົດຜູ້ຮັບແຈ້ງເຕືອນເຂົ້າມືຖື — ຜູ້ອະນຸມັດເທົ່ານັ້ນ (lib/roles).
 *
 * ລາຍຊື່ມາຈາກ **ເຄື່ອງທີ່ລົງທະບຽນ + ຄົນທີ່ login ແອັບ** ບໍ່ແມ່ນລາຍຊື່ພະນັກງານທັງໝົດ:
 * ຄົນທີ່ບໍ່ເຄີຍແຕະແອັບ ເລືອກໄປກໍ່ບໍ່ມີບ່ອນຍິງ (ເບິ່ງ pushAudience).
 */
export default async function PushRecipientsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!APPROVER_SIDE.includes(roleOf(session))) redirect("/forbidden");

  const choices = await listPushChoices();
  const [people, approvers, events, statusRules] = await Promise.all([
    // ຄົນທີ່ເຄີຍຖືກເລືອກ ຕ້ອງຢູ່ໃນຕາຕະລາງນຳ ເຖິງລາວຈະຖອນແອັບອອກແລ້ວ
    pushAudience(choices.map((row) => row.username)),
    // ຄ່າຕັ້ງຕົ້ນຂອງ 'approval' = ຄົນທີ່ pushToRoles ຈະຍິງໃສ່ຖ້າຍັງບໍ່ໄດ້ກຳນົດຫຍັງ
    recipientsForRoles(ROLE_APPROVER),
    listPushEvents(),
    pushStatusOverrides(),
  ]);

  const state = Object.fromEntries(
    PUSH_KINDS.map((kind) => [
      kind,
      {
        /**
         * ຄ່າຕັ້ງຕົ້ນຂອງ 'digest' = **ທຸກຄົນທີ່ໄດ້ຮັບແຈ້ງເຕືອນນັ້ນ** (ຄິດຕອນຍິງ ບໍ່ແມ່ນລາຍຊື່ຄົງທີ່)
         * ⇒ ໃນຕາຕະລາງນີ້ຖືວ່າທຸກຄົນທີ່ໃຊ້ແອັບຢູ່ຕິດໝົດ ຈຶ່ງຕົງກັບສິ່ງທີ່ເກີດຂຶ້ນຈິງ.
         */
        byDefault:
          kind === "approval"
            ? approvers.map((name) => name.trim().toLowerCase())
            : people.map((person) => person.username.toLowerCase()),
        chosen: Object.fromEntries(
          choices.filter((row) => row.kind === kind).map((row) => [row.username.trim().toLowerCase(), row.active]),
        ),
      } satisfies KindState,
    ]),
  ) as Record<PushKind, KindState>;

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-bold text-slate-700">
          <BellRing className="size-5 text-brand-700" /> ຜູ້ຮັບແຈ້ງເຕືອນເຂົ້າມືຖື
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          ເລືອກວ່າໃຜຄວນໄດ້ຮັບ push ແຕ່ລະປະເພດ. ບໍ່ຕັ້ງຫຍັງ = ສົ່ງຕາມ role ຄືເກົ່າ ·
          ງານທີ່ມອບໃຫ້ຊ່າງໂດຍກົງ ແລະ ຂໍ້ຄວາມແຊັດ <b>ສົ່ງເຖິງເຈົ້າຕົວສະເໝີ</b> (ປິດບໍ່ໄດ້).
        </p>
      </div>
      {/* ① ຍິງ**ອັນໃດ** ② ຍິງ**ໃຫ້ໃຜ** — ສອງຄຳຖາມຄົນລະອັນ ຈຶ່ງແຍກບັດ */}
      <PushEventMatrix
        disabled={events.filter((row) => !row.enabled).map((row) => pushEventKey(row.model, row.kind))}
      />
      <PushStatusMatrix overrides={Object.fromEntries(statusRules)} />
      <PushRecipientManager people={people} state={state} />
    </div>
  );
}
