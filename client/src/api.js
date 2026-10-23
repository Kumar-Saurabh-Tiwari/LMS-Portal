const API_BASE_URL = import.meta.env.VITE_API_URL ?? "";

export async function apiRequest(path, { token, ...options } = {}) {
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_BASE_URL}/api${path}`, { ...options, headers });
  const payload = response.headers.get("content-type")?.includes("application/json")
    ? await response.json()
    : null;
  if (!response.ok) {
    const error = new Error(payload?.error ?? `Request failed with status ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

export { API_BASE_URL };
