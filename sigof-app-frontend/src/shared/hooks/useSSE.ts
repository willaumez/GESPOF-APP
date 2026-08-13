import { useState, useCallback, useRef, useEffect } from 'react';

interface ProgressEvent<T = Record<string, unknown>> {
  type: 'progress';
  step: number;
  label: string;
  data: T | null;
  details: string | null;
}

interface CompleteEvent<T = Record<string, unknown>> {
  type: 'complete';
  date: string;
  fiche_depense: T;
  details: {
    nb_lignes: number;
    nb_reglements: number;
    total_systac: number;
    total_groupe: number;
  };
}

interface ErrorEvent {
  type: 'error';
  message: string;
  trace?: string;
}

type SSEEvent<T = Record<string, unknown>> = ProgressEvent<T> | CompleteEvent<T> | ErrorEvent;

interface SSECallbacks<T = Record<string, unknown>> {
  onProgress?: (step: number, label: string, data: T | null, details: string | null) => void;
  onComplete?: (data: CompleteEvent<T>) => void;
  onError?: (error: string) => void;
}

interface SSEState {
  isConnecting: boolean;
  isConnected: boolean;
  error: string | null;
}

interface SSERequestBody {
  date: string;
  [key: string]: unknown;
}

function parseSSEEvent<T = Record<string, unknown>>(data: string): SSEEvent<T> | null {
  try {
    return JSON.parse(data) as SSEEvent<T>;
  } catch {
    return null;
  }
}

export function useSSE<T = Record<string, unknown>>() {
  const [state, setState] = useState<SSEState>({
    isConnecting: false,
    isConnected: false,
    error: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const connect = useCallback(
    async (
      url: string,
      body: SSERequestBody,
      callbacks: SSECallbacks<T> = {}
    ): Promise<void> => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setState({ isConnecting: true, isConnected: false, error: null });

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          body: JSON.stringify(body),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        if (!response.body) {
          throw new Error('Response body is null');
        }

        setState({ isConnecting: false, isConnected: true, error: null });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            setState((prev) => ({ ...prev, isConnected: false }));
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const event = parseSSEEvent<T>(line.slice(6));

              if (!event) {
                console.warn('Invalid SSE event:', line);
                continue;
              }

              switch (event.type) {
                case 'progress':
                  callbacks.onProgress?.(
                    event.step,
                    event.label,
                    event.data,
                    event.details
                  );
                  break;

                case 'complete':
                  callbacks.onComplete?.(event);
                  setState((prev) => ({ ...prev, isConnected: false }));
                  return;

                case 'error':
                  callbacks.onError?.(event.message);
                  setState((prev) => ({
                    ...prev,
                    isConnected: false,
                    error: event.message,
                  }));
                  return;

                default:
                  { const _exhaustiveCheck: never = event;
                  console.warn('Unknown SSE event type:', _exhaustiveCheck); }
              }
            }
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          setState((prev) => ({
            ...prev,
            isConnecting: false,
            isConnected: false,
          }));
          return;
        }

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setState({
          isConnecting: false,
          isConnected: false,
          error: errorMessage,
        });
        callbacks.onError?.(errorMessage);
      }
    },
    []
  );

  const disconnect = useCallback((): void => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setState({ isConnecting: false, isConnected: false, error: null });
  }, []);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    ...state,
    connect,
    disconnect,
  };
}