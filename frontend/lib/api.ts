const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("tzero_token");
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.body && !(options.body instanceof FormData)
      ? { "Content-Type": "application/json" }
      : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string>),
  };

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Request failed");
  }
  return res.json() as Promise<T>;
}

// ── Auth ────────────────────────────────────────────────────────────────────
export function login(email: string, password: string) {
  return request<{ access_token: string; token_type: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

// ── Assets ──────────────────────────────────────────────────────────────────
export interface AssetOut {
  id: number;
  name: string;
  ticker: string;
  asset_type: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export function getAssets() {
  return request<AssetOut[]>("/assets");
}

export function createAsset(data: {
  name: string;
  ticker: string;
  asset_type: string;
}) {
  return request<AssetOut>("/assets", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getAsset(id: number) {
  return request<AssetOut>(`/assets/${id}`);
}

export function getAssetStatus(id: number) {
  return request<{ id: number; status: string }>(`/assets/${id}/status`);
}

export function uploadPdf(id: number, file: File) {
  const form = new FormData();
  form.append("file", file);
  return request<{ message: string }>(`/assets/${id}/upload`, {
    method: "POST",
    body: form,
  });
}

export function submitAsset(id: number) {
  return request<{ message: string }>(`/assets/${id}/submit`, {
    method: "POST",
  });
}

export function withdrawAsset(id: number) {
  return request<{ message: string }>(`/assets/${id}`, { method: "DELETE" });
}

// ── Extractions ──────────────────────────────────────────────────────────────
export interface FieldOut {
  id: number;
  field_key: string;
  section: string;
  display_label: string;
  display_value: string;
  confidence: string;
  confirmed: boolean;
  source_quote: string | null;
  notes: string | null;
}

export interface ExtractionOut {
  run_id: number;
  status: string;
  fields: Record<string, FieldOut[]>;
  compliance_flags: string[];
  counts: { total: number; confirmed: number; low: number };
}

export function getExtraction(assetId: number) {
  return request<ExtractionOut>(`/assets/${assetId}/extraction`);
}

export function overrideField(fieldId: number, value: string, reason: string) {
  return request<FieldOut>(`/extractions/fields/${fieldId}`, {
    method: "PATCH",
    body: JSON.stringify({ new_value: value, reason }),
  });
}

export function confirmField(fieldId: number) {
  return request<FieldOut>(`/extractions/fields/${fieldId}/confirm`, {
    method: "POST",
  });
}

// ── Compliance ───────────────────────────────────────────────────────────────
export interface ComplianceItem {
  id: number;
  asset_id: number;
  asset_name: string;
  review_type: string;
  status: string;
  created_at: string;
}

export interface ComplianceDetail extends ComplianceItem {
  fields?: Record<string, FieldOut[]>;
  compliance_flags?: string[];
  contract?: GeneratedContractOut;
}

export function getComplianceQueue() {
  return request<ComplianceItem[]>("/compliance/queue");
}

export function getComplianceItem(id: number) {
  return request<ComplianceDetail>(`/compliance/${id}`);
}

export function submitComplianceDecision(
  id: number,
  decision: "approved" | "rejected",
  notes: string
) {
  return request<{ message: string }>(`/compliance/${id}/decision`, {
    method: "POST",
    body: JSON.stringify({ decision, notes }),
  });
}

// ── Contracts ────────────────────────────────────────────────────────────────
export interface GeneratedContractOut {
  id: number;
  template_used: string;
  solidity_source: string;
  human_summary: string;
  intermediary_approved: boolean;
  reviewer_approved: boolean;
  created_at: string;
}

export function getContract(assetId: number) {
  return request<GeneratedContractOut>(`/assets/${assetId}/contract`);
}

export function approveContract(assetId: number, role: string) {
  return request<{ message: string }>(`/assets/${assetId}/contract/approve`, {
    method: "POST",
    body: JSON.stringify({ role }),
  });
}

// ── Deployments ───────────────────────────────────────────────────────────────
export interface DeploymentOut {
  id: number;
  network: string;
  contract_address: string | null;
  tx_hash: string | null;
  status: string;
  error_message: string | null;
  deployed_at: string | null;
}

export interface AuditEventOut {
  id: number;
  event_type: string;
  actor: string | null;
  description: string;
  created_at: string;
}

export function getDeployment(assetId: number) {
  return request<DeploymentOut>(`/assets/${assetId}/deployment`);
}

export function getAuditLog(assetId: number) {
  return request<AuditEventOut[]>(`/assets/${assetId}/audit`);
}
