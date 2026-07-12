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
