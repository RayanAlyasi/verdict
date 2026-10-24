// The fetch behind the generated client in lib/api. Server code calls the api directly at API_URL;
// the browser uses relative paths, which reach the api on the same domain.
export async function apiFetch<T>(path: string, options: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl()}${path}`, options);
  const body = [204, 205, 304].includes(response.status) ? null : await response.text();
  return {
    data: body ? JSON.parse(body) : {},
    status: response.status,
    headers: response.headers,
  } as T;
}

function baseUrl(): string {
  if (typeof window !== "undefined") return "";
  const url = process.env.API_URL;
  if (!url) throw new Error("API_URL isn't set, so the web server can't reach the api.");
  return url;
}
