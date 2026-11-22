
import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

const API_URL = "http://localhost:5000/api";

export default function AdminProtectedRoute() {
  const location = useLocation();

  const [authenticated, setAuthenticated] = useState<
    boolean | null
  >(null);

  useEffect(() => {
    let active = true;

    const verifySession = async () => {
      try {
        const response = await fetch(
          `${API_URL}/admin/auth/me`,
          {
            method: "GET",
            credentials: "include",
          }
        );

        if (!response.ok) {
          if (active) setAuthenticated(false);
          return;
        }

        const data = await response.json();

        if (active) {
          setAuthenticated(data.authenticated === true);
        }
      } catch (error) {
        console.error(
          "Admin session verification failed:",
          error
        );

        if (active) setAuthenticated(false);
      }
    };

    verifySession();

    return () => {
      active = false;
    };
  }, []);

  if (authenticated === null) {
    return (
      <div className="admin-auth-loading">
        Verifying admin access...
      </div>
    );
  }

  if (!authenticated) {
    return (
      <Navigate
        to="/admin/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  return <Outlet />;
}
