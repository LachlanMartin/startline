"use client";

import { createContext, useContext, useEffect, useState, useCallback, startTransition } from "react";
import { fetchAuthSession, getCurrentUser, signOut } from "aws-amplify/auth";

export type Role = "user" | "organiser" | "admin";

export type AuthUser = {
  sub:   string;
  email: string;
};

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  user:         AuthUser | null;
  role:         Role | null;
  hasOrganiser: boolean;
  status:       AuthStatus;
  loading:      boolean;
  refresh:      () => Promise<void>;
  logout:       () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user:         null,
  role:         null,
  hasOrganiser: false,
  status:       "loading",
  loading:      true,
  refresh:      async () => {},
  logout:       async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,         setUser]         = useState<AuthUser | null>(null);
  const [role,         setRole]         = useState<Role | null>(null);
  const [hasOrganiser, setHasOrganiser] = useState(false);
  const [status,       setStatus]       = useState<AuthStatus>("loading");

  const hydrate = useCallback(async () => {
    if (process.env.NODE_ENV === "development" && typeof document !== "undefined" && document.cookie.includes("__e2e_bypass=1")) {
      setUser({ sub: "dev-bypass", email: "bypass@startline.test" });
      setStatus("authenticated");
      return;
    }

    try {
      const session = await fetchAuthSession();
      if (!session.tokens?.accessToken) {
        setUser(null);
        setStatus("unauthenticated");
        return;
      }

      const current = await getCurrentUser();
      const idPayload = session.tokens.idToken?.payload;
      const loginId = current.signInDetails?.loginId ?? "";
      const email =
        (typeof idPayload?.email === "string" && idPayload.email.includes("@")
          ? idPayload.email
          : loginId.includes("@")
            ? loginId
            : "");

      setUser({
        sub:   current.userId,
        email,
      });
      setStatus("authenticated");
    } catch {
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    startTransition(() => hydrate());
  }, [hydrate]);

  // Fetch role when auth status changes
  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    fetch("/api/user/role")
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (!cancelled && data?.role) {
          setRole(data.role);
          setHasOrganiser(Boolean(data.hasOrganiser));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [status]);

  const logout = useCallback(async () => {
    await signOut();
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  return (
      <AuthContext.Provider
        value={{
          user,
          role,
          hasOrganiser,
          status,
          loading: status === "loading",
          refresh: hydrate,
          logout,
        }}
      >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  return useContext(AuthContext);
}
