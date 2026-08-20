import { InstallKitManager } from "@/components/manage/install-kit-manager";
import { requirePermissionOrRedirect } from "@/lib/guard";
import {
  INSTALL_KIT_MENU,
  listErpDesigns,
  listErpSizes,
  listInstallKits,
} from "@/lib/install-kit";
import { permissionFor } from "@/lib/permissions";
import { SpareSubstituteManager } from "@/components/manage/spare-substitute-manager";
import { listSubstituteGroups } from "@/lib/spare-substitute";
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
  const [kits, permission, sizes, designs, subGroups] = await Promise.all([
    listInstallKits(),
    permissionFor(session, INSTALL_KIT_MENU),
    // ຂະໜາດ ERP ໃຫ້ຜູກກັບໝວດ — ~489 ແຖວ, dropdown ພິມຄົ້ນໄດ້ (components/select-field)
    listErpSizes(),
    // ຮູບແບບ ERP — 58 ແຖວ, ເລືອກໄດ້ຫຼາຍອັນຕໍ່ໝວດ (checkbox + ຊ່ອງກອງ)
    listErpDesigns(),
    // ກຸ່ມອາໄຫຼ່ທົດແທນກັນ — ໃຊ້ຮ່ວມທຸກໝວດ (ບໍ່ຜູກກັບໝວດໃດ)
    listSubstituteGroups(),
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
        sizes={sizes}
        designs={designs}
        can={{
          create: permission.read && permission.create,
          update: permission.read && permission.update,
          delete: permission.read && permission.delete,
        }}
      />

      {/*
        ── ກຸ່ມທົດແທນ — ວາງທ້າຍໂດຍເຈດຕະນາ ──
        ມັນ**ບໍ່ຜູກກັບໝວດໃດ** (ໃຊ້ຮ່ວມທຸກໝວດ) ⇒ ວາງໄວ້ໃນໝວດໃດໜຶ່ງຈະເຮັດໃຫ້ຄົນເຂົ້າໃຈຜິດ
        ວ່າມີຜົນແຕ່ໝວດນັ້ນ. ໃຊ້ສິດເມນູອັນດຽວກັນ (ເບິ່ງ actions/spare-substitute).
      */}
      <SpareSubstituteManager
        groups={subGroups}
        can={{
          create: permission.read && permission.create,
          update: permission.read && permission.update,
          delete: permission.read && permission.delete,
        }}
      />
    </div>
  );
}
