import { useState, useEffect } from 'react';

import netlifyIdentity from 'netlify-identity-widget';

interface Slot {
  _id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'available' | 'booked' | 'blocked';
  booking?: {
    name: string;
    email: string;
    phone?: string;
    partySize?: number;
    message?: string;
    bookedAt: string;
  };
}

function fmt(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}
function fmtTime(t: string) {
  const [h] = t.split(':').map(Number);
  return `${h % 12 || 12}:00 ${h >= 12 ? 'PM' : 'AM'}`;
}

export default function BookingAdmin() {
  const [user, setUser] = useState<unknown>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  // Add-slot form
  const [newDate, setNewDate] = useState('');
  const [newStart, setNewStart] = useState('10:00');
  const [newStatus, setNewStatus] = useState<'available' | 'blocked'>('available');
  const [adding, setAdding] = useState(false);

  // Auth
  useEffect(() => {
    netlifyIdentity.init();
    const current = netlifyIdentity.currentUser();
    setUser(current);
    netlifyIdentity.on('login', (u: unknown) => { setUser(u); netlifyIdentity.close(); });
    netlifyIdentity.on('logout', () => setUser(null));
  }, []);

  const authHeader = () => {
    const token = (netlifyIdentity.currentUser() as { token?: { access_token: string } })?.token?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchSlots = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/.netlify/functions/admin-bookings', {
        headers: authHeader() as HeadersInit,
      });
      if (!res.ok) throw new Error('Could not load bookings');
      const data = await res.json();
      setSlots(data.slots ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchSlots();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const flash = (text: string) => { setMsg(text); setTimeout(() => setMsg(''), 3500); };

  const updateSlot = async (id: string, body: Record<string, unknown>) => {
    const res = await fetch('/.netlify/functions/admin-slot', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(authHeader() as HeadersInit) },
      body: JSON.stringify({ id, ...body }),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Update failed');
    await fetchSlots();
  };

  const deleteSlot = async (id: string) => {
    if (!confirm('Delete this slot permanently?')) return;
    const res = await fetch('/.netlify/functions/admin-slot', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...(authHeader() as HeadersInit) },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Delete failed');
    await fetchSlots();
    flash('Slot deleted');
  };

  const addSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      const endHour = parseInt(newStart.split(':')[0], 10) + 1;
      const endTime = `${String(endHour).padStart(2, '0')}:00`;
      const res = await fetch('/.netlify/functions/admin-slot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authHeader() as HeadersInit) },
        body: JSON.stringify({ date: newDate, startTime: newStart, endTime, status: newStatus }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Create failed');
      await fetchSlots();
      flash('Slot added');
      setNewDate('');
    } catch (e) {
      flash(`Error: ${e instanceof Error ? e.message : 'Unknown'}`);
    } finally {
      setAdding(false);
    }
  };

  // Not logged in
  if (!user) {
    return (
      <div className="admin-login">
        <h2>Admin Login Required</h2>
        <p>Please log in with Netlify Identity to manage bookings.</p>
        <button
          className="btn btn--primary"
          onClick={() => netlifyIdentity.open('login')}
        >
          Log In
        </button>
      </div>
    );
  }

  return (
    <div className="booking-admin">
      <div className="booking-admin__topbar">
        <h1 className="booking-admin__title">Booking Management</h1>
        <button
          className="btn btn--ghost btn--sm"
          onClick={() => netlifyIdentity.logout()}
        >
          Log Out
        </button>
      </div>

      {msg && <div className="booking-admin__msg" role="status">{msg}</div>}
      {error && <div className="booking-admin__error" role="alert">{error}</div>}

      {/* Add slot form */}
      <section className="booking-admin__section">
        <h2 className="booking-admin__section-title">Add Tour Slot</h2>
        <form className="booking-admin__add-form" onSubmit={addSlot}>
          <div className="form-group">
            <label className="form-label" htmlFor="a-date">Date</label>
            <input
              className="form-input"
              type="date"
              id="a-date"
              required
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="a-start">Start Time</label>
            <select
              className="form-select"
              id="a-start"
              value={newStart}
              onChange={e => setNewStart(e.target.value)}
            >
              {[10, 11, 12, 13, 14, 15].map(h => (
                <option key={h} value={`${String(h).padStart(2,'0')}:00`}>
                  {fmtTime(`${h}:00`)} – {fmtTime(`${h+1}:00`)}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="a-status">Status</label>
            <select
              className="form-select"
              id="a-status"
              value={newStatus}
              onChange={e => setNewStatus(e.target.value as 'available' | 'blocked')}
            >
              <option value="available">Available</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={adding}
          >
            {adding ? 'Adding…' : 'Add Slot'}
          </button>
        </form>
      </section>

      {/* Slots table */}
      <section className="booking-admin__section">
        <div className="booking-admin__section-header">
          <h2 className="booking-admin__section-title">All Slots</h2>
          <button className="btn btn--ghost btn--sm" onClick={fetchSlots} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        {slots.length === 0 && !loading ? (
          <p className="booking-admin__empty">No slots found. Add some above.</p>
        ) : (
          <div className="booking-admin__table-wrap">
            <table className="booking-admin__table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Status</th>
                  <th>Guest</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {slots.map(slot => (
                  <tr key={slot._id} className={`admin-row admin-row--${slot.status}`}>
                    <td>{fmt(slot.date)}</td>
                    <td className="admin-td-time">
                      {fmtTime(slot.startTime)} – {fmtTime(slot.endTime)}
                    </td>
                    <td>
                      <span className={`admin-badge admin-badge--${slot.status}`}>
                        {slot.status}
                      </span>
                    </td>
                    <td className="admin-td-guest">
                      {slot.booking ? (
                        <details>
                          <summary>{slot.booking.name}</summary>
                          <ul className="admin-guest-details">
                            <li><strong>Email:</strong> {slot.booking.email}</li>
                            {slot.booking.phone && <li><strong>Phone:</strong> {slot.booking.phone}</li>}
                            {slot.booking.partySize && <li><strong>Party:</strong> {slot.booking.partySize}</li>}
                            {slot.booking.message && <li><strong>Message:</strong> {slot.booking.message}</li>}
                            <li><strong>Booked:</strong> {new Date(slot.booking.bookedAt).toLocaleString()}</li>
                          </ul>
                        </details>
                      ) : '—'}
                    </td>
                    <td className="admin-td-actions">
                      {slot.status === 'available' && (
                        <button
                          className="admin-btn admin-btn--block"
                          onClick={() => updateSlot(slot._id, { status: 'blocked' }).then(() => flash('Slot blocked'))}
                        >Block</button>
                      )}
                      {slot.status === 'blocked' && (
                        <button
                          className="admin-btn admin-btn--unblock"
                          onClick={() => updateSlot(slot._id, { status: 'available' }).then(() => flash('Slot unblocked'))}
                        >Unblock</button>
                      )}
                      {slot.status === 'booked' && (
                        <button
                          className="admin-btn admin-btn--unbook"
                          onClick={() => updateSlot(slot._id, { unbook: true }).then(() => flash('Booking cancelled'))}
                        >Unbook</button>
                      )}
                      <button
                        className="admin-btn admin-btn--delete"
                        onClick={() => deleteSlot(slot._id)}
                      >Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <style>{`
        .admin-login {
          text-align: center;
          padding: var(--space-16) var(--space-4);
        }
        .admin-login h2 {
          font-size: var(--text-3xl);
          color: var(--color-primary-dark);
          margin-bottom: var(--space-4);
        }
        .admin-login p {
          color: var(--color-text-muted);
          margin-bottom: var(--space-6);
        }
        .booking-admin { max-width: 1100px; margin: 0 auto; padding: var(--space-8) var(--space-4); }
        .booking-admin__topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--space-8);
          gap: var(--space-4);
        }
        .booking-admin__title {
          font-size: var(--text-4xl);
          color: var(--color-primary-dark);
          margin: 0;
        }
        .booking-admin__msg {
          background: #ecfdf5;
          color: #166534;
          border: 1px solid #bbf7d0;
          border-radius: var(--radius-md);
          padding: var(--space-3) var(--space-4);
          margin-bottom: var(--space-5);
          font-size: var(--text-sm);
        }
        .booking-admin__error {
          background: #fef2f2;
          color: #b91c1c;
          border: 1px solid #fecaca;
          border-radius: var(--radius-md);
          padding: var(--space-3) var(--space-4);
          margin-bottom: var(--space-5);
          font-size: var(--text-sm);
        }
        .booking-admin__section {
          background: var(--color-white);
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-xl);
          padding: var(--space-6);
          margin-bottom: var(--space-8);
          box-shadow: var(--shadow-sm);
        }
        .booking-admin__section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--space-5);
        }
        .booking-admin__section-title {
          font-size: var(--text-2xl);
          color: var(--color-primary-dark);
          margin: 0 0 var(--space-5);
        }
        .booking-admin__section-header .booking-admin__section-title { margin: 0; }
        .booking-admin__add-form {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: var(--space-4);
          align-items: end;
        }
        .booking-admin__empty {
          color: var(--color-text-muted);
          text-align: center;
          padding: var(--space-8) 0;
        }
        .booking-admin__table-wrap { overflow-x: auto; }
        .booking-admin__table {
          width: 100%;
          border-collapse: collapse;
          font-size: var(--text-sm);
        }
        .booking-admin__table th {
          background: var(--color-primary-dark);
          color: white;
          padding: var(--space-3) var(--space-4);
          text-align: left;
          font-size: var(--text-xs);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .booking-admin__table td {
          padding: var(--space-3) var(--space-4);
          border-bottom: 1px solid var(--color-border);
          vertical-align: top;
        }
        .admin-row--available { background: rgba(45,122,64,0.04); }
        .admin-row--booked    { background: rgba(37,74,175,0.04); }
        .admin-row--blocked   { background: rgba(100,100,100,0.04); }
        .admin-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: var(--radius-full);
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
        }
        .admin-badge--available { background: #dcfce7; color: #166534; }
        .admin-badge--booked    { background: #dbeafe; color: #1e40af; }
        .admin-badge--blocked   { background: #f1f5f9; color: #64748b; }
        .admin-td-time { white-space: nowrap; }
        .admin-td-guest details summary { cursor: pointer; font-weight: 700; }
        .admin-guest-details {
          list-style: none;
          padding: var(--space-2) 0 0;
          font-size: 12px;
          color: var(--color-text-muted);
        }
        .admin-guest-details li { margin-bottom: 4px; }
        .admin-td-actions { white-space: nowrap; display: flex; gap: var(--space-2); flex-wrap: wrap; }
        .admin-btn {
          padding: 4px 10px;
          border-radius: var(--radius-sm);
          border: 1px solid;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: opacity var(--transition-fast);
        }
        .admin-btn:hover { opacity: 0.8; }
        .admin-btn--block   { border-color: #94a3b8; background: #f1f5f9; color: #334155; }
        .admin-btn--unblock { border-color: #86efac; background: #dcfce7; color: #166534; }
        .admin-btn--unbook  { border-color: #93c5fd; background: #dbeafe; color: #1e40af; }
        .admin-btn--delete  { border-color: #fca5a5; background: #fee2e2; color: #b91c1c; }
      `}</style>
    </div>
  );
}
