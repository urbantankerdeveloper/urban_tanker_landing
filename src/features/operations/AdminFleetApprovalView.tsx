import { Check, Truck, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, Status } from '../../shared/components/ui';
import { approveAdminDriver, approveAdminVehicle, loadAdminDrivers, loadAdminVehicles } from '../../shared/lib/cloudStore';

export function AdminFleetApprovalView({ mode, onNotify }: { mode: 'fleet' | 'drivers'; onNotify: (message: string) => void }) {
  const [records, setRecords] = useState<Array<{ id: string; label: string; detail: string; vendorName: string; approvalStatus: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      if (mode === 'fleet') {
        const vehicles = await loadAdminVehicles();
        setRecords(vehicles.filter(vehicle => vehicle.approvalStatus !== 'approved').map(vehicle => ({ id: vehicle.id, label: vehicle.registrationNumber, detail: `${vehicle.vehicleType} · ${vehicle.capacity || 'Capacity not set'}`, vendorName: vehicle.vendorName, approvalStatus: vehicle.approvalStatus })));
      } else {
        const drivers = await loadAdminDrivers();
        setRecords(drivers.filter(driver => driver.approvalStatus !== 'approved').map(driver => ({ id: driver.id, label: driver.name, detail: driver.phone || 'No phone number', vendorName: driver.vendorName, approvalStatus: driver.approvalStatus })));
      }
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Unable to load pending approvals.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [mode]);

  const approve = async (id: string) => {
    setBusyId(id);
    try {
      if (mode === 'fleet') await approveAdminVehicle(id, true);
      else await approveAdminDriver(id, true);
      setRecords(current => current.filter(record => record.id !== id));
      onNotify(`${mode === 'fleet' ? 'Vehicle' : 'Driver'} approved.`);
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Unable to approve record.');
    } finally {
      setBusyId(null);
    }
  };

  return <section className="data-surface fleet-approval-surface" aria-busy={loading}>
    <div className="section-heading"><div><span className="eyebrow">Admin verification</span><h2>{mode === 'fleet' ? 'Vehicle approvals' : 'Driver approvals'}</h2></div><Status>{loading ? 'Loading' : `${records.length} pending`}</Status></div>
    {records.length ? <div className="order-list">{records.map(record => <article className="order-row" key={record.id}><div className="order-service-icon">{mode === 'fleet' ? <Truck size={19} /> : <Users size={19} />}</div><div className="order-main"><div><b>{record.label}</b><Status>{record.approvalStatus}</Status></div><span>{record.detail}</span><small>Vendor: {record.vendorName}</small></div><Button variant="primary" icon={Check} onClick={() => void approve(record.id)} disabled={busyId === record.id}>{busyId === record.id ? 'Approving...' : 'Approve'}</Button></article>)}</div> : <p className="modal-copy">No pending {mode === 'fleet' ? 'vehicle' : 'driver'} approvals.</p>}
  </section>;
}
