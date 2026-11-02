"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./client";

export interface ReloadOptions {
  /** true 时不切换 loading 状态（用于轮询刷新），避免界面被骨架屏反复替换造成闪烁 */
  silent?: boolean;
}

export function useFetch<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (opts?: ReloadOptions) => {
      if (!url) return;
      const silent = opts?.silent === true;
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        setData(await api.get<T>(url));
      } catch (e) {
        // 静默刷新失败时不覆盖已有数据，也不弹错误，等待下一次轮询
        if (!silent) setError(e instanceof Error ? e.message : "加载失败");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [url]
  );

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, reload: load };
}
