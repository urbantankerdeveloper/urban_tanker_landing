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
