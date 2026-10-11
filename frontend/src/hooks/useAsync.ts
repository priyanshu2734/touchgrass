import { useCallback, useEffect, useRef, useState } from 'react';

interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

/** Runs an async loader on mount and whenever `deps` change. Ignores stale responses. */
export function useAsync<T>(loader: () => Promise<T>, deps: ReadonlyArray<unknown> = []) {
  const [state, setState] = useState<AsyncState<T>>({ data: null, error: null, loading: true });
  const callId = useRef(0);

  const run = useCallback(() => {
    callId.current += 1;
    const id = callId.current;
    setState((previous) => ({ ...previous, loading: true, error: null }));
    loader()
      .then((data) => {
        if (id === callId.current) setState({ data, error: null, loading: false });
      })
      .catch((error: unknown) => {
        if (id === callId.current) {
          setState({
            data: null,
            error: error instanceof Error ? error.message : 'Something went wrong. Please try again.',
            loading: false,
          });
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
    return () => {
      callId.current += 1;
    };
  }, [run]);

  return { ...state, reload: run, setData: (data: T) => setState({ data, error: null, loading: false }) };
}
