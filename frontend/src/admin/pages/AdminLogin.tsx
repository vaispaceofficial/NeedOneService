
import { useState } from "react";
import type { FormEvent } from "react";
import {
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import "./AdminLogin.css";

const API_URL = "http://localhost:5000/api";

export default function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();

  const [showPassword, setShowPassword] = useState(false);
  const [adminId, setAdminId] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setError("");

    if (!adminId.trim() || !password.trim()) {
      setError("Please enter your admin ID and password.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        `${API_URL}/admin/auth/login`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            adminId: adminId.trim(),
            password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(
          data.message || "Invalid admin ID or password."
        );
        return;
      }

      // Session is maintained by the HTTP-only cookie.
      // Do not store the authentication token in localStorage.

      const redirectTo =
        (location.state as { from?: string } | null)?.from;

      navigate(
        redirectTo?.startsWith("/admin")
          ? redirectTo
          : "/admin",
        { replace: true }
      );
    } catch (error) {
      console.error("Admin login failed:", error);

      setError(
        "Unable to connect to the server. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-page">

      <div className="admin-login-background">
        <div className="admin-login-glow admin-login-glow-one" />
        <div className="admin-login-glow admin-login-glow-two" />
        <div className="admin-login-grid" />
      </div>

      <header className="admin-login-brand">
        <div className="admin-login-brand-mark">
          N
        </div>

        <div className="admin-login-brand-text">
          <strong>NEED ONE</strong>
          <span>SERVICE LLP</span>
        </div>
      </header>

      <main className="admin-login-main">

        <section className="admin-login-intro">

          <div className="admin-login-eyebrow">
            <span className="admin-login-eyebrow-line" />
            ADMINISTRATIVE ACCESS
          </div>

          <h1>
            Manage your
            <span> service operations.</span>
          </h1>

          <p>
            Access the NEED ONE SERVICE administrative control
            center to manage partners, services, businesses,
            subscriptions and compliance.
          </p>

          <div className="admin-login-features">

            <div className="admin-login-feature">
              <div className="admin-login-feature-icon">
                <ShieldCheck size={19} />
              </div>

              <div>
                <strong>Secure Admin Access</strong>
                <span>
                  Protected access for authorized administrators.
                </span>
              </div>
            </div>

            <div className="admin-login-feature">
              <div className="admin-login-feature-icon">
                <LockKeyhole size={19} />
              </div>

              <div>
                <strong>Operational Control</strong>
                <span>
                  Manage your complete platform from one place.
                </span>
              </div>
            </div>

          </div>
        </section>

        <section className="admin-login-card">

          <div className="admin-login-card-header">

            <div className="admin-login-card-icon">
              <LockKeyhole size={21} />
            </div>

            <div>
              <span>NEED ONE SERVICE</span>
              <h2>Admin Portal</h2>
            </div>

          </div>

          <div className="admin-login-welcome">
            <h3>Welcome back</h3>

            <p>
              Sign in to continue to your admin workspace.
            </p>
          </div>

          <form onSubmit={handleSubmit}>

            <div className="admin-login-field">
              <label htmlFor="admin-id">
                Admin ID / Email
              </label>

              <input
                id="admin-id"
                type="text"
                value={adminId}
                onChange={(event) =>
                  setAdminId(event.target.value)
                }
                placeholder="Enter your admin ID"
                autoComplete="username"
                disabled={loading}
              />
            </div>

            <div className="admin-login-field">
              <label htmlFor="admin-password">
                Password
              </label>

              <div className="admin-password-wrapper">
                <input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  disabled={loading}
                />

                <button
                  type="button"
                  className="admin-password-toggle"
                  onClick={() =>
                    setShowPassword((current) => !current)
                  }
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>

            <div className="admin-login-options">

              <label className="admin-remember">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) =>
                    setRememberMe(event.target.checked)
                  }
                  disabled={loading}
                />

                <span>Remember me</span>
              </label>

              <button
                type="button"
                className="admin-forgot-button"
                disabled
                title="Password recovery is not configured yet."
              >
                Forgot password?
              </button>

            </div>

            {error && (
              <div
                className="admin-login-error"
                role="alert"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              className="admin-login-submit"
              disabled={loading}
            >
              <span>
                {loading
                  ? "Signing in..."
                  : "Sign in to Admin Portal"}
              </span>

              <ArrowRight size={18} />
            </button>

          </form>

          <div className="admin-login-security">
            <ShieldCheck size={16} />

            <span>
              Authorized administrative access only
            </span>
          </div>

        </section>

      </main>

      <footer className="admin-login-footer">
        <span>NEED ONE SERVICE LLP</span>

        <span className="admin-login-footer-dot">
          •
        </span>

        <span>Operational Control Center</span>
      </footer>

    </div>
  );
}
