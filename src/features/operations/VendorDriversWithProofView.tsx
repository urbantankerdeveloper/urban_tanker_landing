import { Trash2, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, PageHeader, Status } from '../../shared/components/ui';
import { createVendorDriver, deleteVendorDriver, loadVendorDrivers, setVendorDriverStatus } from '../../shared/lib/cloudStore';

type Driver = { id: string; name: string; phone: string; active: boolean; address?: string; addressProof?: string };

export function VendorDriversWithProofView({ onNotify }: { onNotify: (message: string) => void }) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [open, setOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Driver | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', address: '', addressProof: '' });
  const [errors, setErrors] = useState({ name: '', phone: '', address: '' });

  const refresh = () => void loadVendorDrivers().then(setDrivers).catch(error => onNotify(error instanceof Error ? error.message : 'Unable to load drivers.'));
  useEffect(refresh, [onNotify]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = form.name.trim();
    const phone = form.phone.trim();
    const address = form.address.trim();
    const nextErrors = {
      name: /^[A-Za-z][A-Za-z .'-]{1,59}$/.test(name) ? '' : 'Use 2-60 letters, spaces, apostrophes, periods, or hyphens.',
      phone: /^[6-9]\d{9}$/.test(phone) ? '' : 'Use a valid 10-digit Indian mobile number.',
      address: address.length >= 5 && address.length <= 250 ? '' : 'Driver address is required and must be 5-250 characters.',
    };
    setErrors(nextErrors);
    if (nextErrors.name || nextErrors.phone || nextErrors.address) return;
    try {
      await createVendorDriver({ name, phone, address, addressProof: form.addressProof });
      setForm({ name: '', phone: '', address: '', addressProof: '' });
      setErrors({ name: '', phone: '', address: '' });
      setOpen(false);
      refresh();
      onNotify('Driver added to your team.');
    } catch (error) { onNotify(error instanceof Error ? error.message : 'Unable to create driver.'); }
  };

  const toggle = async (driver: Driver) => {
    try { await setVendorDriverStatus(driver.id, !driver.active); refresh(); }
    catch (error) { onNotify(error instanceof Error ? error.message : 'Unable to update driver status.'); }
  };
  const remove = async (driver: Driver, confirmed = false) => {
    if (!confirmed) { setDeleteTarget(driver); return; }
    try { await deleteVendorDriver(driver.id); refresh(); onNotify('Driver deleted.'); }
    catch (error) { onNotify(error instanceof Error ? error.message : 'Unable to delete driver.'); }
    finally { setDeleteTarget(null); }
  };

  return <>
    <PageHeader eyebrow="Vendor workspace · Drivers" title="Manage your drivers." copy="Create and manage drivers independently from vehicles. Assign both only when accepting an order." action={<Button variant="primary" icon={Users} onClick={() => setOpen(true)}>Add driver</Button>} />
    <div className="order-list">{drivers.length ? drivers.map(driver => <article className="order-row" key={driver.id}><div className="order-service-icon"><Users size={19} /></div><div className="order-main"><div><b>{driver.name}</b><Status>{driver.active ? 'Active' : 'Inactive'}</Status></div><span>{driver.phone}</span><small>{driver.address} · {driver.addressProof ? 'Proof uploaded' : 'Proof optional'}</small></div><Button variant={driver.active ? 'quiet' : 'primary'} onClick={() => void toggle(driver)}>{driver.active ? 'Set inactive' : 'Set active'}</Button><Button variant="quiet" icon={Trash2} onClick={() => void remove(driver)}>Delete</Button></article>) : <div className="empty-state"><Users size={28} /><h3>No drivers yet</h3><p>Add a driver before accepting delivery orders.</p></div>}</div>
    {open && <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && setOpen(false)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="driver-dialog-title"><button className="modal-close" type="button" onClick={() => setOpen(false)} aria-label="Close driver form">×</button><span className="eyebrow">Driver management</span><h2 id="driver-dialog-title">Add driver</h2><p className="modal-copy">Driver address is required; proof can be added later.</p><form className="auth-form" onSubmit={submit} noValidate><label>Driver name<input aria-invalid={Boolean(errors.name)} value={form.name} onChange={event => { setForm({ ...form, name: event.target.value.slice(0, 60) }); setErrors({ ...errors, name: '' }); }} maxLength={60} required />{errors.name && <small className="field-error" role="alert">{errors.name}</small>}</label><label>Phone number<input aria-invalid={Boolean(errors.phone)} value={form.phone} onChange={event => { setForm({ ...form, phone: event.target.value.replace(/\D/g, '').slice(0, 10) }); setErrors({ ...errors, phone: '' }); }} inputMode="numeric" maxLength={10} placeholder="10-digit mobile number" required />{errors.phone && <small className="field-error" role="alert">{errors.phone}</small>}</label><label>Driver address<textarea aria-invalid={Boolean(errors.address)} value={form.address} onChange={event => { setForm({ ...form, address: event.target.value.slice(0, 250) }); setErrors({ ...errors, address: '' }); }} maxLength={250} rows={3} placeholder="Residential or dispatch address" required />{errors.address && <small className="field-error" role="alert">{errors.address}</small>}</label><label>Address proof <small>(optional image or PDF)</small><input type="file" accept="image/*,.pdf,application/pdf" onChange={event => { const file = event.target.files?.[0]; if (!file) return; if ((!file.type.startsWith('image/') && file.type !== 'application/pdf') || file.size > 3_000_000) { event.target.value = ''; onNotify('Proof must be an image or PDF smaller than 3 MB.'); return; } const reader = new FileReader(); reader.onload = () => setForm(current => ({ ...current, addressProof: typeof reader.result === 'string' ? reader.result : '' })); reader.readAsDataURL(file); }} /></label><div className="heading-actions"><Button variant="quiet" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" type="submit">Add driver</Button></div></form></section></div>}
    {deleteTarget && <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && setDeleteTarget(null)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="delete-driver-title"><button className="modal-close" type="button" onClick={() => setDeleteTarget(null)} aria-label="Close delete confirmation">×</button><span className="eyebrow">Confirm deletion</span><h2 id="delete-driver-title">Delete {deleteTarget.name}?</h2><p className="modal-copy">This removes the driver and clears any vehicle assignment. This action cannot be undone.</p><div className="heading-actions"><Button variant="quiet" onClick={() => setDeleteTarget(null)}>Cancel</Button><Button variant="primary" onClick={() => void remove(deleteTarget, true)}>Delete driver</Button></div></section></div>}
  </>;
}
