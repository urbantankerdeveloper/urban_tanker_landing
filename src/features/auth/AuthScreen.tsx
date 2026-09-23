import { Fragment, FormEvent, useRef, useState } from "react";
import { ArrowRight, Droplets, ShieldCheck } from "lucide-react";
import {
  registerWithPassword,
  requestPasswordReset,
  completePasswordReset,
  signInWithPassword,
  signInWithGoogle,
} from "./auth";
import { useAppStore } from "../../app/store";
import { useContent } from "../../shared/hooks/useContent";
import type { Role } from "../../shared/lib/types";
import { Button } from "../../shared/components/ui";
import { Toast } from "../../shared/components/Toast";

export function AuthScreen() {
  const appContent = useContent();
  const content = appContent.auth;
  const {
    authRole: role,
    authName: name,
    authEmail: email,
    authPassword: password,
    authPhone: phone,
    authBusy: busy,
    authRememberMe: rememberMe,
    toast,
    setAuthRole: setRole,
    setAuthName: setName,
    setAuthEmail: setEmail,
    setAuthPassword: setPassword,
    setAuthPhone: setPhone,
    setAuthBusy: setBusy,
    setAuthError: setError,
    setAuthRememberMe: setRememberMe,
    notify,
    dismissToast,
    update,
  } = useAppStore();
  const [registering, setRegistering] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [resetToken] = useState(() => new URLSearchParams(window.location.search).get("resetToken") || "");
  const [resetEmail, setResetEmail] = useState(() => new URLSearchParams(window.location.search).get("resetEmail") || email);
  const submitLock = useRef(false);
  const validatePhone = () => {
    const normalized = phone.replace(/\D/g, "");
    if (!/^[6-9]\d{9}$/.test(normalized)) {
      setError("Enter a valid 10-digit Indian mobile number.");
      return null;
    }
    return normalized;
  };
  const validateCredentials = () => {
    const normalizedEmail = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setError('Enter a valid email address.');
      return false;
    }
    if (registering && password.length < 8) {
      setError('Password must be at least 8 characters.');
      return false;
    }
    if (!registering && password.length === 0) {
      setError('Enter your password.');
      return false;
    }
    if (registering && name.trim().length < 2) {
      setError('Enter your full name or organisation name.');
      return false;
    }
    return true;
  };
  const complete = async (user: {
    displayName: string | null;
    email: string | null;
    phoneNumber: string | null;
    role?: Role;
  }) => {
    update({
      role: user.role || role,
      profile: {
        name:
          user.displayName ||
          name.trim() ||
          email.split("@")[0] ||
          "Urban Tanker user",
        email: user.email || email,
        phone: user.phoneNumber || phone,
      },
    });
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitLock.current || busy) return;
    submitLock.current = true;
    setError("");
    if (!validateCredentials()) {
      submitLock.current = false;
      notify('Check the highlighted account details.');
      return;
    }
    if (registering && !validatePhone()) {
      submitLock.current = false;
      notify("Enter a valid 10-digit Indian mobile number.");
      return;
    }
    setBusy(true);
    try {
      if (registering) {
        await complete(
          await registerWithPassword(
            email.trim(),
            password,
            name.trim() || undefined,
            phone,
            role,
          ),
        );
      } else {
        await complete(await signInWithPassword(email.trim(), password, role));
      }
    } catch (cause) {
      const code =
        cause && typeof cause === "object" && "code" in cause
          ? String(cause.code)
          : "";
      const message = code === "auth/operation-not-allowed"
          ? "Email and password sign-in is not available on the server."
          : code === "auth/invalid-credential" ||
            code === "auth/user-not-found" ||
            code === "auth/wrong-password"
            ? "The email or password is incorrect, or this account is not registered."
            : cause instanceof Error
              ? cause.message
            : `Unable to ${registering ? "register" : "sign in"}. Check your details.`;
      setError(message);
      notify(message);
    } finally {
      setBusy(false);
      submitLock.current = false;
    }
  };
  const toggleMode = () => {
    const nextRegistering = !registering;
    setRegistering(nextRegistering);
    setResetMode(false);
    setError("");
  };
  const google = async () => {
    if (submitLock.current || busy) return;
    submitLock.current = true;
    setError("");
    setBusy(true);
    try {
      await complete(await signInWithGoogle(role));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unable to sign in with Google.";
      setError(message);
      notify(message);
    } finally {
      setBusy(false);
      submitLock.current = false;
    }
  };
  const handlePasswordReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitLock.current || busy) return;
    submitLock.current = true;
    setError("");
    if (!/^\S+@\S+\.\S+$/.test(resetEmail.trim())) {
      setError('Enter a valid email address.');
      submitLock.current = false;
      return;
    }
    if (resetToken && resetPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      submitLock.current = false;
      return;
    }
    setBusy(true);
    try {
      const message = resetToken
        ? await completePasswordReset(resetEmail.trim(), resetToken, resetPassword)
        : await requestPasswordReset(resetEmail.trim());
      setError(message);
      notify(message);
      if (resetToken) {
        setResetMode(false);
        setResetPassword("");
        window.history.replaceState({}, "", window.location.pathname);
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unable to reset the password.";
      setError(message);
      notify(message);
    } finally {
      setBusy(false);
      submitLock.current = false;
    }
  };
  return (
    <main className="auth-page" aria-labelledby="auth-title">
      <section className="auth-story" aria-label={content.storyEyebrow}>
        <div className="brand auth-brand">
          <span className="brand-mark">
            <Droplets size={18} />
          </span>
          <span>{appContent.brand.name}</span>
        </div>
        <div className="auth-story-copy">
          <span className="eyebrow">{content.storyEyebrow}</span>
          <h1>{content.storyTitle}</h1>
          <p>{content.storyCopy}</p>
          <div className="auth-proof">
            {content.proof.map((item) => (
              <Fragment key={item.number}>
                <span key={`${item.number}-number`}>{item.number}</span>
                <b key={`${item.number}-label`}>{item.label}</b>
              </Fragment>
            ))}
          </div>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-panel-inner">
          <span className="eyebrow">{content.eyebrow}</span>
          <h2 id="auth-title">
            {registering ? content.registerTitle : content.title}
          </h2>
          <p className="modal-copy">
            {registering ? content.registerDescription : content.description}
          </p>
          <div
            className="role-switcher"
            role="tablist"
            aria-label={content.accountTypeLabel}
          >
            {(["customer", "vendor", "admin"] as Role[]).map((item) => (
              <button
                type="button"
                role="tab"
                aria-selected={role === item}
                className={role === item ? "active" : ""}
                onClick={() => {
                  setRole(item);
                  setError("");
                }}
                key={item}
              >
                {content.roles[item]}
              </button>
            ))}
          </div>
          <p className="selected-role" aria-live="polite">
            <span>
              {registering
                ? content.selectedRegisterRole || "Registering as"
                : content.selectedSignInRole || "Signing in as"}
            </span>
            <strong>{content.roles[role]}</strong>
          </p>
          <button className="google-auth-button" type="button" onClick={() => void google()} disabled={busy}>
            <span aria-hidden="true">G</span>
            {busy ? content.googleConnecting : `${content.signIn} with Google`}
          </button>
          <div className="auth-divider">
            <span>{content.emailDivider}</span>
          </div>
          <form className="auth-form" onSubmit={submit} noValidate>
            {registering && (
              <label htmlFor="auth-name">
                {role === "customer"
                  ? content.fullNameLabel
                  : content.organisationLabel}
                <input
                  id="auth-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  placeholder={
                    role === "customer"
                      ? content.fullNamePlaceholder
                      : content.organisationPlaceholder
                  }
                  required
                />
              </label>
            )}
            {registering && (
              <label htmlFor="auth-phone">
                {content.mobileLabel}
                <input
                  id="auth-phone"
                  value={phone}
                  onChange={(event) =>
                    setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))
                  }
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder={content.phonePlaceholder}
                  pattern="[6-9][0-9]{9}"
                  aria-describedby="auth-phone-help"
                  required
                />
                <small id="auth-phone-help">{content.phoneHelp}</small>
              </label>
            )}
            <label htmlFor="auth-email">
              {content.emailLabel}
              <input
                id="auth-email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                autoComplete="email"
                placeholder={
                  role === "admin"
                    ? content.adminEmailPlaceholder
                    : content.emailPlaceholder
                }
                required
              />
            </label>
            <label htmlFor="auth-password">
              {content.passwordLabel}
              <input
                id="auth-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                autoComplete={registering ? "new-password" : "current-password"}
                placeholder={
                  registering
                    ? content.registerPasswordPlaceholder
                    : content.passwordPlaceholder
                }
                minLength={8}
                required
              />
            </label>
            <label className="remember-option" htmlFor="remember-me">
              <input
                id="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
              />{" "}
              <span>{content.remember}</span>
            </label>
            <Button type="submit" variant="primary full" icon={ArrowRight}>
              {busy
                ? registering
                  ? content.registerBusy
                  : content.signInBusy
                : registering
                  ? `${content.register} ${content.roles[role]}`
                  : `${content.signIn} ${content.roles[role]}`}
            </Button>
          </form>
          <div className="auth-link-row">
            {!registering && !resetMode && (
              <button className="auth-mode-toggle" type="button" onClick={() => setResetMode(true)}>
                Forgot password?
              </button>
            )}
            {!resetMode && (
              <button
                className="auth-mode-toggle"
                type="button"
                onClick={toggleMode}
              >
                {registering ? content.toggleSignIn : content.toggleRegister}
              </button>
            )}
          </div>
          {resetMode && (
            <form className="auth-form reset-form" onSubmit={handlePasswordReset}>
              <p className="modal-copy">{resetToken ? "Choose a new password." : "Enter your email and we will send a secure reset link."}</p>
              <label htmlFor="reset-email">Email address<input id="reset-email" type="email" value={resetEmail} onChange={event => setResetEmail(event.target.value)} required /></label>
              {resetToken && <label htmlFor="reset-password">New password<input id="reset-password" type="password" value={resetPassword} onChange={event => setResetPassword(event.target.value)} minLength={8} required /></label>}
              <Button type="submit" variant="primary full" disabled={busy}>{busy ? "Sending..." : resetToken ? "Reset password" : "Send reset link"} <ArrowRight size={16} /></Button>
              <button className="auth-mode-toggle" type="button" onClick={() => setResetMode(false)}>Back to sign in</button>
            </form>
          )}
          <p className="terms-note">
            <ShieldCheck size={13} /> {content.authNote}
          </p>
        </div>
      </section>
      <Toast message={toast} onClose={dismissToast} />
    </main>
  );
}
