"use client";

// Renders login + signup as two panels in one component, animating between them instead of navigating.
import { useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { login, signup } from "./actions";
import {
  PASSWORD_PATTERN,
  PASSWORD_HINT,
  passwordRequirements,
} from "@/lib/password-policy";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/safe-redirect";
import { flattenError } from "zod";
import { signupSchema, loginSchema } from "@/lib/zod";

type Mode = "login" | "signup";

type SignupField = "firstname" | "lastname" | "email" | "password";
type LoginField = "email" | "password";

const emptySignupValues: Record<SignupField, string> = {
  firstname: "",
  lastname: "",
  email: "",
  password: "",
};

const emptyLoginValues: Record<LoginField, string> = {
  email: "",
  password: "",
};

export default function AuthPanels({
  initialMode,
  loginError,
  signupError,
  next,
  sent,
}: {
  initialMode: Mode;
  loginError?: string;
  signupError?: string;
  next?: string;
  sent?: boolean;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [signupValues, setSignupValues] = useState(emptySignupValues);
  const [signupTouched, setSignupTouched] = useState<Record<SignupField, boolean>>({
    firstname: false,
    lastname: false,
    email: false,
    password: false,
  });
  const [loginValues, setLoginValues] = useState(emptyLoginValues);
  const [loginTouched, setLoginTouched] = useState<Record<LoginField, boolean>>({
    email: false,
    password: false,
  });
  const router = useRouter();

  const signupResult = useMemo(
    () => signupSchema.safeParse(signupValues),
    [signupValues]
  );
  const signupFieldErrors = signupResult.success
    ? {}
    : flattenError(signupResult.error).fieldErrors;

  function signupFieldError(field: SignupField) {
    if (!signupTouched[field]) return undefined;
    return signupFieldErrors[field]?.[0];
  }

  function updateSignupField(field: SignupField, value: string) {
    setSignupValues((values) => ({ ...values, [field]: value }));
  }

  function touchSignupField(field: SignupField) {
    setSignupTouched((touched) => ({ ...touched, [field]: true }));
  }

  const loginResult = useMemo(
    () => loginSchema.safeParse(loginValues),
    [loginValues]
  );
  const loginFieldErrors = loginResult.success
    ? {}
    : flattenError(loginResult.error).fieldErrors;

  function loginFieldError(field: LoginField) {
    if (!loginTouched[field]) return undefined;
    return loginFieldErrors[field]?.[0];
  }

  function updateLoginField(field: LoginField, value: string) {
    setLoginValues((values) => ({ ...values, [field]: value }));
  }

  function touchLoginField(field: LoginField) {
    setLoginTouched((touched) => ({ ...touched, [field]: true }));
  }

  async function signInWithPasskey() {
    setPasskeyBusy(true);
    setPasskeyError(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPasskey();

      if (error) {
        setPasskeyError(error.message);
        setPasskeyBusy(false);
        return;
      }

      // Passkeys only get you to aal1, same as a password — the proxy
      // routes to the right MFA step (or straight through if already aal2).
      router.push(safeNext(next));
      router.refresh();
    } catch (err) {
      // signInWithPasskey() can throw (network blip, browser without
      // WebAuthn support hitting an edge the library doesn't wrap, etc.),
      // not just resolve with {error} — without this catch the button
      // stays stuck on "Waiting for browser…" forever with no way to retry.
      console.error("[passkey] sign-in failed:", err);
      setPasskeyError("Couldn't sign in with a passkey — try again or use your password.");
      setPasskeyBusy(false);
    }
  }

  // Keep the address bar in sync without triggering a route transition,
  // which would remount this component and kill the fade animation.
  useEffect(() => {
    const path = mode === "login" ? "/login" : "/signup";
    if (window.location.pathname !== path) {
      window.history.replaceState(null, "", path);
    }
  }, [mode]);

  if (sent) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Check your email
        </h1>
        <p className="text-muted">
          We sent a confirmation link. Open it to finish creating your
          account, then sign in.
        </p>
        <button
          type="button"
          onClick={() => router.push("/login")}
          className="text-sm font-medium text-ink underline underline-offset-4 transition-colors hover:text-muted"
        >
          Back to sign in
        </button>
      </main>
    );
  }

  const signupActive = mode === "signup";
  const loginActive = mode === "login";
  const panelBase =
    "transition-all duration-700 ease-out overflow-hidden md:overflow-visible flex flex-col justify-center px-6 py-16";
  const activeClasses = "opacity-100 max-h-[1400px] md:scale-100 md:blur-none";
  const inactiveClasses =
    "opacity-0 max-h-0 pointer-events-none md:opacity-5 md:max-h-none md:scale-95 md:blur-[2px]";
  const linkClasses =
    "font-medium text-ink underline decoration-line underline-offset-4 transition-colors hover:decoration-ink";
  const inputClasses =
    "rounded-lg border border-line bg-panel px-3 py-2.5 outline-none transition-colors focus:border-ink";
  const loginInputClasses =
    "rounded-xl border border-line bg-panel px-4 py-3 outline-none transition-colors focus:border-ink";

  return (
    <main className="relative min-h-dvh overflow-hidden bg-surface">
      <div className="mx-auto grid min-h-dvh max-w-6xl md:grid-cols-2 md:gap-[clamp(2rem,7vw,7rem)] md:px-8">
        {/* Sign up — left side */}
        <div
          className={`${panelBase} ${signupActive ? activeClasses : inactiveClasses}`}
          inert={!signupActive}
        >
          <div className="mx-auto w-full max-w-sm">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Create account
              </h1>
              <p className="mt-3 text-sm text-muted">
                Already registered?{" "}
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className={linkClasses}
                >
                  Sign in instead
                </button>
              </p>
            </div>

            {signupError && (
              <p className="mt-6 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
                {signupError}
              </p>
            )}

            <form className="mt-8 flex flex-col gap-5" tabIndex={signupActive ? undefined : -1}>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5 text-sm">
                  First name
                  <input
                    name="first_name"
                    type="text"
                    autoComplete="given-name"
                    required={signupActive}
                    tabIndex={signupActive ? undefined : -1}
                    value={signupValues.firstname}
                    onChange={(e) => updateSignupField("firstname", e.target.value)}
                    onBlur={() => touchSignupField("firstname")}
                    aria-invalid={!!signupFieldError("firstname")}
                    className={inputClasses}
                  />
                  {signupFieldError("firstname") && (
                    <span className="text-xs text-danger">
                      {signupFieldError("firstname")}
                    </span>
                  )}
                </label>
                <label className="flex flex-col gap-1.5 text-sm">
                  Last name
                  <input
                    name="last_name"
                    type="text"
                    autoComplete="family-name"
                    required={signupActive}
                    tabIndex={signupActive ? undefined : -1}
                    value={signupValues.lastname}
                    onChange={(e) => updateSignupField("lastname", e.target.value)}
                    onBlur={() => touchSignupField("lastname")}
                    aria-invalid={!!signupFieldError("lastname")}
                    className={inputClasses}
                  />
                  {signupFieldError("lastname") && (
                    <span className="text-xs text-danger">
                      {signupFieldError("lastname")}
                    </span>
                  )}
                </label>
              </div>
              <label className="flex flex-col gap-1.5 text-sm">
                Email
                <input
                  name="email"
                  type="email"
                  required={signupActive}
                  autoComplete="email"
                  tabIndex={signupActive ? undefined : -1}
                  value={signupValues.email}
                  onChange={(e) => updateSignupField("email", e.target.value)}
                  onBlur={() => touchSignupField("email")}
                  aria-invalid={!!signupFieldError("email")}
                  className={inputClasses}
                />
                {signupFieldError("email") && (
                  <span className="text-xs text-danger">
                    {signupFieldError("email")}
                  </span>
                )}
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                Password
                <input
                  name="password"
                  type="password"
                  required={signupActive}
                  minLength={16}
                  pattern={PASSWORD_PATTERN}
                  title={PASSWORD_HINT}
                  autoComplete="new-password"
                  tabIndex={signupActive ? undefined : -1}
                  value={signupValues.password}
                  onChange={(e) => updateSignupField("password", e.target.value)}
                  onBlur={() => touchSignupField("password")}
                  className={inputClasses}
                />
                <ul className="mt-0.5 flex flex-col gap-1">
                  {passwordRequirements.map((req) => {
                    const met = req.test(signupValues.password);
                    return (
                      <li
                        key={req.id}
                        className={`flex items-center gap-1.5 text-xs transition-colors ${
                          met ? "text-ink" : "text-muted"
                        }`}
                      >
                        <CheckCircleIcon
                          className={`size-3.5 shrink-0 transition-colors ${
                            met ? "text-success" : "text-line"
                          }`}
                        />
                        {req.label}
                      </li>
                    );
                  })}
                </ul>
              </label>
              <SignupSubmitButton
                formValid={signupResult.success}
                tabIndex={signupActive ? undefined : -1}
              />
            </form>
          </div>
        </div>

        {/* Log in — right side */}
        <div
          className={`${panelBase} ${loginActive ? activeClasses : inactiveClasses}`}
          inert={!loginActive}
        >
          <div className="mx-auto w-full max-w-sm">
            <h1 className="text-2xl font-semibold tracking-tight py-3">Login</h1>

            {passkeyError && (
              <p className="mt-5 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
                {passkeyError}
              </p>
            )}

            <button
              type="button"
              onClick={signInWithPasskey}
              disabled={passkeyBusy}
              tabIndex={loginActive ? undefined : -1}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-line px-4 py-3 text-sm font-medium transition-colors hover:bg-panel disabled:opacity-50"
            >
              <KeyRoundIcon className="size-4" />
              {passkeyBusy ? "Waiting for browser…" : "Login with a passkey"}
            </button>

            <div className="mt-5 flex items-center gap-3 text-xs text-muted">
              <div className="h-px flex-1 bg-line" />
              or
              <div className="h-px flex-1 bg-line" />
            </div>


            {loginError && (
              <p className="mt-6 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
                {loginError}
              </p>
            )}

            <form className="mt-8 flex flex-col gap-4" tabIndex={loginActive ? undefined : -1}>
              <input type="hidden" name="next" value={next ?? ""} />
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="sr-only">Email address</span>
                <input
                  name="email"
                  type="email"
                  placeholder="Email address"
                  required={loginActive}
                  autoComplete="email"
                  tabIndex={loginActive ? undefined : -1}
                  value={loginValues.email}
                  onChange={(e) => updateLoginField("email", e.target.value)}
                  onBlur={() => touchLoginField("email")}
                  aria-invalid={!!loginFieldError("email")}
                  className={loginInputClasses}
                />
                {loginFieldError("email") && (
                  <span className="text-xs text-danger">
                    {loginFieldError("email")}
                  </span>
                )}
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="sr-only">Password</span>
                <input
                  name="password"
                  type="password"
                  placeholder="Password"
                  required={loginActive}
                  autoComplete="current-password"
                  tabIndex={loginActive ? undefined : -1}
                  value={loginValues.password}
                  onChange={(e) => updateLoginField("password", e.target.value)}
                  onBlur={() => touchLoginField("password")}
                  aria-invalid={!!loginFieldError("password")}
                  className={loginInputClasses}
                />
                {loginFieldError("password") && (
                  <span className="text-xs text-danger">
                    {loginFieldError("password")}
                  </span>
                )}
              </label>
              <button
                formAction={login}
                disabled={!loginResult.success}
                tabIndex={loginActive ? undefined : -1}
                className="mt-1 rounded-xl bg-accent px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-50"
              >
                Sign in
              </button>
            </form>

            <div className="mt-6 h-px bg-line" />

            <Link
              href="/login/forgot-password"
              tabIndex={loginActive ? undefined : -1}
              className="mt-6 block rounded-xl border border-line px-4 py-3 text-center text-sm font-medium transition-colors hover:bg-panel"
            >
              Forgot your password?
            </Link>

            <p className="mt-3 text-center text-sm text-muted py-2">
              New here?{" "}
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={linkClasses}
              >
                Create an account
              </button>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

// useFormStatus only reports the enclosing <form>'s real pending state when
// called from a component distinct from the one rendering the <form> itself —
// hence pulling this out instead of inlining the button above. Disabling via
// an onClick-driven timer (the old approach) raced the browser's native
// submit-on-click and could cancel the very submission it was meant to guard.
function SignupSubmitButton({
  formValid,
  tabIndex,
}: {
  formValid: boolean;
  tabIndex?: number;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      formAction={signup}
      disabled={pending || !formValid}
      tabIndex={tabIndex}
      className="mt-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-50"
    >
      {pending ? "Creating account…" : "Create account"}
    </button>
  );
}

function KeyRoundIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z" />
      <circle cx="16.5" cy="7.5" r=".5" fill="currentColor" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true">
      <circle cx="10" cy="10" r="10" fill="currentColor" />
      <path
        d="M6 10.5l2.5 2.5L14 7.5"
        fill="none"
        stroke="white"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
