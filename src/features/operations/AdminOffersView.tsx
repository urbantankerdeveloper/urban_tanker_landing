import { Droplets, Package, Plus, RefreshCcw, X } from 'lucide-react';
import { Button, PageHeader, Status } from '../../shared/components/ui';
import { Pagination } from '../../shared/components/Pagination';
import type { Offer } from '../../shared/lib/types';
import { createAdminOffer, deleteAdminOffer, loadAdminOffers, updateAdminOffer, updateAdminOfferStatus } from '../../shared/lib/cloudStore';
import { useState, useEffect, type FormEvent } from 'react';

function OffersSkeleton() {
  return (
    <div className="admin-skeleton-page" aria-busy="true" aria-live="polite" aria-label="Loading offers">
      <div className="skeleton-heading admin-skeleton-heading" />
      <div className="skeleton-copy admin-skeleton-copy" />
      <div className="admin-skeleton-list">
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="admin-skeleton-card" key={index}>
            <div className="admin-skeleton-icon" />
            <div className="admin-skeleton-body">
              <div className="admin-skeleton-line admin-skeleton-line-lg" />
              <div className="admin-skeleton-line admin-skeleton-line-md" />
              <div className="admin-skeleton-line admin-skeleton-line-sm" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminOffersView({ onNotify }: { onNotify: (message: string) => void }) {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
  const [formData, setFormData] = useState({
    service: 'Water tanker',
    title: '',
    description: '',
    discount: '',
    minOrder: '',
    validFrom: new Date().toISOString().slice(0, 10),
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    icon: 'Package',
    color: 'aqua'
  });

  const loadOffers = async () => {
    try {
      setLoading(true);
      const data = await loadAdminOffers();
      setOffers(data);
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Unable to load offers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOffers();
  }, []);

  const visibleOffers = offers.slice((page - 1) * 10, page * 10);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      if (editingOffer) {
        await updateAdminOffer(editingOffer.id, formData);
        onNotify('Offer updated successfully.');
      } else {
        await createAdminOffer(formData);
        onNotify('Offer created successfully.');
      }
      setFormOpen(false);
      setEditingOffer(null);
      setFormData({
        service: 'Water tanker',
        title: '',
        description: '',
        discount: '',
        minOrder: '',
        validFrom: new Date().toISOString().slice(0, 10),
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        icon: 'Package',
        color: 'aqua'
      });
      await loadOffers();
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Unable to save offer.');
    }
  };

  const handleEdit = (offer: Offer) => {
    setEditingOffer(offer);
    setFormData({
      service: offer.service,
      title: offer.title,
      description: offer.description,
      discount: offer.discount,
      minOrder: offer.minOrder,
      validFrom: offer.validFrom,
      validUntil: offer.validUntil,
      icon: offer.icon,
      color: offer.color
    });
    setFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this offer?')) return;
    try {
      await deleteAdminOffer(id);
      onNotify('Offer deleted successfully.');
      await loadOffers();
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Unable to delete offer.');
    }
  };

  const handleToggleActive = async (offer: Offer) => {
    try {
      await updateAdminOfferStatus(offer.id, !offer.active);
      await loadOffers();
      onNotify(offer.active ? 'Offer deactivated.' : 'Offer activated.');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Unable to update offer status.');
    }
  };

  const iconOptions = ['Droplets', 'Package', 'RefreshCcw', 'Gift', 'Star', 'Zap'];
  const colorOptions = ['aqua', 'green', 'gold', 'orange', 'red', 'purple'];

  if (loading) return <OffersSkeleton />;

  return (
    <>
      <PageHeader
        eyebrow="Admin workspace · Offers"
        title="Manage promotional offers"
        copy="Create and manage special offers for your customers to increase bookings."
        action={
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => {
              setEditingOffer(null);
              setFormData({
                service: 'Water tanker',
                title: '',
                description: '',
                discount: '',
                minOrder: '',
                validFrom: new Date().toISOString().slice(0, 10),
                validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
                icon: 'Package',
                color: 'aqua'
              });
              setFormOpen(true);
            }}
          >
            Add offer
          </Button>
        }
      />

      <div className="data-surface">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Current offers</span>
            <h2>{offers.length} offers</h2>
          </div>
        </div>

        {offers.length ? (
          <>
            <div className="order-list">
              {visibleOffers.map(offer => (
                <article key={offer.id} className="order-row">
                  <div className="order-service-icon" style={{ backgroundColor: `var(--${offer.color === 'aqua' ? 'aqua' : offer.color === 'green' ? 'green' : 'orange'})20` }}>
                    {offer.icon === 'Droplets' ? <Droplets size={19} /> : <Package size={19} />}
                  </div>
                  <div className="order-main">
                    <div>
                      <b>{offer.title}</b>
                      <Status>{offer.active ? 'Active' : 'Inactive'}</Status>
                    </div>
                    <span>{offer.service} · {offer.discount}</span>
                    <small>{offer.validFrom} to {offer.validUntil}</small>
                  </div>
                  <div className="order-amount">
                    <div className="order-inline-actions">
                      <button type="button" onClick={() => void handleToggleActive(offer)} title={offer.active ? 'Deactivate' : 'Activate'}>
                        {offer.active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button type="button" onClick={() => handleEdit(offer)} title="Edit">
                        Edit
                      </button>
                      <button type="button" onClick={() => void handleDelete(offer.id)} title="Delete">
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <Pagination page={page} pageSize={10} total={offers.length} onPageChange={setPage} />
          </>
        ) : (
          <div className="empty-state">
            <h3>No offers created yet</h3>
            <p>Start by creating your first promotional offer.</p>
            <Button variant="primary" icon={Plus} onClick={() => setFormOpen(true)}>
              Create first offer
            </Button>
          </div>
        )}
      </div>

      {formOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && setFormOpen(false)}>
          <section className="modal address-form-modal" role="dialog" aria-modal="true">
            <button className="modal-close" type="button" onClick={() => setFormOpen(false)} aria-label="Close form">
              ×
            </button>
            <span className="eyebrow">Manage Offer</span>
            <h2>{editingOffer ? 'Edit offer' : 'Create new offer'}</h2>
            <form className="auth-form" onSubmit={handleSubmit}>
              <label>
                Service
                <select value={formData.service} onChange={e => setFormData({ ...formData, service: e.target.value })} required>
                  <option>Water tanker</option>
                  <option>Sewage pickup</option>
                  <option>Both</option>
                </select>
              </label>
              <label>
                Title
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., 10% Off on Water Delivery"
                  required
                />
              </label>
              <label>
                Description
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe the offer details"
                  rows={3}
                  required
                />
              </label>
              <div className="field-row">
                <label>
                  Discount
                  <input
                    type="text"
                    value={formData.discount}
                    onChange={e => setFormData({ ...formData, discount: e.target.value })}
                    placeholder="e.g., 10% off, ₹500 off"
                    required
                  />
                </label>
                <label>
                  Minimum Order
                  <input
                    type="text"
                    value={formData.minOrder}
                    onChange={e => setFormData({ ...formData, minOrder: e.target.value })}
                    placeholder="e.g., 3 KL or more"
                  />
                </label>
              </div>
              <div className="field-row">
                <label>
                  Valid From
                  <input
                    type="date"
                    value={formData.validFrom}
                    onChange={e => setFormData({ ...formData, validFrom: e.target.value })}
                    required
                  />
                </label>
                <label>
                  Valid Until
                  <input
                    type="date"
                    value={formData.validUntil}
                    onChange={e => setFormData({ ...formData, validUntil: e.target.value })}
                    required
                  />
                </label>
              </div>
              <div className="field-row">
                <label>
                  Icon
                  <select value={formData.icon} onChange={e => setFormData({ ...formData, icon: e.target.value })}>
                    {iconOptions.map(icon => (
                      <option key={icon} value={icon}>
                        {icon}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Color
                  <select value={formData.color} onChange={e => setFormData({ ...formData, color: e.target.value })}>
                    {colorOptions.map(color => (
                      <option key={color} value={color}>
                        {color.charAt(0).toUpperCase() + color.slice(1)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="heading-actions">
                <button type="button" className="btn-quiet" onClick={() => setFormOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingOffer ? 'Update offer' : 'Create offer'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
