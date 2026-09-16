import { FormEvent, useState } from 'react';
import { ArrowRight, Droplets, ShieldCheck } from 'lucide-react';
import { registerWithPassword, signInWithGoogle, signInWithPassword } from '../auth';
import { useAppStore } from '../store';
import { useContent } from '../hooks/useContent';
import type { Role } from '../types';
import { Button } from './ui';

export function AuthScreen() {
  const content = useContent().auth;
  const { authRole: role, authName: name, authEmail: email, authPassword: password, authPhone: phone, authBusy: busy, authError: error, authRememberMe: rememberMe, setAuthRole: setRole, setAuthName: setName, setAuthEmail: setEmail, setAuthPassword: setPassword, setAuthPhone: setPhone, setAuthBusy: setBusy, setAuthError: setError, setAuthRememberMe: setRememberMe, update } = useAppStore();
  const [registering, setRegistering] = useState(false);
  const validatePhone = () => { const normalized = phone.replace(/\D/g, ''); if (!/^[6-9]\d{9}$/.test(normalized)) { setError('Enter a valid 10-digit Indian mobile number.'); return null; } return normalized; };
  const complete = (user: { displayName: string | null; email: string | null; phoneNumber: string | null }) => update({ role, profile: { name: user.displayName || name.trim() || email.split('@')[0] || 'Urban Tanker user', email: user.email || email, phone: user.phoneNumber || phone } });
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (registering && !validatePhone()) return;
    setBusy(true);
    try {
      if (registering) {
        complete(await registerWithPassword(email.trim(), password, name.trim() || undefined));
      } else {
        complete(await signInWithPassword(email.trim(), password));
      }
    }
    catch (cause) {
      setError(cause instanceof Error ? cause.message : `Unable to ${registering ? 'register' : 'sign in'}. Check your details.`);
    }
    finally {
      setBusy(false);
    }
  };
  const google = async () => {
    setError('');
    setBusy(true);
    try {
      complete(await signInWithGoogle());
    } catch (cause) {
      const code = cause && typeof cause === 'object' && 'code' in cause ? String(cause.code) : '';
      setError(code === 'auth/popup-closed-by-user' ? 'Google sign-in was cancelled.' : cause instanceof Error ? cause.message : 'Unable to sign in with Google.');
    } finally {
      setBusy(false);
    }
  };
  const toggleMode = () => { setRegistering(value => !value); setError(''); };
  return <main className="auth-page" aria-labelledby="auth-title">
    <section className="auth-story" aria-label="Urban Tanker service promise"><div className="brand auth-brand"><span className="brand-mark"><Droplets size={18} /></span><span>urban<span>tanker</span></span></div><div className="auth-story-copy"><span className="eyebrow">Your delivery, remembered</span><h1>Reliable service starts with a <em>single profile.</em></h1><p>Keep your addresses, bookings and delivery updates together, so every tanker arrives with less effort.</p><div className="auth-proof"><span>01</span><b>Verified vendors</b><span>02</span><b>Clear pricing</b><span>03</span><b>Secure handover</b></div></div></section>
    <section className="auth-panel"><div className="auth-panel-inner"><span className="eyebrow">{content.eyebrow}</span><h2 id="auth-title">{registering ? content.registerTitle : content.title}</h2><p className="modal-copy">{registering ? content.registerDescription : content.description}</p><div className="role-switcher" role="tablist" aria-label="Account type">{(['customer', 'vendor', 'admin'] as Role[]).map(item => <button type="button" role="tab" aria-selected={role === item} className={role === item ? 'active' : ''} onClick={() => { setRole(item); setError(''); }} key={item}>{item[0].toUpperCase() + item.slice(1)}</button>)}</div><button className="google-auth-button" type="button" onClick={() => void google()} disabled={busy}><span aria-hidden="true">G</span>{busy ? 'Connecting...' : `${registering ? 'Register' : 'Sign in'} with Google`}</button><div className="auth-divider"><span>{content.emailDivider}</span></div><form className="auth-form" onSubmit={submit} noValidate>{registering && <label htmlFor="auth-name">{role === 'customer' ? 'Full name' : 'Organisation or display name'}<input id="auth-name" value={name} onChange={event => setName(event.target.value)} autoComplete="name" placeholder={role === 'customer' ? 'Your name' : 'Workspace name'} required /></label>}{registering && <label htmlFor="auth-phone">Mobile number<input id="auth-phone" value={phone} onChange={event => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))} type="tel" inputMode="numeric" autoComplete="tel" placeholder="98765 43210" pattern="[6-9][0-9]{9}" aria-describedby="auth-phone-help" required /><small id="auth-phone-help">{content.phoneHelp}</small></label>}<label htmlFor="auth-email">Email address<input id="auth-email" value={email} onChange={event => setEmail(event.target.value)} type="email" autoComplete="email" placeholder={role === 'admin' ? 'admin@urbantanker.com' : 'you@example.com'} required /></label><label htmlFor="auth-password">Password<input id="auth-password" value={password} onChange={event => setPassword(event.target.value)} type="password" autoComplete={registering ? 'new-password' : 'current-password'} placeholder={registering ? 'At least 6 characters' : 'Enter your password'} minLength={6} required /></label><label className="remember-option" htmlFor="remember-me"><input id="remember-me" type="checkbox" checked={rememberMe} onChange={event => setRememberMe(event.target.checked)} /> <span>{content.remember}</span></label><Button type="submit" variant="primary full" icon={ArrowRight}>{busy ? (registering ? 'Creating account...' : 'Signing in...') : (registering ? `${content.register} ${role}` : `${content.signIn} ${role}`)}</Button></form>{error && <p className="auth-error" role="alert">{error}</p>}<button className="auth-mode-toggle" type="button" onClick={toggleMode}>{registering ? content.toggleSignIn : content.toggleRegister}</button><p className="terms-note"><ShieldCheck size={13} /> {content.authNote}</p></div></section>
  </main>;
}
