import { Check, Truck, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, Status } from '../../shared/components/ui';
import { approveAdminDriver, approveAdminVehicle, loadAdminDrivers, loadAdminVehicles } from '../../shared/lib/cloudStore';

export function AdminFleetApprovalView({ mode, onNotify, onApprove, iconOnly }: { mode: 'fleet' | 'drivers'; onNotify: (message: string) => void; onApprove?: () => void; iconOnly?: boolean }) {
  const [records, setRecords] = useState<Array<{ id: string; label: string; detail: string; vendorName: string; vendorUid: string; approvalStatus: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending'>('pending');
  const [open, setOpen] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      if (mode === 'fleet') {
        const vehicles = await loadAdminVehicles();
        setRecords(vehicles.filter(vehicle => vehicle.approvalStatus !== 'approved').map(vehicle => ({ id: vehicle.id, label: vehicle.registrationNumber, detail: `${vehicle.vehicleType} · ${vehicle.capacity || 'Capacity not set'}`, vendorName: vehicle.vendorName || 'Unknown vendor', vendorUid: vehicle.vendorUid, approvalStatus: vehicle.approvalStatus })));
      } else {
        const drivers = await loadAdminDrivers();
        setRecords(drivers.filter(driver => driver.approvalStatus !== 'approved').map(driver => ({ id: driver.id, label: driver.name, detail: driver.phone || 'No phone number', vendorName: driver.vendorName || 'Unknown vendor', vendorUid: driver.vendorUid, approvalStatus: driver.approvalStatus })));
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
      onApprove?.();
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Unable to approve record.');
    } finally {
      setBusyId(null);
    }
  };

  const filteredRecords = filter === 'pending' ? records : records;

  if (loading || !filteredRecords.length) return null;

  if (iconOnly) {
    return <>
      <a className="action-link" href="#" onClick={(e) => { e.preventDefault(); setOpen(true); }} aria-label={`${mode === 'fleet' ? 'Approve vehicles' : 'Approve drivers'}`} title={`${filteredRecords.length} pending`} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true); } }}>
        {mode === 'fleet' ? <Truck size={20} /> : <Users size={20} />}
        {filteredRecords.length > 0 && <span className="icon-badge">{filteredRecords.length}</span>}
      </a>
      {open && <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && setOpen(false)}>
        <section className="modal approval-modal" role="dialog" aria-modal="true" aria-labelledby="approval-dialog-title">
          <button className="modal-close" type="button" onClick={() => setOpen(false)} aria-label="Close approval list">×</button>
          <div className="table-head approval-modal-heading">
            <div><span className="eyebrow">Admin verification</span><h2 id="approval-dialog-title">{mode === 'fleet' ? 'Vehicle approvals' : 'Driver approvals'}</h2></div>
            <div className="status-filter-stats"><span>{filteredRecords.length} pending</span></div>
          </div>
          <div className="table-scroll approval-table-scroll">
            <table>
              <caption className="sr-only">MongoDB {mode === 'fleet' ? 'vehicle' : 'driver'} approvals</caption>
              <thead><tr><th scope="col">{mode === 'fleet' ? 'Registration' : 'Name'}</th><th scope="col">{mode === 'fleet' ? 'Vehicle Type' : 'Contact'}</th><th scope="col">Vendor</th><th scope="col">Status</th><th scope="col">Action</th></tr></thead>
              <tbody>{filteredRecords.map(record => <tr key={record.id}><td><b>{record.label}</b><small className="mono">{record.id.slice(0, 16)}...</small></td><td>{record.detail}<small>{mode === 'fleet' ? 'Capacity included' : 'Phone verified'}</small></td><td><b>{record.vendorName}</b><small>{record.vendorUid}</small></td><td><Status>{record.approvalStatus}</Status></td><td><Button variant="primary" icon={Check} onClick={() => void approve(record.id)} disabled={busyId === record.id}>{busyId === record.id ? 'Approving...' : 'Approve'}</Button></td></tr>)}</tbody>
            </table>
          </div>
        </section>
      </div>}
    </>;
  }

  return <>
    <div className="approval-launcher">
      <Button variant="primary" icon={mode === 'fleet' ? Truck : Users} onClick={() => setOpen(true)}>
        {mode === 'fleet' ? 'Approve vehicle' : 'Approve driver'} <span className="approval-count">{filteredRecords.length}</span>
      </Button>
    </div>
    {open && <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && setOpen(false)}>
      <section className="modal approval-modal" role="dialog" aria-modal="true" aria-labelledby="approval-dialog-title">
        <button className="modal-close" type="button" onClick={() => setOpen(false)} aria-label="Close approval list">×</button>
        <div className="table-head approval-modal-heading">
          <div><span className="eyebrow">Admin verification</span><h2 id="approval-dialog-title">{mode === 'fleet' ? 'Vehicle approvals' : 'Driver approvals'}</h2></div>
          <div className="status-filter-stats"><span>{filteredRecords.length} pending</span></div>
        </div>
        <div className="table-scroll approval-table-scroll">
          <table>
            <caption className="sr-only">MongoDB {mode === 'fleet' ? 'vehicle' : 'driver'} approvals</caption>
            <thead><tr><th scope="col">{mode === 'fleet' ? 'Registration' : 'Name'}</th><th scope="col">{mode === 'fleet' ? 'Vehicle Type' : 'Contact'}</th><th scope="col">Vendor</th><th scope="col">Status</th><th scope="col">Action</th></tr></thead>
            <tbody>{filteredRecords.map(record => <tr key={record.id}><td><b>{record.label}</b><small className="mono">{record.id.slice(0, 16)}...</small></td><td>{record.detail}<small>{mode === 'fleet' ? 'Capacity included' : 'Phone verified'}</small></td><td><b>{record.vendorName}</b><small>{record.vendorUid}</small></td><td><Status>{record.approvalStatus}</Status></td><td><Button variant="primary" icon={Check} onClick={() => void approve(record.id)} disabled={busyId === record.id}>{busyId === record.id ? 'Approving...' : 'Approve'}</Button></td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </div>}
  </>;
}
