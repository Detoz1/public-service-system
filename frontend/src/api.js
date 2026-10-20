const API_URL = (
  import.meta.env.VITE_API_URL ||
  `${window.location.protocol}//${window.location.hostname}:8000/api`
).replace(/\/$/, "");
let csrfToken = "";

async function readResponse(response) {
  if (response.status === 204) return null;
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : { detail: await response.text() };

  if (!response.ok) {
    const detail = data.detail || data.non_field_errors?.[0];
    const fieldMessage = Object.entries(data).find(([key]) => key !== "detail")?.[1];
    const message = Array.isArray(detail)
      ? detail.join(" ")
      : detail || (Array.isArray(fieldMessage) ? fieldMessage.join(" ") : fieldMessage);
    const error = new Error(message || `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function prepareCsrf() {
  const data = await readResponse(
    await fetch(`${API_URL}/csrf/`, { credentials: "include" }),
  );
  csrfToken = data.csrfToken;
}

export async function api(path, { method = "GET", body, ...options } = {}) {
  const headers = new Headers(options.headers || {});
  const isUnsafeMethod = !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());

  if (isUnsafeMethod) {
    await prepareCsrf();
  }

  const requestOptions = {
    method,
    credentials: "include",
    headers,
    ...options,
  };
  if (body !== undefined) {
    if (body instanceof FormData) {
      requestOptions.body = body;
    } else {
      headers.set("Content-Type", "application/json");
      requestOptions.body = JSON.stringify(body);
    }
  }
  if (isUnsafeMethod && csrfToken) {
    headers.set("X-CSRFToken", csrfToken);
  }
  return readResponse(await fetch(`${API_URL}${path}`, requestOptions));
}
