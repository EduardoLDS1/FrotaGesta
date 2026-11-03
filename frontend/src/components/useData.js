import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../services/api";
export function useData(path) {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const reload = useCallback(async () => {
    const n = ++seq.current;
    setLoading(true);
    setError("");
    try {
      const result = await api(path);
      if (seq.current === n) setData(result);
    } catch (e) {
      if (seq.current === n) setError(e.message);
    } finally {
      if (seq.current === n) setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    const ref = seq;
    reload();
    return () => {
      ref.current++;
    };
  }, [reload]);
  return { data, error, loading, reload };
}
