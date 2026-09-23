import { AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { loadVendorExpiringDocuments } from '../../shared/lib/cloudStore';
import { Status } from '../../shared/components/ui';

export function FleetExpiryPanel({ onNotify }: { onNotify: (message: string) => void }) {
  const [vehicles, setVehicles] = useState<Array<Record<string, unknown>>>([]);
  useEffect(() => { void loadVendorExpiringDocuments().then(setVehicles).catch(error => onNotify(error instanceof Error ? error.message : 'Unable to load document expiry alerts.')); }, [onNotify]);
  if (!vehicles.length) return null;
  return <section className="expiry-alert"><AlertTriangle size={18} /><div><b>Fleet documents need attention</b><span>{vehicles.length} vehicle record{vehicles.length === 1 ? '' : 's'} expire within 30 days.</span></div><Status>Review</Status></section>;
}
