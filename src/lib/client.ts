// 客户端 API 封装

/** 登录/注册页本身不应触发「未登录跳转」，否则注册页会被立刻弹回登录页。 */
function isAuthPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/register" ||
    pathname.startsWith("/register/")
  );
}

function redirectToLogin() {
  if (typeof window !== "undefined" && !isAuthPath(window.location.pathname)) {
    window.location.href = "/login";
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) redirectToLogin();
    const msg = (data as { error?: string })?.error ?? `请求失败 (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

export const api = {
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: "PUT", body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: "PATCH", body: body === undefined ? undefined : JSON.stringify(body) }),
  del: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: "DELETE", body: body === undefined ? undefined : JSON.stringify(body) }),
};

export async function upload<T>(url: string, file: File): Promise<T> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(url, { method: "POST", body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) redirectToLogin();
    throw new Error((data as { error?: string })?.error ?? "上传失败");
  }
  return data as T;
}
