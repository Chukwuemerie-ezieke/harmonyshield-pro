import { MutationCache, QueryClient, QueryFunction } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { getAuthToken, handleUnauthorized } from "./auth";

function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Throws an Error whose message is the server's `message` field (or status text). */
async function throwIfResNotOk(res: Response) {
  if (res.ok) return;
  if (res.status === 401 && getAuthToken()) handleUnauthorized();
  let message = res.statusText;
  try {
    const data = (await res.clone().json()) as { message?: string };
    if (data?.message) message = data.message;
  } catch {
    message = (await res.text()) || res.statusText;
  }
  const err = new Error(message) as Error & { status?: number };
  err.status = res.status;
  throw err;
}

export async function apiRequest(method: string, url: string, data?: unknown): Promise<Response> {
  const headers: Record<string, string> = { ...getAuthHeaders() };
  if (data !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(url, {
    method,
    headers,
    body: data !== undefined ? JSON.stringify(data) : undefined,
  });
  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export function getQueryFn<T>({ on401 }: { on401: UnauthorizedBehavior }): QueryFunction<T> {
  return async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/"), { headers: getAuthHeaders() });
    if (on401 === "returnNull" && res.status === 401) return null as T;
    await throwIfResNotOk(res);
    return (await res.json()) as T;
  };
}

export const queryClient = new QueryClient({
  // Fallback error toast for mutations that don't handle errors themselves.
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => {
      if (mutation.options.onError) return;
      toast({ title: "Something went wrong", description: (error as Error).message, variant: "destructive" });
    },
  }),
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 60_000,
      retry: false,
    },
    mutations: { retry: false },
  },
});
