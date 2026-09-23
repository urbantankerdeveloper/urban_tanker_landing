import { Droplets } from 'lucide-react';
import { useContent } from '../hooks/useContent';

export function LoadingSkeleton() {
  const content = useContent();
  return <main className="loading-screen" aria-busy="true" aria-live="polite" aria-label={content.loading}>
    <div className="loading-brand"><span className="brand-mark"><Droplets size={18} /></span><span>urban<span>tanker</span></span></div>
    <div className="skeleton-heading" />
    <div className="skeleton-copy" />
    <section className="skeleton-grid" aria-hidden="true"><div /><div /><div /></section>
    <p>{content.loading}</p>
  </main>;
}

export function WorkspaceSkeleton({ role }: { role: 'customer' | 'vendor' | 'admin' }) {
  const labels = { customer: 'Loading customer workspace', vendor: 'Loading vendor workspace', admin: 'Loading admin workspace' };
  return <main className={`workspace-skeleton workspace-skeleton-${role}`} aria-busy="true" aria-live="polite" aria-label={labels[role]}>
    <div className="workspace-skeleton-heading"><div className="skeleton-heading" /><div className="skeleton-copy" /></div>
    <section className="workspace-skeleton-stats" aria-hidden="true">{Array.from({ length: 4 }).map((_, index) => <div className="workspace-skeleton-stat" key={index}><div className="skeleton-line workspace-skeleton-icon" /><div className="skeleton-line workspace-skeleton-value" /><div className="skeleton-line workspace-skeleton-label" /></div>)}</section>
    <section className="workspace-skeleton-surface" aria-hidden="true"><div className="skeleton-line workspace-skeleton-surface-title" />{Array.from({ length: 5 }).map((_, index) => <div className="workspace-skeleton-row" key={index}><div className="skeleton-line" /><div className="skeleton-line" /><div className="skeleton-line" /></div>)}</section>
  </main>;
}
