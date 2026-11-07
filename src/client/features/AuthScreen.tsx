import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, BookOpen, LoaderCircle } from "lucide-react";
import type { AuthClient } from "../auth";
import { Brand, ErrorNotice } from "../components/ui";
import { errorMessage } from "../api";
import { hasExtensionConnectIntent } from "../extension";

export default function AuthScreen({
  client,
  onSignedIn,
  verificationEmail,
  sessionError,
}: {
  client: AuthClient | null;
  onSignedIn: (action: "signin" | "verify") => Promise<void>;
  verificationEmail?: string;
  sessionError?: string;
}) {
  const params = new URLSearchParams(window.location.search);
  const resetToken = params.get("token");
  const [view, setView] = useState<
    "signin" | "signup" | "verify" | "forgot" | "reset"
  >(resetToken && params.has("reset") ? "reset" : "signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (sessionError) setError(sessionError);
  }, [sessionError]);
  useEffect(() => {
    if (verificationEmail) {
      setEmail(verificationEmail);
      setView("verify");
      setNotice(
        "Verify your email to open your learning workspace. Enter your code below or request a new one.",
      );
    }
  }, [verificationEmail]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!client) return;
    setError("");
    setNotice("");
    setBusy(true);
    try {
      if ((view === "signup" || view === "reset") && password !== confirmation)
        throw new Error("Your passwords do not match.");
      if (view === "signup") {
        const result = await client.signUp.email({ name, email, password });
        if (result.error)
          throw new Error(
            result.error.message || "Could not create your account.",
          );
        setView("verify");
        setNotice("Check your email for a verification code.");
        const sent = await client.emailOtp.sendVerificationOtp({
          email,
          type: "email-verification",
        });
        if (sent.error)
          setNotice(
            "Your account was created. Use “Send a new code” to verify your email.",
          );
      } else if (view === "verify") {
        const result = await client.emailOtp.verifyEmail({ email, otp });
        if (result.error)
          throw new Error(
            result.error.message || "That code could not be verified.",
          );
        setNotice("Email verified. You can now sign in.");
        setView("signin");
        await onSignedIn("verify");
      } else if (view === "forgot") {
        const result = await client.requestPasswordReset({
          email,
          redirectTo: `${window.location.origin}/?reset=1`,
        });
        if (result.error)
          throw new Error(
            result.error.message || "Could not send a reset email.",
          );
        setNotice(
          "If an account exists for that address, a reset email is on its way.",
        );
      } else if (view === "reset") {
        const result = await client.resetPassword({
          token: resetToken || "",
          newPassword: password,
        });
        if (result.error)
          throw new Error(
            result.error.message || "The reset link could not be used.",
          );
        window.history.replaceState({}, "", window.location.pathname);
        setPassword("");
        setConfirmation("");
        setView("signin");
        setNotice("Password updated. Sign in to continue.");
      } else {
        const result = await client.signIn.email({ email, password });
        if (result.error)
          throw new Error(result.error.message || "Could not sign in.");
        await onSignedIn("signin");
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  async function resend() {
    if (!client) return;
    setBusy(true);
    setError("");
    try {
      const result = await client.emailOtp.sendVerificationOtp({
        email,
        type: "email-verification",
      });
      if (result.error)
        throw new Error(result.error.message || "Could not send the code.");
      setNotice("A new verification code is on its way.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const titles = {
    signin: "A little context.\nA world of possibility.",
    signup: "Your next chapter\nstarts with a word.",
    verify: "Check your inbox.",
    forgot: "Let’s get you back in.",
    reset: "Choose a new password.",
  };
  return (
    <div className="auth-page">
      <aside className="auth-story">
        <Brand />
        <div>
          <span className="eyebrow">READ. WONDER. UNDERSTAND.</span>
          <h1>
            Words belong
            <br />
            in a <em>world.</em>
          </h1>
          <p>
            Keep the language you find. Explore what it means. Make it part of
            your own.
          </p>
          <div className="auth-example">
            <BookOpen size={24} />
            <span>
              “The proposal <u>addresses</u> the housing shortage.”
            </span>
            <small>A familiar word. A new way of seeing it.</small>
          </div>
        </div>
        <span className="small">
          ContextBridge · Learn through what you read
        </span>
      </aside>
      <main className="auth-main">
        <div className="auth-form">
          <span className="eyebrow">YOUR PERSONAL LEARNING SPACE</span>
          <h2>{titles[view]}</h2>
          <p className="muted">
            {view === "signin"
              ? "Welcome back. Your words are waiting."
              : view === "signup"
                ? "Save meaningful encounters across the web and your library."
                : view === "verify"
                  ? "Enter the code sent to your email address."
                  : "We’ll help you return to your learning space."}
          </p>
          {hasExtensionConnectIntent() && (
            <div className="notice" role="status">
              Sign in or create an account here. Your extension will connect
              automatically when you’re signed in.
            </div>
          )}
          {!client && (
            <ErrorNotice message="Sign-in is not configured yet. Add the Neon Auth URL to the web server’s environment to enable accounts." />
          )}
          {error && <ErrorNotice message={error} />}
          {notice && (
            <div className="notice success" role="status">
              {notice}
            </div>
          )}
          <form onSubmit={submit}>
            {view === "signup" && (
              <label>
                Your name
                <input
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={100}
                  placeholder="What should we call you?"
                />
              </label>
            )}
            {view !== "reset" && (
              <label>
                Email address
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                />
              </label>
            )}
            {(view === "signin" || view === "signup" || view === "reset") && (
              <label>
                Password
                <input
                  type="password"
                  autoComplete={
                    view === "signin" ? "current-password" : "new-password"
                  }
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="At least 8 characters"
                />
              </label>
            )}
            {(view === "signup" || view === "reset") && (
              <label>
                Confirm password
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  required
                />
              </label>
            )}
            {view === "verify" && (
              <label>
                Verification code
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  required
                  placeholder="Enter your code"
                />
              </label>
            )}
            <button
              className="button primary full-width"
              disabled={busy || !client}
            >
              {busy ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <>
                  {view === "signup"
                    ? "Create your account"
                    : view === "verify"
                      ? "Verify email"
                      : view === "forgot"
                        ? "Send reset email"
                        : view === "reset"
                          ? "Update password"
                          : "Sign in"}
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>
          <div className="auth-links">
            {view === "signin" ? (
              <>
                <button
                  onClick={() => {
                    setView("signup");
                    setError("");
                  }}
                >
                  New here? Create an account
                </button>
                <button
                  onClick={() => {
                    setView("forgot");
                    setError("");
                  }}
                >
                  Forgot password?
                </button>
                <button
                  onClick={() => {
                    setView("verify");
                    setError("");
                  }}
                >
                  Verify your email
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    setView("signin");
                    setError("");
                  }}
                >
                  Back to sign in
                </button>
                {view === "verify" && (
                  <button disabled={busy} onClick={resend}>
                    Send a new code
                  </button>
                )}
              </>
            )}
          </div>
          <p className="auth-footnote">
            Your library is private to your account. You choose which words and
            encounters to save.
          </p>
        </div>
      </main>
    </div>
  );
}
