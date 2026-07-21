import { useState, useCallback, useRef, useEffect } from 'react';
import {
  buildGoogleCalendarUrl,
  buildIcsDownloadUrl,
  formatCalendarDateLabel,
  formatCalendarTimeLabel,
} from '../../lib/calendar-links';

interface BookingModalProps {
  slot: { _id: string; date: string; startTime: string; endTime: string } | null;
  onClose: () => void;
  onSuccess: (slotId: string) => void;
  bookingBufferHours?: number;
}

const SITE_BASE_URL = import.meta.env.DEV ? '' : import.meta.env.SITE.replace(/\/$/, '');
const PUBLIC_SITE_BASE_URL = (import.meta.env.SITE || '').replace(/\/$/, '');

function formatTime(t: string): string {
  return formatCalendarTimeLabel(t);
}

function formatDate(d: string): string {
  return formatCalendarDateLabel(d);
}

export default function BookingModal({ slot, onClose, onSuccess, bookingBufferHours }: BookingModalProps) {
  const [form, setForm] = useState({
    name: '', email: '', phone: '', partySize: '', message: '',
  });
  const [errors, setErrors] = useState({ name: '', email: '' });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'apology' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [apologyMsg, setApologyMsg] = useState('');
  // Defer close capability by one frame so the click that opened the modal
  // cannot immediately trigger the backdrop's onClose handler.
  const [canClose, setCanClose] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setCanClose(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    // Clear the field's error as the user types
    if (e.target.name === 'name') setErrors(prev => ({ ...prev, name: '' }));
    if (e.target.name === 'email') setErrors(prev => ({ ...prev, email: '' }));
  };

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!slot) return;

    // Read from the DOM directly so browser-autofilled values are captured
    // even if React's onChange didn't fire for them.
    const fd = new FormData(e.currentTarget);
    const name    = ((fd.get('name')      as string) ?? '').trim();
    const email   = ((fd.get('email')     as string) ?? '').trim();
    const phone   = ((fd.get('phone')     as string) ?? '').trim();
    const partySz = ((fd.get('partySize') as string) ?? '').trim();
    const message = ((fd.get('message')   as string) ?? '').trim();

    const nameErr  = name ? '' : 'Please enter your full name.';
    const emailErr = !email
      ? 'Please enter your email address.'
      : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ? 'Please enter a valid email address.'
        : '';
    setErrors({ name: nameErr, email: emailErr });
    if (nameErr || emailErr) return;

    setStatus('loading');
    setErrorMsg('');

    try {
      const res = await fetch(`${SITE_BASE_URL}/.netlify/functions/create-tour-booking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotId: slot._id,
          name,
          email,
          phone: phone || undefined,
          partySize: partySz ? parseInt(partySz, 10) : undefined,
          message: message || undefined,
        }),
      });

      if (res.status === 409) {
        const data = await res.json().catch(() => ({}));
        if (data?.code === 'BOOKING_WINDOW_ELAPSED' || data?.code === 'HOLIDAY_MODE_ACTIVE') {
          setStatus('apology');
          setApologyMsg(
            `We're sorry, this tour time is no longer available for online booking. Please contact Jack and Cindy on the contact page and they will help you directly.${bookingBufferHours ? ` (Current booking window: ${bookingBufferHours} hours.)` : ''}`,
          );
          return;
        }

        setStatus('error');
        setErrorMsg(data?.error || 'This time slot was just booked by someone else. Please select another time.');
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Booking failed');
      }

      const calendarTitle = `Tour at Lower Notley Hall Farm${name ? ` with ${name}` : ''}`;
      const calendarDescription = [
        `Guest: ${name}`,
        `Email: ${email}`,
        phone ? `Phone: ${phone}` : '',
        message ? `Notes: ${message}` : '',
      ].filter(Boolean).join('\n');
      const googleCalendarUrl = buildGoogleCalendarUrl({
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        title: calendarTitle,
        description: calendarDescription,
      });
      const icsDownloadUrl = buildIcsDownloadUrl({
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        title: calendarTitle,
        description: calendarDescription,
        filename: `lnhf-tour-${slot.date}-${slot.startTime}`,
      }, PUBLIC_SITE_BASE_URL);

      // Notify via Netlify Forms (non-critical)
      const formData = new URLSearchParams({
        'form-name': 'tour-booking',
        'slot-id': slot._id,
        'slot-date-iso': slot.date,
        'slot-start-time': slot.startTime,
        'slot-end-time': slot.endTime,
        'name': name,
        'email': email,
        'phone': phone,
        'date': formatDate(slot.date),
        'time': `${formatTime(slot.startTime)} – ${formatTime(slot.endTime)}`,
        'party-size': partySz,
        'subject': `Tour Request: ${name} for ${formatDate(slot.date)}`,
        'message': message,
        'add-to-google-calendar': googleCalendarUrl,
        'download-ics-calendar': icsDownloadUrl,
      });
      fetch(`${SITE_BASE_URL}/`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: formData.toString() })
        .catch(() => { /* non-critical */ });

      setStatus('success');
      onSuccess(slot._id as string);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.');
    }
  }, [slot, onSuccess]);
  if (!slot) return null;

  return (
    <div
      className="booking-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="booking-modal__backdrop"
        onClick={() => { if (canClose) onClose(); }}
      />

      <div className="booking-modal__panel" onClick={(e) => e.stopPropagation()}>
        <button className="booking-modal__close" onClick={onClose} aria-label="Close booking form">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>

        {status === 'success' ? (
          <div className="booking-modal__success" role="status">
            <div className="booking-modal__success-icon" aria-hidden="true">✓</div>
            <h2 className="booking-modal__success-title">You're Booked!</h2>
            <p>
              Your tour is requested for <strong>{formatDate(slot.date)}</strong> at{' '}
              <strong>{formatTime(slot.startTime)} – {formatTime(slot.endTime)}</strong>.
            </p>
            <p>We'll follow up at <strong>{form.email}</strong> to confirm. See you soon!</p>
            <button className="btn btn--primary" onClick={onClose}>Done</button>
          </div>
        ) : status === 'apology' ? (
          <div className="booking-modal__success" role="status">
            <div className="booking-modal__success-icon" aria-hidden="true">!</div>
            <h2 className="booking-modal__success-title">We're Sorry</h2>
            <p>{apologyMsg}</p>
            <p>
              Please visit <a href="/contact/">/contact/</a> to reach Jack and Cindy.
            </p>
            <button className="btn btn--primary" onClick={onClose}>Done</button>
          </div>
        ) : (
          <>
            <div className="booking-modal__header">
              <h2 className="booking-modal__title" id="modal-title">Book Your Tour</h2>
              <p className="booking-modal__slot-info">
                <strong>{formatDate(slot.date)}</strong>
                <br />
                {formatTime(slot.startTime)} – {formatTime(slot.endTime)}
              </p>
            </div>

            <form
              className="booking-modal__form"
              onSubmit={handleSubmit}
              noValidate
              aria-label="Tour booking form"
            >
              <div className="booking-modal__grid">
                <div className="form-group">
                  <label className="form-label" htmlFor="bm-name">
                    Full Name <span className="required" aria-hidden="true">*</span>
                  </label>
                  <input
                    className={`form-input${errors.name ? ' form-input--error' : ''}`}
                    type="text"
                    id="bm-name"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    required
                    autoComplete="name"
                    aria-required="true"
                    aria-describedby="bm-name-error"
                    aria-invalid={!!errors.name}
                    placeholder="Your full name"
                    disabled={status === 'loading'}
                  />
                  {errors.name && <span className="form-error" id="bm-name-error" role="alert">{errors.name}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="bm-email">
                    Email Address <span className="required" aria-hidden="true">*</span>
                  </label>
                  <input
                    className={`form-input${errors.email ? ' form-input--error' : ''}`}
                    type="email"
                    id="bm-email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    required
                    autoComplete="email"
                    aria-required="true"
                    aria-describedby="bm-email-error"
                    aria-invalid={!!errors.email}
                    placeholder="your@email.com"
                    disabled={status === 'loading'}
                  />
                  {errors.email && <span className="form-error" id="bm-email-error" role="alert">{errors.email}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="bm-phone">Phone Number</label>
                  <input
                    className="form-input"
                    type="tel"
                    id="bm-phone"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    autoComplete="tel"
                    placeholder="(301) 555-0100"
                    disabled={status === 'loading'}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="bm-party">Estimated Party Size</label>
                  <select
                    className="form-select"
                    id="bm-party"
                    name="partySize"
                    value={form.partySize}
                    onChange={handleChange}
                    disabled={status === 'loading'}
                    aria-label="Estimated number of guests"
                  >
                    <option value="">Select size</option>
                    <option value="1">Just browsing</option>
                    <option value="25">Under 25</option>
                    <option value="50">25 – 50</option>
                    <option value="100">50 – 100</option>
                    <option value="150">100 – 150</option>
                  </select>
                </div>

                <div className="form-group booking-modal__full">
                  <label className="form-label" htmlFor="bm-message">Message or Questions</label>
                  <textarea
                    className="form-textarea"
                    id="bm-message"
                    name="message"
                    value={form.message}
                    onChange={handleChange}
                    rows={3}
                    maxLength={1000}
                    placeholder="Tell us about your vision or ask any questions…"
                    disabled={status === 'loading'}
                  />
                </div>
              </div>

              {status === 'error' && (
                <div className="booking-modal__error" role="alert">
                  <strong>Error: </strong>{errorMsg}
                </div>
              )}

              <div className="booking-modal__actions">
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={status === 'loading'}
                  aria-busy={status === 'loading'}
                  data-umami-event="Confirm Tour Booking"
                >
                  {status === 'loading' ? 'Booking…' : 'Confirm Booking'}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={onClose}
                  disabled={status === 'loading'}
                >
                  Cancel
                </button>
              </div>
            </form>
          </>
        )}
      </div>

      <style>{`
        .booking-modal {
          position: fixed;
          inset: 0;
          z-index: 200;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--space-4);
        }
        .booking-modal__backdrop {
          position: absolute;
          inset: 0;
          background: rgba(10,20,50,0.7);
          backdrop-filter: blur(3px);
        }
        .booking-modal__panel {
          position: relative;
          z-index: 1;
          background: var(--color-white);
          border-radius: var(--radius-xl);
          box-shadow: var(--shadow-xl);
          width: 100%;
          max-width: 560px;
          max-height: 90vh;
          overflow-y: auto;
          padding: var(--space-8);
        }
        .booking-modal__close {
          position: absolute;
          top: var(--space-4);
          right: var(--space-4);
          background: var(--color-gray-100);
          border: none;
          border-radius: var(--radius-full);
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: var(--color-text-muted);
          transition: background var(--transition-fast);
        }
        .booking-modal__close:hover { background: var(--color-gray-200); }
        .booking-modal__header {
          margin-bottom: var(--space-6);
          padding-right: var(--space-8);
        }
        .booking-modal__title {
          font-size: var(--text-2xl);
          color: var(--color-primary-dark);
          margin-bottom: var(--space-2);
        }
        .booking-modal__slot-info {
          color: var(--color-primary);
          font-size: var(--text-base);
          margin: 0;
          background: var(--color-cream);
          padding: var(--space-3) var(--space-4);
          border-radius: var(--radius-md);
          border-left: 4px solid var(--color-accent);
        }
        .booking-modal__grid {
          display: grid;
          gap: var(--space-4);
          grid-template-columns: 1fr 1fr;
          margin-bottom: var(--space-4);
        }
        .booking-modal__full { grid-column: 1 / -1; }
        .booking-modal__error {
          background: #fef2f2;
          color: #b91c1c;
          border: 1px solid #fecaca;
          border-radius: var(--radius-md);
          padding: var(--space-3) var(--space-4);
          margin-bottom: var(--space-4);
          font-size: var(--text-sm);
        }
        .form-error {
          display: block;
          margin-top: 4px;
          font-size: 12px;
          color: #b91c1c;
        }
        .form-input--error { border-color: #b91c1c; }
        .booking-modal__actions {
          display: flex;
          gap: var(--space-3);
          flex-wrap: wrap;
        }
        /* Success state */
        .booking-modal__success {
          text-align: center;
          padding: var(--space-8) var(--space-4);
        }
        .booking-modal__success-icon {
          width: 64px;
          height: 64px;
          background: var(--color-available);
          color: white;
          border-radius: var(--radius-full);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2rem;
          margin: 0 auto var(--space-6);
        }
        .booking-modal__success-title {
          font-size: var(--text-3xl);
          color: var(--color-primary-dark);
          margin-bottom: var(--space-4);
        }
        .booking-modal__success p {
          color: var(--color-text-muted);
          margin-bottom: var(--space-3);
        }
        @media (max-width: 480px) {
          .booking-modal__grid { grid-template-columns: 1fr; }
          .booking-modal__panel { padding: var(--space-6) var(--space-4); }
        }
      `}</style>
    </div>
  );
}
