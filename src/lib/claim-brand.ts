import { query } from "@/lib/db";

/** ຕັ້ງຄ່າ ຫຍີ່ຫໍ້ → supplier ທີ່ເກັບເງินค่าสอม (auto candidate CLM-C ຫຼັງສ່ງคืน). */
export type BrandClaim = { brand_code: string; supplier_code: string | null; active: boolean; note: string | null };

export async function listBrandClaims(): Promise<BrandClaim[]> {
  return (await query<BrandClaim>(`select brand_code, supplier_code, active, note from ods_claim_brand order by brand_code`)).rows;
}
