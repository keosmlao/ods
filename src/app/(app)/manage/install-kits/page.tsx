import { InstallKitManager } from "@/components/manage/install-kit-manager";
import { requirePermissionOrRedirect } from "@/lib/guard";
import { INSTALL_KIT_MENU, listInstallKits } from "@/lib/install-kit";
import { permissionFor } from "@/lib/permissions";
import { Boxes } from "lucide-react";

/**
 * **ຊຸດອາໄຫຼ່ມາດຕະຖານຂອງງານຕິດຕັ້ງ** (`ods.used_spare_install`).
 *
 * ຕອບຄຳຖາມ "ຕິດຕັ້ງແອຂະໜາດນີ້ ຕ້ອງໃຊ້ອາໄຫຼ່ຫຍັງແດ່ ຈັກອັນ" ແລະ ໃຫ້ແກ້ໄດ້ໂດຍບໍ່ຕ້ອງ
 * ໄປ update ຖານດ້ວຍມື. ຕອນເປີດງານ createInstall ກ໋ອບຊຸດນີ້ລົງກະຕ່າຂອງງານ
 * ⇒ ແກ້ຢູ່ນີ້ມີຜົນກັບ **ງານໃໝ່** ເທົ່ານັ້ນ.
 *
 * ສິດ: ອ່ານ/ເພີ່ມ/ແກ້ໄຂ/ລົບ ແຍກກັນ ແລະ **ສິດລາຍຄົນຊະນະ role** (lib/permissions)
 * ⇒ ຜູ້ຈັດການເປີດໃຫ້ CS ແກ້ໄດ້ ໂດຍບໍ່ຕ້ອງຍົກ role ທັງກ້ອນ.
 */
export const dynamic = "force-dynamic";

export default async function InstallKitsPage() {
  const session = await requirePermissionOrRedirect(INSTALL_KIT_MENU, "read", ["manager"]);
  const [kits, permission] = await Promise.all([
    listInstallKits(),
    permissionFor(session, INSTALL_KIT_MENU),
  ]);

  return (
    <div className="w-full space-y-4 pb-10">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-bold text-slate-700">
          <Boxes className="size-5 text-brand-700" /> ຊຸດອາໄຫຼ່ມາດຕະຖານງານຕິດຕັ້ງ
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          ອາໄຫຼ່ທີ່ລະບົບໃສ່ໃຫ້ອັດຕະໂນມັດຕອນເປີດໃບງານ ແບ່ງຕາມ<b> ຂະໜາດ BTU </b>ຂອງແອ
          (<span className="font-mono text-xs">ods.used_spare_install</span>) —
          ແກ້ຢູ່ນີ້ມີຜົນກັບ<b> ງານທີ່ເປີດໃໝ່ </b>ເທົ່ານັ້ນ, ງານທີ່ເປີດໄປແລ້ວບໍ່ຖືກແຕະ.
        </p>
      </div>

      <InstallKitManager
        kits={kits}
        can={{
          create: permission.read && permission.create,
          update: permission.read && permission.update,
          delete: permission.read && permission.delete,
        }}
      />
    </div>
  );
}
