import { deleteSpareFromRequest, updateSpareQty } from "@/app/actions/stock";
import { Card, Empty, LinkButton, Table, inputClass } from "@/components/ui";
import { Plus, Trash2 } from "lucide-react";

export type SpareLine = {
  rnum: number;
  item_code: string;
  item_name: string | null;
  qty: string;
  unit_code: string | null;
  roworder: number;
};

/** ຕາຕະລາງ "ອາໄຫຼ່ທີ່ໃຊ້" — ອ່ານຢ່າງດຽວ (ໃຊ້ໃນໜ້າເບີກ/ສົ່ງຄືນ/ເບິ່ງບິນ) */
export function SpareLineTable({ lines }: { lines: Omit<SpareLine, "roworder">[] }) {
  return (
    <Card title="ອາໄຫຼ່ທີ່ໃຊ້">
      {lines.length === 0 ? (
        <Empty />
      ) : (
        <Table head={["#", "ລະຫັດສິນຄ້າ", "ຊື່ສິນຄ້າ", "ຈຳນວນ", "ຫົວໜ່ວຍ"]} minWidth={700}>
          {lines.map((line, index) => (
            <tr key={`${line.item_code}-${index}`} className="border-b border-slate-100">
              <td className="px-3 py-3 text-center">{line.rnum}</td>
              <td className="px-3 py-3">{line.item_code}</td>
              <td className="px-3 py-3">{line.item_name ?? "-"}</td>
              <td className="px-3 py-3 text-center">{Number(line.qty)}</td>
              <td className="px-3 py-3 text-center">{line.unit_code ?? "-"}</td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  );
}

/**
 * ຕາຕະລາງ "ອາໄຫຼ່ທີ່ໃຊ້" ແບບແກ້ໄຂໄດ້ (ໜ້າສ້າງໃບຂໍເບີກ — tb_used_spare).
 * ods ຈື່ roworder ໄວ້ໃນ Flask session — ຢູ່ນີ້ສົ່ງມາທາງ hidden field ແທນ.
 */
export function EditableSpareLines({ lines, roworder }: { lines: SpareLine[]; roworder: string }) {
  return (
    <Card
      title="ອາໄຫຼ່ທີ່ໃຊ້"
      actions={
        <LinkButton href={`/stock/requests/${roworder}/pick`} tone="info">
          <Plus className="size-4" />
          ເລືອກ
        </LinkButton>
      }
    >
      {lines.length === 0 ? (
        <Empty />
      ) : (
        <Table head={["#", "ລະຫັດສິນຄ້າ", "ຊື່ສິນຄ້າ", "ຈຳນວນ", "ຫົວໜ່ວຍ", ""]} minWidth={700}>
          {lines.map((line) => (
            <tr key={line.roworder} className="border-b border-slate-100">
              <td className="px-3 py-3 text-center">{line.rnum}</td>
              <td className="px-3 py-3">{line.item_code}</td>
              <td className="px-3 py-3">{line.item_name ?? "-"}</td>
              <td className="px-3 py-2">
                <form action={updateSpareQty} className="flex justify-center">
                  <input type="hidden" name="roworder" value={roworder} />
                  <input type="hidden" name="row_id" value={line.roworder} />
                  <input
                    type="number"
                    name="reg_qty"
                    min="1"
                    step="any"
                    defaultValue={Number(line.qty)}
                    className={`${inputClass} w-24 text-center`}
                  />
                </form>
              </td>
              <td className="px-3 py-3 text-center">{line.unit_code ?? "-"}</td>
              <td className="px-3 py-3 text-center">
                <form action={deleteSpareFromRequest}>
                  <input type="hidden" name="roworder" value={roworder} />
                  <input type="hidden" name="row_id" value={line.roworder} />
                  <button type="submit" title="ລຶບ" className="text-[#DE3163] hover:opacity-70">
                    <Trash2 className="size-4" />
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </Table>
      )}
      <p className="mt-3 text-xs text-slate-400">ປ່ຽນຈຳນວນແລ້ວກົດ Enter ເພື່ອບັນທຶກ</p>
    </Card>
  );
}
