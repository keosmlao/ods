import { claimDailySummary } from "@/lib/claim";
import { query } from "@/lib/db";
import { reportLabel } from "@/lib/report-meta";
import { NOT_MISSING, OPEN_JOBS, stageLabel, STAGE_SQL } from "@/lib/stage";

/** ສ້າງ text ຂອງ report ໜຶ່ງ (ໃຫ້ cron ສົ່ງ email/Line). null = ບໍ່ຮู้จัก key. */
export async function buildReport(key: string): Promise<string | null> {
  const head = `📊 ${reportLabel(key)}`;
  switch (key) {
    case "daily-receipts": {
      const n = (await query<{ n: number }>(`select count(*)::int n from tb_product where time_register::date = current_date`)).rows[0]?.n ?? 0;
      return `${head}\n• ຮັບເຄື່ອງສ້ອມ ມື້ນີ້: ${n} ໃບ`;
    }
    case "daily-installs": {
      const n = (await query<{ n: number }>(`select count(*)::int n from ods_tb_install where appoint_date::date = current_date`)).rows[0]?.n ?? 0;
      return `${head}\n• ນັດຕິດຕັ້ງ ມື້ນີ້: ${n} ໃບ`;
    }
    case "pending-status": {
      const rows = (await query<{ stage: number; service_type: string | null; n: number }>(
        `select (${STAGE_SQL}) stage, null::text service_type, count(*)::int n from tb_product a
          where ${OPEN_JOBS} and ${NOT_MISSING} group by 1 order by 1`,
      )).rows;
      const total = rows.reduce((s, r) => s + r.n, 0);
      const lines = rows.map((r) => `• ${stageLabel(r.stage, r.service_type)}: ${r.n}`);
      return `${head} (ລວມ ${total})\n${lines.join("\n")}`;
    }
    case "purchase-3d": {
      const n = (await query<{ n: number }>(
        `select count(*)::int n from tb_product a
          where ${OPEN_JOBS} and coalesce(a.used_spare,0)=1 and a.spare_order is not null
            and a.spare_arrive is null and a.spare_order < now() - interval '3 days'`,
      )).rows[0]?.n ?? 0;
      return `${head}\n• ສັ່ງຊື້ອາໄຫຼ່ ເກີນ 3 ວັນ ຍັງບໍ່ມາ: ${n} ລາຍການ`;
    }
    case "supplier-debt": {
      // TODO ຕ້ອງ map ERP AP (ໃບຊື້ຄ້າງຊຳລະ) — ຄືກັນກັບ COB ຕ້ອງบัญชียืนยัน trans_flag/ยอด
      return `${head}\n• (ລໍເຊື່ອມ ERP AP — ຍັງບໍ່ config)`;
    }
    case "claim-money": {
      const s = await claimDailySummary();
      return `${head}\n• ເງินรอรับจาก supplier: ${s.pendingMoney.toLocaleString()}\n• CLM-C ເປີດຢູ່: ${s.openC} · ລໍເປີດ: ${s.candidates}`;
    }
    default:
      return null;
  }
}
