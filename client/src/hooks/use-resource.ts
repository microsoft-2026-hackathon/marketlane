import { useEffect, useRef, useState } from "react";
import { isAbortError } from "../api.js";

export interface Resource<T> {
  data: T | null;
  loading: boolean;
  error: unknown;
  reload: () => void;
}

interface Result<T> {
  key: string;
  attempt: number;
  data: T | null;
  error: unknown;
  loading: boolean;
}

export function useResource<T>(
  key: string | null,
  load: (signal: AbortSignal) => Promise<T>,
): Resource<T> {
  const loader = useRef(load);
  loader.current = load;
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result<T> | null>(null);

  useEffect(() => {
    if (key === null) return;
    const controller = new AbortController();
    let active = true;
    const run = loader.current;
    setResult({ key, attempt, data: null, error: null, loading: true });
    void Promise.resolve().then(() => run(controller.signal)).then(
      (data) => {
        if (active) setResult({ key, attempt, data, error: null, loading: false });
      },
      (error: unknown) => {
        if (active && !isAbortError(error)) {
          setResult({ key, attempt, data: null, error, loading: false });
        }
      },
    );
    return () => {
      active = false;
      controller.abort();
    };
  }, [key, attempt]);

  // A changed key invalidates the old result during render, before the next effect runs.
  const current = key !== null && result?.key === key && result.attempt === attempt ? result : null;
  return {
    data: current?.data ?? null,
    loading: key !== null && (current?.loading ?? true),
    error: current?.error ?? null,
    reload: () => setAttempt((value) => value + 1),
  };
}
