import { auth } from "../firebase";

const BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://10.76.157.23:5000/api/v1";

// Calls the Vhite Pizza API. If a user is logged in, their Firebase token is
// sent so the server knows who is asking.
export async function apiFetch(path, { method = "GET", body, signal } = {}) {
  const headers = { "Content-Type": "application/json" };
  const user = auth.currentUser;

  if (user) headers.Authorization = `Bearer ${await user.getIdToken()}`;

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    signal,
    body: body ? JSON.stringify(body) : undefined,
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) throw new Error(result.message || "Request failed.");

  return result.data ?? result;
}
