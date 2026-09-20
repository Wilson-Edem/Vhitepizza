import { useState } from "react";
import { useAuth } from "./AuthContext";
import "./auth.css";

const TITLES = {
  login: ["Welcome back", "Sign in to order your favorite pizza."],
  signup: ["Create your account", "Sign up to order and track your pizza."],
  reset: ["Reset password", "We will email you a link to choose a new one."],
};

export default function AuthScreen({ onDone }) {
  const { signInEmail, signUpEmail, signInGoogle, resetPassword } = useAuth();

  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const update = (key) => (event) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const switchMode = (next) => {
    setMode(next);
    setError("");
    setNotice("");
  };

  const run = async (task) => {
    setBusy(true);
    setError("");
    setNotice("");

    try {
      await task();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submit = (event) => {
    event.preventDefault();

    if (mode === "login") {
      return run(async () => {
        await signInEmail(form.email, form.password);
        onDone();
      });
    }

    if (mode === "signup") {
      return run(async () => {
        await signUpEmail(form);
        onDone();
      });
    }

    return run(async () => {
      await resetPassword(form.email);
      setNotice("Reset link sent. Check your inbox and spam folder.");
    });
  };

  const google = () =>
    run(async () => {
      await signInGoogle();
      onDone();
    });

  const [title, text] = TITLES[mode];

  return (
    <div className="page-content">
      <div className="auth-card">
        <div>
          <h2>{title}</h2>
          <p>{text}</p>
        </div>

        {error && <div className="auth-error">{error}</div>}
        {notice && <div className="auth-notice">{notice}</div>}

        <form className="auth-form" onSubmit={submit}>
          {mode === "signup" && (
            <>
              <label className="field">
                <span>Full name</span>
                <input
                  type="text"
                  value={form.name}
                  onChange={update("name")}
                  autoComplete="name"
                  required
                />
              </label>

              <label className="field">
                <span>Phone number (optional)</span>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={update("phone")}
                  autoComplete="tel"
                  placeholder="0801 234 5678"
                />
              </label>
            </>
          )}

          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={form.email}
              onChange={update("email")}
              autoComplete="email"
              required
            />
          </label>

          {mode !== "reset" && (
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                value={form.password}
                onChange={update("password")}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                minLength={6}
                required
              />
            </label>
          )}

          <button className="primary-button" type="submit" disabled={busy}>
            {busy
              ? "Please wait..."
              : mode === "login"
                ? "Sign In"
                : mode === "signup"
                  ? "Create Account"
                  : "Send Reset Link"}
          </button>
        </form>

        {mode !== "reset" && (
          <>
            <div className="auth-divider">or</div>

            <button
              className="google-button"
              type="button"
              onClick={google}
              disabled={busy}
            >
              <span className="google-mark">G</span>
              Continue with Google
            </button>
          </>
        )}

        <div className="auth-links">
          {mode === "login" && (
            <>
              <button type="button" onClick={() => switchMode("reset")}>
                Forgot password?
              </button>
              <button type="button" onClick={() => switchMode("signup")}>
                Create account
              </button>
            </>
          )}

          {mode === "signup" && (
            <button type="button" onClick={() => switchMode("login")}>
              I already have an account
            </button>
          )}

          {mode === "reset" && (
            <button type="button" onClick={() => switchMode("login")}>
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
