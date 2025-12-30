export async function apiClient<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(endpoint, {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const fallback = { message: "An error occurred" };
    const error = await response.json().catch(() => fallback);
    const message =
      error.message || error.error || response.statusText || fallback.message;
    throw new Error(message);
  }

  return response.json();
}
