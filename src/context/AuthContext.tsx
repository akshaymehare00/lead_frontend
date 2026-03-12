import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { api, setToken } from "@/lib/api";

export interface User {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
}

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = "lead-compass-user";

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored) as User;
      }
    } catch {
      /* ignore */
    }
    return null;
  });

  const login = useCallback(async (email: string, password: string) => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      return { success: false, error: "Email and password are required" };
    }

    try {
      const res = await api.auth.login(trimmedEmail, trimmedPassword);
      setToken(res.token);
      const userData: User = {
        id: res.user.id,
        email: res.user.email,
        name: res.user.name,
        isAdmin: res.user.role === "ADMIN",
      };
      setUser(userData);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Login failed",
      };
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  useEffect(() => {
    const handleSessionExpired = () => logout();
    window.addEventListener("auth:session-expired", handleSessionExpired);
    return () => window.removeEventListener("auth:session-expired", handleSessionExpired);
  }, [logout]);

  const value: AuthContextValue = {
    user,
    isAuthenticated: !!user,
    isAdmin: user?.isAdmin ?? false,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { AuthProvider, useAuth };
