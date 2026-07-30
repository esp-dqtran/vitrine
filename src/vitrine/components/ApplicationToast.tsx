import { Icon } from '@astryxdesign/core';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type ShowApplicationToast = (message: string) => void;

const ApplicationToastContext = createContext<ShowApplicationToast>(() => undefined);

interface ApplicationToastProviderProps {
  children: ReactNode;
}

export function ApplicationToastProvider({
  children,
}: ApplicationToastProviderProps) {
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);

  const showToast = useCallback<ShowApplicationToast>((message) => {
    setToast((current) => ({
      id: (current?.id ?? 0) + 1,
      message,
    }));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const value = useMemo(() => showToast, [showToast]);

  return (
    <ApplicationToastContext.Provider value={value}>
      {children}
      {toast ? (
        <div
          key={toast.id}
          className="screen-action-toast"
          role="status"
          aria-live="polite"
        >
          <Icon icon="success" size="sm" />
          <strong>{toast.message}</strong>
        </div>
      ) : null}
    </ApplicationToastContext.Provider>
  );
}

export function useApplicationToast() {
  return useContext(ApplicationToastContext);
}
