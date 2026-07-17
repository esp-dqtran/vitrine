import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  getCurrentUser,
  login as requestLogin,
  logout as requestLogout,
  signup as requestSignup,
  type AuthUser,
} from "./authApi";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  authenticate(email: string, password: string): Promise<AuthUser>;
  register(email: string, password: string): Promise<AuthUser>;
  completeLogin(user: AuthUser): void;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authenticate: requestLogin,
        register: requestSignup,
        completeLogin: setUser,
        logout: async () => {
          await requestLogout();
          setUser(null);
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
