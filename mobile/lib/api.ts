import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

/**
 * ຕົວເຊື່ອມກັບ ODSS — ທຸກຄຳຂໍຜ່ານບ່ອນນີ້ບ່ອນດຽວ.
 *
 * ⚠️ ແອັບ **ບໍ່ຄິດຂັ້ນຕອນເອງ** ເລີຍ: server ສົ່ງ `action` ມາໃຫ້ (ເບິ່ງ lib/mobile-jobs.ts
 * ຢູ່ຝັ່ງເວັບ) ວ່າຊ່າງກົດຫຍັງໄດ້ດຽວນີ້. ຖ້າແອັບຄິດເອງ ມື້ທີ່ຂັ້ນໄດປ່ຽນ ແອັບເກົ່າ
 * ທີ່ຄ້າງຢູ່ໃນມືຖືຊ່າງຈະພາວຽກໄປຜິດຂັ້ນ ໂດຍທີ່ອັບເດດແອັບບໍ່ທັນ.
 */

const BASE = (Constants.expoConfig?.extra?.apiUrl as string) ?? "http://localhost:3000";
const TOKEN_KEY = "odss_token";

export async function saveToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}
export async function getToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}
export async function clearToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export type ApiError = { error: string; status: number };

async function request<T>(path: string, init?: RequestInit & { auth?: boolean }): Promise<T> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (init?.auth !== false) {
    const token = await getToken();
    if (token) headers.authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE}${path}`, { ...init, headers: { ...headers, ...(init?.headers as object) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error: ApiError = { error: body?.error ?? "ເຊື່ອມຕໍ່ບໍ່ໄດ້", status: response.status };
    throw error;
  }
  return body as T;
}

/* ── ຕົວຕົນ ─────────────────────────────────────────────────────── */

export type MobileUser = { username: string; role: string; role_label: string };

export async function login(username: string, password: string) {
  const result = await request<{ token: string; user: MobileUser }>("/api/mobile/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
    auth: false,
  });
  await saveToken(result.token);
  return result.user;
}

/* ── ວຽກ ────────────────────────────────────────────────────────── */

export type MobileAction = "accept" | "start" | "finish" | "wait_spare" | "wait_other";

export type Job = {
  workflow: "install" | "repair";
  code: string;
  customer: string | null;
  tel: string | null;
  address: string | null;
  product: string | null;
  detail: string | null;
  onsite: boolean;
  stage: number;
  stage_label: string;
  elapsed_seconds: number;
  appointment: string | null;
  action: MobileAction;
  checked_in: boolean;
};

export async function fetchJobs() {
  return (await request<{ jobs: Job[] }>("/api/mobile/jobs")).jobs;
}

export type JobCommand = {
  action: "accept" | "reject" | "start" | "finish" | "checkin" | "checkout";
  reason?: string;
  note?: string;
  lat?: number;
  lng?: number;
  photo?: string;
  /** ຮູບຜົນງານຕອນຈົບງານ — ຕິດຕັ້ງບັງຄັບຢ່າງໜ້ອຍ 1 ຮູບ */
  photos?: string[];
};

export async function sendCommand(job: Pick<Job, "workflow" | "code">, command: JobCommand) {
  return request<{ ok: true; message: string }>(`/api/mobile/jobs/${job.workflow}/${job.code}`, {
    method: "POST",
    body: JSON.stringify(command),
  });
}

/* ── ລາຍຮັບ ─────────────────────────────────────────────────────── */

export type Income = {
  linked: boolean;
  jobs: number;
  total_thb: number;
  rows: { job_code: string; workflow: string; role: string; pay_thb: number; closed_at: string }[];
};

export async function fetchIncome() {
  return request<Income>("/api/mobile/income");
}

/* ── ແຈ້ງເຕືອນ ──────────────────────────────────────────────────── */

export async function registerPushToken(token: string, platform: string) {
  return request<{ ok: true }>("/api/mobile/push-token", {
    method: "POST",
    body: JSON.stringify({ token, platform }),
  });
}

/* ── ກວດເຊັກ (ຝັ່ງສ້ອມ) ─────────────────────────────────────────── */

export type DraftLine = { roworder: number; item_code: string; item_name: string | null; qty: number; unit_code: string | null };
export type SpareItem = { code: string; name_1: string; brand: string | null; unit_code: string | null; balance_qty: number };

export async function fetchDraft(code: string) {
  return (await request<{ draft: DraftLine[] }>(`/api/mobile/check/${code}`)).draft;
}

export async function searchSpares(q: string, inStockOnly = false) {
  const params = new URLSearchParams({ q, ...(inStockOnly ? { in_stock: "1" } : {}) });
  return (await request<{ items: SpareItem[] }>(`/api/mobile/spares?${params}`)).items;
}

type CheckCommand =
  | { action: "start" }
  | { action: "add_spare"; item: { code: string; name_1: string; unit_code: string | null }; qty: number }
  | { action: "remove_spare"; roworder: number }
  | { action: "save"; diagnosis: string; warranty_void: boolean; warranty_reason: string; use_spare: boolean };

export async function sendCheck(code: string, command: CheckCommand) {
  return request<{ ok: true; message: string }>(`/api/mobile/check/${code}`, {
    method: "POST",
    body: JSON.stringify(command),
  });
}

/* ── ອາໄຫຼ່: ຂໍເບີກ ແລະ ກົດຮັບ ──────────────────────────────────── */

export type PickupDoc = { doc_no: string; job_code: string; doc_date: string; lines: number };

export async function fetchPickups() {
  return (await request<{ docs: PickupDoc[] }>("/api/mobile/spares?queue=pickup")).docs;
}

export async function fetchLookups() {
  return request<{
    warehouses: { code: string; name: string }[];
    shelves: { code: string; name: string; wh_code: string }[];
  }>("/api/mobile/lookups");
}

export async function requestSpares(code: string, wh_code: string, shelf_code: string, remark = "") {
  return request<{ ok: true; message: string }>("/api/mobile/spare-request", {
    method: "POST",
    body: JSON.stringify({ action: "request", code, wh_code, shelf_code, remark }),
  });
}

export async function pickupSpares(doc_ref: string, remark = "") {
  return request<{ ok: true; message: string }>("/api/mobile/spare-request", {
    method: "POST",
    body: JSON.stringify({ action: "pickup", doc_ref, remark }),
  });
}

/* ── QC (ຫົວໜ້າຊ່າງ / CS) ──────────────────────────────────────── */

export type QcItem = {
  id: number;
  name: string;
  require_photo: boolean;
  passed: boolean | null;
  note: string | null;
  photo: string | null;
};

export type QcJob = {
  workflow: "install" | "repair";
  code: string;
  customer: string | null;
  item: string | null;
  worker: string | null;
  finished_at: string | null;
  elapsed_seconds: number;
};

export async function fetchQcQueue() {
  return (await request<{ jobs: QcJob[] }>("/api/mobile/qc")).jobs;
}

export async function fetchQcJob(workflow: string, code: string) {
  return request<{ items: QcItem[]; photos: { id: number; photo: string; created_by: string; created_at: string }[] }>(
    `/api/mobile/qc?workflow=${workflow}&code=${code}`,
  );
}

export async function saveQc(
  workflow: string,
  code: string,
  answers: { item_id: number; passed: boolean; note: string; photo: string }[],
  signer_name = "",
) {
  return request<{ ok: true; message: string }>("/api/mobile/qc", {
    method: "POST",
    body: JSON.stringify({ workflow, code, answers, signer_name }),
  });
}
