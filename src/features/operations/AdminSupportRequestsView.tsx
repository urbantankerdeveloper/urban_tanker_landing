import { Check, MessageSquare } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, PageHeader, Status } from '../../shared/components/ui';
import { loadSupportRequests, updateSupportRequest, type SupportRequest } from '../../shared/lib/cloudStore';

export function AdminSupportRequestsView({ onNotify }: { onNotify: (message: string) => void }) {
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resolution, setResolution] = useState<Record<string, string>>({});
  useEffect(() => { void loadSupportRequests().then(setRequests).catch(error => onNotify(error instanceof Error ? error.message : 'Unable to load support requests.')); }, [onNotify]);
  const resolve = async (request: SupportRequest) => {
    setBusyId(request.id);
    try { await updateSupportRequest(request.id, 'resolved', resolution[request.id] || 'Resolved by operations.'); setRequests(current => current.map(item => item.id === request.id ? { ...item, status: 'resolved', resolution: resolution[request.id] || 'Resolved by operations.' } : item)); onNotify('Support request resolved.'); } catch (error) { onNotify(error instanceof Error ? error.message : 'Unable to resolve support request.'); } finally { setBusyId(null); }
  };
  return <><PageHeader eyebrow="Admin workspace · Help" title="Operations support." copy="Review customer and vendor requests, then provide a resolution." /><section className="data-surface support-request-list">{requests.length ? requests.map(request => <article className="support-request-row" key={request.id}><div className="section-heading"><div><span className="eyebrow">{request.requester_role} · {request.requester_name}</span><h2>{request.subject}</h2></div><Status>{request.status}</Status></div><p>{request.message}</p>{request.order_id && <small className="mono">Order: {request.order_id}</small>}{request.status !== 'resolved' ? <><textarea value={resolution[request.id] || ''} onChange={event => setResolution(current => ({ ...current, [request.id]: event.target.value }))} placeholder="Resolution notes" rows={3} /><Button variant="primary" icon={Check} onClick={() => void resolve(request)} disabled={busyId === request.id}>{busyId === request.id ? 'Resolving...' : 'Resolve request'}</Button></> : <p className="support-resolution"><strong>Resolution:</strong> {request.resolution}</p>}</article>) : <div className="empty-state"><MessageSquare size={28} /><h3>No support requests</h3><p>Customer and vendor requests will appear here.</p></div>}</section></>;
}
