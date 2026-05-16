import { useState, useEffect, useCallback, useRef } from 'react';
import BookingModal from './BookingModal';

interface Slot {
  _id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'available' | 'booked' | 'blocked';
}

const SITE_BASE_URL = import.meta.env.DEV ? '' : import.meta.env.SITE.replace(/\/$/, '');

// Whole-hour tour slots (no half-hours)
const TOUR_HOURS = [10, 11, 12, 13, 14, 15];

function startOfMonth(y: number, m: number): Date {
  return new Date(y, m, 1);
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate();
}

function isSunday(y: number, m: number, d: number): boolean {
  return new Date(y, m, d).getDay() === 0;
}

function isoDate(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function formatMonthYear(y: number, m: number): string {
  return new Date(y, m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatTime(t: string): string {
  const [h] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return `${hr}:00 ${period}`;
}

export default function BookingCalendar() {
  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [slots,  setSlots]  = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const timeSlotsRef = useRef<HTMLDivElement>(null);

  // Fetch slots for the visible month
  const fetchSlots = useCallback(async (y: number, m: number) => {
    setLoading(true);
    setFetchError('');
    try {
      const start = isoDate(y, m, 1);
      const end   = isoDate(y, m, daysInMonth(y, m));
      const res = await fetch(
        `${SITE_BASE_URL}/.netlify/functions/get-slots?startDate=${start}&endDate=${end}`,
      );
      if (!res.ok) throw new Error('Unable to load availability');
      const data = await res.json();
      setSlots(Array.isArray(data) ? data : (data.slots ?? []));
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load calendar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSlots(year, month); }, [year, month, fetchSlots]);

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
    setSelectedDate(null);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
    setSelectedDate(null);
  };

  const slotsForDate = (date: string) => slots.filter(s => s.date === date);

  const getSlotForHour = (date: string, hour: number): Slot | undefined =>
    slots.find(s => s.date === date && parseInt(s.startTime.split(':')[0], 10) === hour);

  const handleDayClick = (date: string) => {
    setSelectedDate(prev => prev === date ? null : date);
  };

  // Scroll to the time slots panel AFTER it has rendered (selectedDate state change triggers re-render first)
  useEffect(() => {
    if (selectedDate && timeSlotsRef.current) {
      timeSlotsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selectedDate]);

  const handleSlotClick = (slot: Slot) => {
    if (slot.status === 'available') setSelectedSlot(slot);
  };

  const handleBookingSuccess = (slotId: string) => {
    // Optimistically mark slot as booked in the calendar
    setSlots(prev => prev.map(s => s._id === slotId ? { ...s, status: 'booked' } : s));
    // Do NOT auto-close — the modal shows a success screen; user closes it with "Done"
  };

  // Calendar grid
  const firstDay = startOfMonth(year, month).getDay(); // 0=Sun
  const totalDays = daysInMonth(year, month);
  const todayIso = isoDate(today.getFullYear(), today.getMonth(), today.getDate());

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];

  return (
    <div className="booking-cal" aria-label="Tour booking calendar">
      {/* Month nav */}
      <div className="booking-cal__header">
        <button
          className="booking-cal__nav"
          onClick={prevMonth}
          aria-label="Previous month"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
        <h2 className="booking-cal__month" aria-live="polite">
          {formatMonthYear(year, month)}
        </h2>
        <button
          className="booking-cal__nav"
          onClick={nextMonth}
          aria-label="Next month"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>
      </div>

      {/* Loading / error */}
      {loading && (
        <div className="booking-cal__status" role="status" aria-live="polite">
          Loading availability…
        </div>
      )}
      {fetchError && (
        <div className="booking-cal__error" role="alert">{fetchError}</div>
      )}

      {/* Day-of-week headers */}
      <div className="booking-cal__grid booking-cal__grid--header" aria-hidden="true">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="booking-cal__dow">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="booking-cal__grid booking-cal__grid--days" role="grid">
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} className="booking-cal__cell booking-cal__cell--empty" role="gridcell" />;

          const date   = isoDate(year, month, day);
          const sunday = isSunday(year, month, day);
          const past   = date < todayIso;
          const active = date === selectedDate;
          const daySlots = slotsForDate(date);
          const hasAvailable = daySlots.some(s => s.status === 'available');

          let cellClass = 'booking-cal__cell';
          if (past)  cellClass += ' booking-cal__cell--disabled';
          else if (hasAvailable) cellClass += ' booking-cal__cell--available';
          else if (sunday)      cellClass += ' booking-cal__cell--sunday';
          if (active)           cellClass += ' is-selected';
          if (date === todayIso) cellClass += ' is-today';

          return (
            <div key={date} className={cellClass} role="gridcell">
              <button
                className="booking-cal__day-btn"
                onClick={() => !past && handleDayClick(date)}
                disabled={past}
                aria-label={`${date}${hasAvailable ? ', tours available' : !past ? ', no tours listed' : ''}`}
                aria-selected={active}
                aria-pressed={active}
              >
                <span className="booking-cal__day-num">{day}</span>
                {!past && (
                  <span className="booking-cal__dot" aria-hidden="true">
                    {hasAvailable ? '●' : '○'}
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="booking-cal__legend" aria-label="Calendar legend">
        <span className="legend-item legend-item--available">● Available</span>
        <span className="legend-item legend-item--none">○ No tours listed</span>
        <span className="legend-item legend-item--disabled">Past dates (unavailable)</span>
      </div>

      {/* Time slots panel */}
      {selectedDate && (
        <div className="booking-cal__times" aria-label={`Time slots for ${selectedDate}`} ref={timeSlotsRef}>
          <h3 className="booking-cal__times-title">
            Select a Time on{' '}
            {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
              weekday: 'long', month: 'long', day: 'numeric',
            })}
          </h3>
          <div className="booking-cal__slots">
            {TOUR_HOURS.map(hour => {
              const slot = getSlotForHour(selectedDate, hour);
              const available = slot?.status === 'available';
              const booked    = slot?.status === 'booked' || slot?.status === 'blocked';
              const noData    = !slot;

              return (
                <button
                  key={hour}
                  className={[
                    'booking-cal__slot',
                    available ? 'booking-cal__slot--available' : '',
                    booked    ? 'booking-cal__slot--booked'    : '',
                    noData    ? 'booking-cal__slot--no-data'   : '',
                  ].join(' ')}
                  onClick={() => slot && handleSlotClick(slot)}
                  disabled={!available}
                  aria-label={`${formatTime(`${hour}:00`)} – ${formatTime(`${hour + 1}:00`)}: ${available ? 'Book this slot' : booked ? 'Already booked' : 'Not available'}`}
                >
                  <span className="booking-cal__slot-time">
                    {formatTime(`${hour}:00`)} – {formatTime(`${hour + 1}:00`)}
                  </span>
                  <span className="booking-cal__slot-status">
                    {available ? 'Available' : booked ? 'Booked' : 'N/A'}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="booking-cal__slot-note">
            Don&rsquo;t see what you need?{' '}
            <a href="/contact/">Contact us</a> and we&rsquo;ll work something out.
          </p>
        </div>
      )}

      {/* Booking modal */}
      {selectedSlot && (
        <BookingModal
          slot={selectedSlot}
          onClose={() => setSelectedSlot(null)}
          onSuccess={handleBookingSuccess}
        />
      )}

      <style>{`
        .booking-cal { 
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: var(--space-6);
          margin-top: var(--space-6);
          background: var(--color-white);
          max-width: 700px; 
          margin: 0 auto;
        }
        .booking-cal__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--space-5);
        }
        .booking-cal__month {
          font-family: var(--font-heading);
          font-size: var(--text-2xl);
          color: var(--color-primary-dark);
          text-align: center;
          margin: 0;
        }
        .booking-cal__nav {
          background: var(--color-gray-100);
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-md);
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: var(--color-primary-dark);
          transition: background var(--transition-fast);
        }
        .booking-cal__nav:hover { background: var(--color-gray-200); }
        .booking-cal__status {
          text-align: center;
          color: var(--color-text-muted);
          padding: var(--space-3);
          font-size: var(--text-sm);
        }
        .booking-cal__error {
          background: #fef2f2;
          color: #b91c1c;
          border: 1px solid #fecaca;
          border-radius: var(--radius-md);
          padding: var(--space-3) var(--space-4);
          margin-bottom: var(--space-4);
          font-size: var(--text-sm);
        }
        .booking-cal__grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
        }
        .booking-cal__grid--header {
          margin-bottom: var(--space-2);
        }
        .booking-cal__dow {
          text-align: center;
          font-size: var(--text-xs);
          font-weight: 700;
          text-transform: uppercase;
          color: var(--color-text-muted);
          padding: var(--space-2) 0;
        }
        .booking-cal__cell {
          aspect-ratio: 1;
          display: flex;
          align-items: stretch;
        }
        .booking-cal__cell--empty {}
        .booking-cal__day-btn {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          background: none;
          border: 1.5px solid transparent;
          border-radius: var(--radius-md);
          cursor: default;
          font-size: var(--text-sm);
          color: var(--color-text-muted);
          margin: 2px;
        }
        .booking-cal__cell--available .booking-cal__day-btn {
          cursor: pointer;
          color: var(--color-available);
          border-color: var(--color-available);
          background: rgba(45,122,64,0.05);
          font-weight: 700;
        }
        .booking-cal__cell--available .booking-cal__day-btn:hover,
        .booking-cal__cell.is-selected .booking-cal__day-btn {
          background: var(--color-available);
          color: white;
          border-color: var(--color-available);
        }
        .booking-cal__cell--sunday .booking-cal__day-btn {
          cursor: pointer;
          color: var(--color-primary);
          border-color: var(--color-border);
        }
        .booking-cal__cell--sunday .booking-cal__day-btn:hover {
          background: var(--color-gray-100);
        }
        .booking-cal__cell--disabled .booking-cal__day-btn {
          opacity: 0.35;
          cursor: not-allowed;
        }
        .booking-cal__cell.is-today .booking-cal__day-btn {
          font-weight: 900;
        }
        .booking-cal__day-num { font-size: var(--text-base); }
        .booking-cal__dot { font-size: 8px; line-height: 1; }
        /* Legend */
        .booking-cal__legend {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-4);
          margin-top: var(--space-5);
          margin-bottom: var(--space-6);
          font-size: var(--text-xs);
          color: var(--color-text-muted);
        }
        .legend-item--available { color: var(--color-available); font-weight: 700; }
        /* Times panel */
        .booking-cal__times {
          margin-top: var(--space-6);
        }
        .booking-cal__times-title {
          font-size: var(--text-lg);
          color: var(--color-primary-dark);
          margin-bottom: var(--space-5);
        }
        .booking-cal__slots {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(125px, 1fr));
          gap: var(--space-3);
          margin-bottom: var(--space-4);
        }
        .booking-cal__slot {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: var(--space-3);
          border-radius: var(--radius-md);
          border: 1.5px solid var(--color-border);
          background: var(--color-gray-100);
          font-size: var(--text-sm);
          cursor: not-allowed;
          transition: all var(--transition-fast);
        }
        .booking-cal__slot--available {
          border-color: var(--color-available);
          background: rgba(45,122,64,0.07);
          cursor: pointer;
          color: var(--color-available);
        }
        .booking-cal__slot--available:hover {
          background: var(--color-available);
          color: white;
          border-color: var(--color-available);
        }
        .booking-cal__slot--booked {
          color: var(--color-text-muted);
          opacity: 0.55;
        }
        .booking-cal__slot-time { font-weight: 700; white-space: nowrap; }
        .booking-cal__slot-status { font-size: var(--text-xs); margin-top: 2px; }
        .booking-cal__slot-note {
          font-size: var(--text-sm);
          color: var(--color-text-muted);
          margin: 0;
        }
        @container main (width < 600px) {
          .booking-calendar-wrap {
            --padding-x: 0;
          }
        }
      `}</style>
    </div>
  );
}
