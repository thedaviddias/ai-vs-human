interface ApiErrorPayload {
  error?: string;
}

export async function postJson<TResponse>(url: string, payload: unknown): Promise<TResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const data = (await response.json()) as ApiErrorPayload;
      if (data.error) {
        message = data.error;
      }
    } catch {
      // Keep default message when response body is not JSON.
    }
    throw new Error(message);
  }

  return (await response.json()) as TResponse;
}
