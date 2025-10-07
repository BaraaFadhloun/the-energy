import { API_BASE_URL } from "@/lib/config";
import type { AnalyticsSummary, DatasetDetail, DatasetRecord } from "@/types/analytics";
import type { ChatResponse } from "@/types/chat";

const jsonHeaders = { "Content-Type": "application/json" } as const;

function buildHeaders(accessToken?: string, base: HeadersInit = {}): HeadersInit {
  if (!accessToken) {
    return base;
  }
  return { ...base, Authorization: `Bearer ${accessToken}` };
}

async function handleResponse<T>(response: Response, expectJson = true): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    try {
      const payload = JSON.parse(text);
      if (payload && typeof payload.detail === 'string') {
        throw new Error(payload.detail);
      }
    } catch {
      if (text) {
        throw new Error(text);
      }
    }
    throw new Error(`Request failed with status ${response.status}`);
  }
  if (!expectJson || response.status === 204) {
    return undefined as T;
  }
  if (response.status === 202 || response.headers.get('content-length') === '0') {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export async function fetchAnalyticsSummary(accessToken?: string): Promise<AnalyticsSummary> {
  const res = await fetch(`${API_BASE_URL}/api/analytics/summary`, {
    next: { revalidate: 0 },
    headers: buildHeaders(accessToken),
  });
  return handleResponse<AnalyticsSummary>(res);
}

export async function sendChatMessage(
  prompt: string,
  history: Array<{ role: string; content: string }> = [],
  accessToken?: string,
) {
  const res = await fetch(`${API_BASE_URL}/api/chat`, {
    method: "POST",
    headers: buildHeaders(accessToken, jsonHeaders),
    body: JSON.stringify({ prompt, context: history }),
  });
  return handleResponse<ChatResponse>(res);
}

export async function uploadDataset(file: File, accessToken?: string) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE_URL}/api/upload`, {
    method: "POST",
    body: formData,
    headers: buildHeaders(accessToken),
  });
  return handleResponse<AnalyticsSummary>(res);
}
export async function fetchAnalyticsHistory(limit = 50, accessToken?: string): Promise<DatasetRecord[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  const res = await fetch(`${API_BASE_URL}/api/analytics/history?${params.toString()}`, {
    next: { revalidate: 0 },
    headers: buildHeaders(accessToken),
  });
  return handleResponse<DatasetRecord[]>(res);
}

export async function fetchAnalyticsDataset(id: number, accessToken?: string): Promise<DatasetDetail> {
  const res = await fetch(`${API_BASE_URL}/api/analytics/datasets/${id}`, {
    next: { revalidate: 0 },
    headers: buildHeaders(accessToken),
  });
  return handleResponse<DatasetDetail>(res);
}

export async function deleteDataset(id: number, accessToken?: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/analytics/datasets/${id}`, {
    method: 'DELETE',
    headers: buildHeaders(accessToken),
  });
  await handleResponse<void>(res, false);
}
