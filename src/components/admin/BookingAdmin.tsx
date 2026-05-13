import { useState, useEffect } from 'react';
import './BookingAdmin.css';

const netlifyIdentity = window.netlifyIdentity!;

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
    netlifyIdentity.init({ APIUrl: 'https://lowernotleyhallfarm.netlify.app/.netlify/identity' });
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

    </div>
  );
}
