import { ReportShell, reportState } from "@/components/report-shell";
import { activityByPerson, activityFeed } from "@/lib/daily-activity";
import { one, safeDate, todayIso, type SearchParams } from "@/lib/report-sql";

/**
 * **ສະຫຼຸບການເຄື່ອນໄຫວປະຈຳວັນ** — ໃຜເຮັດຫຍັງ ກັບໃບໃດ ເວລາໃດ ໃນມື້ນັ້ນ.
 *
 * ຂໍ້ມູນມາຈາກ chatter (`ods_chatter_message`) ບ່ອນດຽວ ⇒ ລວມທັງ
 * log ທີ່ລະບົບຂຽນເອງຕອນວຽກຂ້າມຂັ້ນ ແລະ ຂໍ້ຄວາມທີ່ຄົນພິມ (ລວມຊ່າງພິມຈາກແອັບ).
 *
 * ຄ່າຕັ້ງຕົ້ນ = **ວັນນີ້**. ຂະຫຍາຍຊ່ວງວັນທີ່ເພື່ອເບິ່ງຫຼາຍມື້.
 */
export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  comment: "ຂໍ້ຄວາມ",
  log: "ລະບົບບັນທຶກ",
};

const columns = [
  { key: "at", label: "ວັນທີ" },
  { key: "time", label: "ເວລາ" },
  { key: "author", label: "ຜູ້ເຮັດ" },
  { key: "kind", label: "ປະເພດ" },
  { key: "doc", label: "ເອກະສານ" },
  { key: "body", label: "ລາຍລະອຽດ" },
];

export default async function DailyActivityReport({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const today = todayIso();
  const from = safeDate(one(params.from), today);
  const to = safeDate(one(params.to), today);
  const state = reportState(params);

  let feed: Awaited<ReturnType<typeof activityFeed>> = [];
  let people: Awaited<ReturnType<typeof activityByPerson>> = [];
  let error: string | null = null;
  try {
    [feed, people] = await Promise.all([activityFeed(from, to), activityByPerson(from, to)]);
  } catch (exception) {
    error = exception instanceof Error ? exception.message : "ໂຫຼດຂໍ້ມູນບໍ່ສຳເລັດ";
  }

  const rows = feed.map((row) => ({
    at: row.at,
    time: row.time,
    author: row.author,
    kind: KIND_LABEL[row.kind] ?? row.kind,
    doc: `${row.doc} #${row.res_id}`,
    body: row.body,
  }));

  const comments = feed.filter((row) => row.kind === "comment").length;
  const documents = new Set(feed.map((row) => `${row.model}:${row.res_id}`)).size;
  const busiest = people[0];

  return (
    <ReportShell
      title="ສະຫຼຸບການເຄື່ອນໄຫວປະຈຳວັນ"
      subtitle={
        from === to
          ? `ວັນທີ ${from} · ${feed.length} ການເຄື່ອນໄຫວ`
          : `${from} ຫາ ${to} · ${feed.length} ການເຄື່ອນໄຫວ`
      }
      basePath="/reports/daily-activity"
      query={{ from, to }}
      state={state}
      dateRange={{ from, to }}
      columns={columns}
      rows={rows}
      error={error}
      summary={[
        { label: "ການເຄື່ອນໄຫວ", value: feed.length.toLocaleString() },
        { label: "ຂໍ້ຄວາມທີ່ຄົນພິມ", value: comments.toLocaleString() },
        { label: "ໃບງານທີ່ຖືກແຕະ", value: documents.toLocaleString() },
        { label: "ຄົນເຄື່ອນໄຫວ", value: people.length.toLocaleString() },
        {
          label: "ເຄື່ອນໄຫວຫຼາຍສຸດ",
          value: busiest ? `${busiest.author} (${busiest.total})` : "-",
        },
      ]}
      minWidth={900}
      searchPlaceholder="ຄົ້ນຫາ ຜູ້ເຮັດ, ເອກະສານ, ລາຍລະອຽດ..."
    />
  );
}
