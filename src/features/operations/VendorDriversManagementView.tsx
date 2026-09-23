import { Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, PageHeader, Status } from '../../shared/components/ui';
import { createVendorDriver, loadVendorDrivers, setVendorDriverStatus } from '../../shared/lib/cloudStore';

type Driver = { id: string; name: string; phone: string; active: boolean; address?: string; addressProof?: string };

export function VendorDriversManagementView({ onNotify }: { onNotify: (message: string) => void }) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', address: '', addressProof: '' });
  const [fieldErrors, setFieldErrors] = useState({ name: '', phone: '', address: '' });

  const refresh = () => void loadVendorDrivers().then(setDrivers).catch(error => onNotify(error instanceof Error ? error.message : 'Unable to load drivers.'));
  useEffect(refresh, [onNotify]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFieldErrors({ name: '', phone: '', address: '' });
    const name = form.name.trim();
    const phone = form.phone.trim();
    const address = form.address.trim();
    const nextErrors = {
      name: /^[A-Za-z][A-Za-z .'-]{1,59}$/.test(name) ? '' : 'Use 2-60 letters, spaces, apostrophes, periods, or hyphens.',
      phone: /^[6-9]\d{9}$/.test(phone) ? '' : 'Use a valid 10-digit Indian mobile number.',
      address: address.length >= 5 && address.length <= 250 ? '' : 'Driver address is required and must be 5-250 characters.',
    };
    if (nextErrors.name || nextErrors.phone || nextErrors.address) { setFieldErrors(nextErrors); return; }
    try {
      await createVendorDriver({ name, phone, address, addressProof: form.addressProof });
      setForm({ name: '', phone: '', address: '', addressProof: '' });
      setFieldErrors({ name: '', phone: '', address: '' });
      setOpen(false);
      refresh();
      onNotify('Driver added to your team.');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Unable to create driver.');
    }
  };

  const toggle = async (driver: Driver) => {
    try { await setVendorDriverStatus(driver.id, !driver.active); refresh(); }
    catch (error) { onNotify(error instanceof Error ? error.message : 'Unable to update driver status.'); }
  };

  return <>
    <PageHeader eyebrow="Vendor workspace · Drivers" title="Manage your drivers." copy="Create and manage drivers independently from vehicles. Assign both only when accepting an order." action={<Button variant="primary" icon={Users} onClick={() => setOpen(true)}>Add driver</Button>} />
    <div className="order-list">
      {drivers.length ? drivers.map(driver => <article className="order-row" key={driver.id}>
        <div className="order-service-icon"><Users size={19} /></div>
        <div className="order-main"><div><b>{driver.name}</b><Status>{driver.active ? 'Active' : 'Inactive'}</Status></div><span>{driver.phone}</span><small>{driver.address || 'Address not recorded'} · {driver.addressProof ? 'Proof uploaded' : 'Proof optional'} · Vehicle assigned during acceptance</small></div>
        <Button variant={driver.active ? 'quiet' : 'primary'} onClick={() => void toggle(driver)}>{driver.active ? 'Set inactive' : 'Set active'}</Button>
      </article>) : <div className="empty-state"><Users size={28} /><h3>No drivers yet</h3><p>Add a driver before accepting delivery orders.</p></div>}
    </div>
    {open && <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && setOpen(false)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="driver-dialog-title"><button className="modal-close" type="button" onClick={() => setOpen(false)} aria-label="Close driver form">×</button><span className="eyebrow">Driver management</span><h2 id="driver-dialog-title">Add driver</h2><p className="modal-copy">Driver details stay independent from fleet vehicles.</p><form className="auth-form" onSubmit={submit} noValidate><label>Driver name<input aria-invalid={Boolean(fieldErrors.name)} value={form.name} onChange={event => { setForm({ ...form, name: event.target.value.slice(0, 60) }); setFieldErrors({ ...fieldErrors, name: '' }); }} minLength={2} maxLength={60} pattern="[A-Za-z][A-Za-z .'-]{1,59}" autoComplete="name" required />{fieldErrors.name && <small className="field-error" role="alert">{fieldErrors.name}</small>}</label><label>Phone number<input aria-invalid={Boolean(fieldErrors.phone)} value={form.phone} onChange={event => { setForm({ ...form, phone: event.target.value.replace(/\D/g, '').slice(0, 10) }); setFieldErrors({ ...fieldErrors, phone: '' }); }} inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} autoComplete="tel" placeholder="10-digit mobile number" required />{fieldErrors.phone && <small className="field-error" role="alert">{fieldErrors.phone}</small>}</label><label>Driver address<textarea aria-invalid={Boolean(fieldErrors.address)} value={form.address} onChange={event => { setForm({ ...form, address: event.target.value.slice(0, 250) }); setFieldErrors({ ...fieldErrors, address: '' }); }} minLength={5} maxLength={250} rows={3} placeholder="Residential or dispatch address" required />{fieldErrors.address && <small className="field-error" role="alert">{fieldErrors.address}</small>}</label><div className="heading-actions"><Button variant="quiet" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" type="submit">Add driver</Button></div></form></section></div>}
  </>;
}
