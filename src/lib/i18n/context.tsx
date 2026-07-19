"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { Dictionary } from "./dictionaries";

/**
 * Client-side dictionary — ໃຫ້ client component ອ່ານຄຳແປໄດ້ໂດຍບໍ່ຕ້ອງສົ່ງ prop ຜ່ານຫຼາຍຊັ້ນ.
 *
 * Server component ຍັງໃຊ້ getDictionary() ຕາມເກົ່າ. dict ຖືກ seed ຄັ້ງດຽວທີ່ (app)/layout
 * ຈາກ dict ທີ່ດຶງມາຢູ່ແລ້ວ — client bundle ໄດ້ພາສາດຽວ (ຕາມ cookie) ບໍ່ໄດ້ທັງສາມ.
 */
const DictContext = createContext<Dictionary | null>(null);

export function DictProvider({ dict, children }: { dict: Dictionary; children: ReactNode }) {
  return <DictContext.Provider value={dict}>{children}</DictContext.Provider>;
}

/** ອ່ານ dictionary ເຕັມໃນ client component. ຕ້ອງຢູ່ພາຍໃນ <DictProvider>. */
export function useDict(): Dictionary {
  const dict = useContext(DictContext);
  if (!dict) throw new Error("useDict must be used within DictProvider");
  return dict;
}
