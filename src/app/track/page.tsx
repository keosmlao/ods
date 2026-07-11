import { Search } from "lucide-react";
import Link from "next/link";
import { TrackStatus } from "@/components/track-status";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { isSearchable, jobByCode, jobsBySn, type TrackJob } from "@/lib/track";

/**
 * ຄົ້ນຫາເອງ (ພິມເລກທີໃບຮັບເຄື່ອງ ຫຼື SN) — ໜ້າສາທາລະນະ.
 * ຄົ້ນດ້ວຍ code ກ່ອນ (index idx_tb_product_code) ຖ້າບໍ່ພົບຈຶ່ງຄົ້ນດ້ວຍ sn (idx_tb_product_sn).
 */
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ q?: string }> };

export default async function TrackSearchPage({ searchParams }: Props) {
  const q = ((await searchParams).q ?? "").trim();

  let jobs: TrackJob[] = [];
  let message = "";
  if (q) {
    if (!isSearchable(q)) {
      message = "ກະລຸນາປ້ອນເລກທີໃບຮັບເຄື່ອງ ຫຼື Serial Number ໃຫ້ຄົບ";
    } else if (!rateLimit(`track:${await clientIp()}`, 30, 60_000)) {
      message = "ຄົ້ນຫາຫຼາຍຄັ້ງເກີນໄປ — ກະລຸນາລອງໃໝ່ໃນອີກ 1 ນາທີ";
    } else {
      const byCode = await jobByCode(q);
      jobs = byCode ? [byCode] : await jobsBySn(q);
      if (jobs.length === 0) message = "ບໍ່ພົບຂໍ້ມູນ — ກະລຸນາກວດເລກທີ ຫຼື Serial Number ອີກຄັ້ງ";
    }
  }

  return (
    <div className="space-y-4">
      <form className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <label htmlFor="q" className="mb-1.5 block text-xs font-medium text-slate-600">
          ເລກທີໃບຮັບເຄື່ອງ ຫຼື Serial Number
        </label>
        <div className="flex gap-2">
          <div className="flex h-11 flex-1 items-center gap-2 rounded-lg border border-slate-300 px-3">
            <Search className="size-4 shrink-0 text-slate-400" />
            <input
              id="q"
              name="q"
              defaultValue={q}
              required
              autoComplete="off"
              placeholder="ຕົວຢ່າງ: 7476"
              className="w-full text-sm outline-none"
            />
          </div>
          <button className="h-11 rounded-lg bg-[#0536a9] px-5 text-sm font-semibold text-white">ຄົ້ນຫາ</button>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">ເລກທີຢູ່ເທິງໃບຮັບເຄື່ອງ ຫຼື ສະແກນ QR ໃນໃບຮັບເຄື່ອງກໍໄດ້</p>
      </form>

      {message && (
        <p className="rounded-xl border border-slate-200 bg-white px-3 py-6 text-center text-xs text-slate-500 shadow-sm">
          {message}
        </p>
      )}

      {jobs.length > 1 && (
        <p className="text-center text-[11px] text-slate-500">ພົບ {jobs.length} ໃບຮັບເຄື່ອງຂອງ SN ນີ້</p>
      )}

      {jobs.map((job) => (
        <Link key={job.code} href={`/track/${encodeURIComponent(job.code)}`} className="block">
          <TrackStatus job={job} />
        </Link>
      ))}
    </div>
  );
}
