import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type ColumnFiltersState,
  type FilterFn,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import BackToPortal from './BackToPortal';

const netlifyIdentity = window.netlifyIdentity!;
const SITE_BASE_URL = import.meta.env.DEV ? '' : import.meta.env.SITE.replace(/\/$/, '');

interface TourSlot {
  _id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'available' | 'booked' | 'blocked';
  visitorVisibility?: 'visible' | 'holiday_mode' | 'booking_buffer' | 'not_applicable';
  visitorVisibilityDetail?: string | null;
  tour?: {
    name: string;
    email: string;
    phone?: string;
    partySize?: number;
    message?: string;
    bookedAt: string;
  };
}

interface TourTimeSlotOption {
  tourStart: string;
  tourEnd: string;
}

interface TourFormErrors {
  newDate?: string;
  timeRange?: string;
  guestName?: string;
  guestEmail?: string;
}

interface SeedSyncResult {
  insertedCount: number;
  deletedCount: number;
  seededTemplates: number;
  horizonMonths: number;
  windowStart: string;
  windowEnd: string;
  syncedAt: string;
}

interface TourCalendarSettings {
  bookingBufferHours: 12 | 24 | 36 | 48;
  holidayMode: 'off' | 'range' | 'indefinite';
  holidayStartAt: string | null;
  holidayEndAt: string | null;
  holidayMessageHtml: string | null;
}

const DEFAULT_TIME_SLOT_OPTIONS: TourTimeSlotOption[] = [
  { tourStart: '13:00', tourEnd: '14:00' },
  { tourStart: '14:00', tourEnd: '15:00' },
  { tourStart: '15:00', tourEnd: '16:00' },
];

function toDateTimeLocalValue(isoValue: string | null) {
  if (!isoValue) return '';
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return '';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function fromDateTimeLocalValue(localValue: string) {
  if (!localValue) return null;
  const dt = new Date(localValue);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}

function fmtDate(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function fmtTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

const columnHelper = createColumnHelper<TourSlot>();

const globalFilterFn: FilterFn<TourSlot> = (row, _columnId, filterValue: string) => {
  const term = filterValue.toLowerCase();
  const slot = row.original;
  return (
    fmtDate(slot.date).toLowerCase().includes(term) ||
    fmtTime(slot.startTime).toLowerCase().includes(term) ||
    slot.status.toLowerCase().includes(term) ||
    (slot.tour?.name ?? '').toLowerCase().includes(term) ||
    (slot.tour?.email ?? '').toLowerCase().includes(term)
  );
};

export default function ToursAdmin({ timeSlotOptions }: { timeSlotOptions?: TourTimeSlotOption[] }) {
  const adminMsg = useRef<HTMLDivElement>(null);
  const [initialized, setInitialized] = useState(false);
  const [user, setUser] = useState<unknown>(null);
  const [slots, setSlots] = useState<TourSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const sortedTimeSlotOptions = useMemo(() => {
    const source = (timeSlotOptions && timeSlotOptions.length > 0)
      ? timeSlotOptions
      : DEFAULT_TIME_SLOT_OPTIONS;

    return source
      .filter((slot) => /^\d{2}:\d{2}$/.test(slot.tourStart) && /^\d{2}:\d{2}$/.test(slot.tourEnd))
      .sort((a, b) => a.tourStart.localeCompare(b.tourStart));
  }, [timeSlotOptions]);

  const [newDate, setNewDate] = useState('');
  const [newStart, setNewStart] = useState(sortedTimeSlotOptions[0]?.tourStart ?? '13:00');
  const [newEnd, setNewEnd] = useState(sortedTimeSlotOptions[0]?.tourEnd ?? '14:00');
  const [newStatus, setNewStatus] = useState<'available' | 'blocked' | 'booked'>('available');
  const [adding, setAdding] = useState(false);
  const [newTour, setNewTour] = useState({ name: '', email: '', phone: '', partySize: '', message: '' });
  const [tourFormErrors, setTourFormErrors] = useState<TourFormErrors>({});

  const [globalFilter, setGlobalFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'date', desc: false }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });

  const [exportFrom, setExportFrom] = useState('');
  const [exportTo, setExportTo] = useState('');
  const [exportFmt, setExportFmt] = useState<'csv' | 'xlsx' | 'ods'>('csv');
  const [exporting, setExporting] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SeedSyncResult | null>(null);

  const [calendarSettings, setCalendarSettings] = useState<TourCalendarSettings>({
    bookingBufferHours: 24,
    holidayMode: 'off',
    holidayStartAt: null,
    holidayEndAt: null,
    holidayMessageHtml: null,
  });
  const [holidayStartInput, setHolidayStartInput] = useState('');
  const [holidayEndInput, setHolidayEndInput] = useState('');
  const [holidayMessageHtmlInput, setHolidayMessageHtmlInput] = useState('');
  const [savingCalendarSettings, setSavingCalendarSettings] = useState(false);

  useEffect(() => {
    const hasMatchingSelection = sortedTimeSlotOptions.some(
      (slot) => slot.tourStart === newStart && slot.tourEnd === newEnd,
    );

    if (!hasMatchingSelection && sortedTimeSlotOptions.length > 0) {
      setNewStart(sortedTimeSlotOptions[0].tourStart);
      setNewEnd(sortedTimeSlotOptions[0].tourEnd);
    }
  }, [sortedTimeSlotOptions, newStart, newEnd]);

  const filteredExportBookedSlots = useMemo(() => {
    let booked = slots.filter((slot) => slot.status === 'booked');
    if (exportFrom) booked = booked.filter((slot) => slot.date >= exportFrom);
    if (exportTo) booked = booked.filter((slot) => slot.date <= exportTo);
    return booked;
  }, [slots, exportFrom, exportTo]);

  useEffect(() => {
    netlifyIdentity.on('init', (u: unknown) => {
      setUser(u);
      setInitialized(true);
    });
    netlifyIdentity.on('login', (u: unknown) => {
      setUser(u);
      netlifyIdentity.close();
    });
    netlifyIdentity.on('logout', () => setUser(null));
    netlifyIdentity.init({ APIUrl: 'https://lowernotleyhallfarm.netlify.app/.netlify/identity' });
  }, []);

  const authHeader = () => {
    const token = (netlifyIdentity.currentUser() as { token?: { access_token: string } })?.token?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const handleUnauthorized = () => {
    setUser(null);
    const maybeRefresh = (netlifyIdentity as unknown as { refresh?: () => Promise<unknown> }).refresh;
    if (maybeRefresh) {
      maybeRefresh().catch(() => netlifyIdentity.open('login'));
    } else {
      netlifyIdentity.open('login');
    }
  };

  const flash = (text: string) => {
    setMsg(text);
    setTimeout(() => setMsg(''), 5000);
  };

  const focusAndScrollToField = (id: string) => {
    const field = document.getElementById(id) as HTMLElement | null;
    if (!field) return;
    field.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if ('focus' in field && typeof field.focus === 'function') {
      field.focus();
    }
  };

  const fetchSlots = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${SITE_BASE_URL}/.netlify/functions/admin-tours`, {
        headers: authHeader() as HeadersInit,
      });
      if (res.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!res.ok) throw new Error('Could not load tours');
      const data = await res.json();
      setSlots(Array.isArray(data) ? data : data.slots ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const fetchCalendarSettings = async () => {
    try {
      const res = await fetch(`${SITE_BASE_URL}/.netlify/functions/admin-tour-calendar-settings`, {
        headers: authHeader() as HeadersInit,
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!res.ok) throw new Error('Could not load tour calendar settings');
      const data = await res.json();
      const settings = (data?.settings ?? null) as TourCalendarSettings | null;
      if (!settings) return;

      setCalendarSettings(settings);
      setHolidayStartInput(toDateTimeLocalValue(settings.holidayStartAt));
      setHolidayEndInput(toDateTimeLocalValue(settings.holidayEndAt));
      setHolidayMessageHtmlInput(settings.holidayMessageHtml ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error while loading tour calendar settings');
    }
  };

  useEffect(() => {
    if (user) {
      fetchSlots();
      fetchCalendarSettings();
    }
  }, [user]);

  const saveCalendarSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCalendarSettings(true);

    try {
      if (calendarSettings.holidayMode === 'range' && (!holidayStartInput || !holidayEndInput)) {
        throw new Error('Holiday range mode requires both a start and end date-time.');
      }

      const payload = {
        bookingBufferHours: Number(calendarSettings.bookingBufferHours),
        holidayMode: calendarSettings.holidayMode,
        holidayStartAt: calendarSettings.holidayMode === 'range' ? fromDateTimeLocalValue(holidayStartInput) : null,
        holidayEndAt: calendarSettings.holidayMode === 'range' ? fromDateTimeLocalValue(holidayEndInput) : null,
        holidayMessageHtml: holidayMessageHtmlInput.trim() || null,
      };

      const res = await fetch(`${SITE_BASE_URL}/.netlify/functions/admin-tour-calendar-settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(authHeader() as HeadersInit) },
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Unable to save tour calendar settings');

      const settings = (data?.settings ?? null) as TourCalendarSettings | null;
      if (settings) {
        setCalendarSettings(settings);
        setHolidayStartInput(toDateTimeLocalValue(settings.holidayStartAt));
        setHolidayEndInput(toDateTimeLocalValue(settings.holidayEndAt));
        setHolidayMessageHtmlInput(settings.holidayMessageHtml ?? '');
      }

      flash('Tour calendar settings updated');
    } catch (err) {
      flash(`Error: ${err instanceof Error ? err.message : 'Unable to save tour calendar settings.'}`);
    } finally {
      setSavingCalendarSettings(false);
    }
  };

  const updateSlot = async (id: string, body: Record<string, unknown>) => {
    const res = await fetch(`${SITE_BASE_URL}/.netlify/functions/admin-tour-slot`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(authHeader() as HeadersInit) },
      body: JSON.stringify({ id, ...body }),
    });
    if (res.status === 401) {
      handleUnauthorized();
      return;
    }
    if (!res.ok) throw new Error((await res.json()).error || 'Update failed');
    await fetchSlots();
  };

  const deleteSlot = async (id: string) => {
    if (!confirm('Delete this tour slot permanently?')) return;
    const res = await fetch(`${SITE_BASE_URL}/.netlify/functions/admin-tour-slot`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...(authHeader() as HeadersInit) },
      body: JSON.stringify({ id }),
    });
    if (res.status === 401) {
      handleUnauthorized();
      return;
    }
    if (!res.ok) throw new Error((await res.json()).error || 'Delete failed');
    await fetchSlots();
    flash('Tour slot deleted');
  };

  const addSlot = async (e: React.FormEvent) => {
    e.preventDefault();

    const nextErrors: TourFormErrors = {};
    if (!newDate) nextErrors.newDate = 'Date is required.';
    if (!newStart || !newEnd) nextErrors.timeRange = 'Select a valid time slot range.';
    if (newStatus === 'booked' && !newTour.name.trim()) nextErrors.guestName = 'Guest name is required when status is booked.';
    if (newStatus === 'booked' && !newTour.email.trim()) nextErrors.guestEmail = 'Guest email is required when status is booked.';

    if (Object.keys(nextErrors).length > 0) {
      setTourFormErrors(nextErrors);
      const firstInvalidFieldId = nextErrors.newDate
        ? 'tour-date'
        : nextErrors.timeRange
          ? 'tour-start'
        : nextErrors.guestName
          ? 'tour-guest-name'
          : nextErrors.guestEmail
            ? 'tour-guest-email'
            : undefined;
      if (firstInvalidFieldId) {
        requestAnimationFrame(() => focusAndScrollToField(firstInvalidFieldId));
      }
      return;
    }

    const duplicate = slots.some((slot) => slot.date === newDate && slot.startTime === newStart);

    if (duplicate) {
      flash(`A tour slot for ${fmtDate(newDate)} at ${fmtTime(newStart)} already exists.`);
      return;
    }

    setAdding(true);
    try {
      const payload: Record<string, unknown> = {
        date: newDate,
        startTime: newStart,
        endTime: newEnd,
        status: newStatus,
      };

      if (newStatus === 'booked') {
        payload.tour = {
          name: newTour.name,
          email: newTour.email,
          ...(newTour.phone ? { phone: newTour.phone } : {}),
          ...(newTour.partySize ? { partySize: Number(newTour.partySize) } : {}),
          ...(newTour.message ? { message: newTour.message } : {}),
        };
      }

      const res = await fetch(`${SITE_BASE_URL}/.netlify/functions/admin-tour-slot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authHeader() as HeadersInit) },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error((await res.json()).error || 'Create failed');
      await fetchSlots();
      flash('Tour slot added');
      setNewDate('');
      setNewStatus('available');
      const firstSlot = sortedTimeSlotOptions[0];
      if (firstSlot) {
        setNewStart(firstSlot.tourStart);
        setNewEnd(firstSlot.tourEnd);
      }
      setNewTour({ name: '', email: '', phone: '', partySize: '', message: '' });
      setTourFormErrors({});
    } catch (err) {
      flash(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setAdding(false);
    }
  };

  const exportTours = async () => {
    setExporting(true);
    try {
      if (filteredExportBookedSlots.length === 0) {
        flash('No booked tours found for the selected date range.');
        return;
      }

      const XLSX = await import('xlsx');

      const rows = filteredExportBookedSlots.map((slot) => ({
        Date: fmtDate(slot.date),
        'Start Time': fmtTime(slot.startTime),
        'End Time': fmtTime(slot.endTime),
        'Guest Name': slot.tour?.name ?? '',
        'Guest Email': slot.tour?.email ?? '',
        'Guest Phone': slot.tour?.phone ?? '',
        'Party Size': slot.tour?.partySize ?? '',
        Notes: slot.tour?.message ?? '',
        'Booked At': slot.tour?.bookedAt ? new Date(slot.tour.bookedAt).toLocaleString() : '',
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Tours');

      const dateStamp = new Date().toISOString().split('T')[0];
      const filename = `lnhf-tours-${dateStamp}.${exportFmt}`;
      const bookType = exportFmt === 'csv' ? 'csv' : exportFmt === 'ods' ? 'ods' : 'xlsx';
      XLSX.writeFile(wb, filename, { bookType });
    } catch (err) {
      flash(`Error: ${err instanceof Error ? err.message : 'Unable to export tours right now.'}`);
    } finally {
      setExporting(false);
    }
  };

  const runSeedSync = async () => {
    setSeeding(true);
    try {
      const res = await fetch(`${SITE_BASE_URL}/.netlify/functions/admin-seed-tour-slots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authHeader() as HeadersInit) },
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        const detail = typeof data?.details === 'string' && data.details.length > 0 ? ` (${data.details})` : '';
        throw new Error(`${data?.error || 'Seed sync failed'}${detail}`);
      }

      await fetchSlots();
      setLastSyncResult({
        insertedCount: Number(data.insertedCount ?? 0),
        deletedCount: Number(data.deletedCount ?? 0),
        seededTemplates: Number(data.seededTemplates ?? 0),
        horizonMonths: Number(data.horizonMonths ?? 0),
        windowStart: String(data.windowStart ?? ''),
        windowEnd: String(data.windowEnd ?? ''),
        syncedAt: new Date().toISOString(),
      });
      flash(`Seed sync complete. Added ${data.insertedCount ?? 0}, removed ${data.deletedCount ?? 0} future slot(s).`);
    } catch (err) {
      flash(`Error: ${err instanceof Error ? err.message : 'Unable to run seed sync.'}`);
    } finally {
      setSeeding(false);
    }
  };

  useEffect(() => {
    setColumnFilters(statusFilter ? [{ id: 'status', value: statusFilter }] : []);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [statusFilter]);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [globalFilter]);

  const columns = [
    columnHelper.accessor('date', {
      header: 'Date',
      cell: (info) => fmtDate(info.getValue()),
      sortingFn: 'alphanumeric',
    }),
    columnHelper.accessor((row) => row.startTime, {
      id: 'time',
      header: 'Time',
      cell: (info) => {
        const slot = info.row.original;
        return `${fmtTime(slot.startTime)} - ${fmtTime(slot.endTime)}`;
      },
      sortingFn: (a, b) => a.original.startTime.localeCompare(b.original.startTime),
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: (info) => {
        const slot = info.row.original;

        return (
          <>
          <div style={{ display: 'grid', justifyItems: 'start', gridTemplateColumns: 'repeat(auto-fit, minmax(50px, max-content))', gap: '0.35rem' }}>
            <span className={`admin-badge admin-badge--${info.getValue()}`}>{info.getValue()}</span>
            {slot.status === 'available' && slot.visitorVisibility === 'holiday_mode' && (
              <span className="admin-badge admin-badge--visitor-hidden">Hidden</span>
            )}
            {slot.status === 'available' && slot.visitorVisibility === 'booking_buffer' && (
              <span className="admin-badge admin-badge--visitor-limited">Hidden</span>
            )}
          </div>
          {slot.visitorVisibilityDetail && (
            <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', lineHeight: 1.4 }}>
              {slot.visitorVisibilityDetail}
            </span>
          )}
          </>
        );
      },
      filterFn: 'equals',
    }),
    columnHelper.accessor((row) => row.tour?.name ?? '', {
      id: 'guest',
      header: 'Guest',
      cell: (info) => {
        const slot = info.row.original;
        if (!slot.tour) return '—';
        return (
          <details>
            <summary>{slot.tour.name}</summary>
            <ul>
              <li><strong>Email:</strong> {slot.tour.email}</li>
              {slot.tour.phone && <li><strong>Phone:</strong> {slot.tour.phone}</li>}
              {slot.tour.partySize && <li><strong>Party:</strong> {slot.tour.partySize}</li>}
              {slot.tour.message && <li><strong>Notes:</strong> {slot.tour.message}</li>}
            </ul>
          </details>
        );
      },
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: (info) => {
        const slot = info.row.original;
        return (
          <div className="admin-td-actions">
            {slot.status === 'available' && (
              <button className="admin-btn admin-btn--muted" onClick={() => updateSlot(slot._id, { status: 'blocked' }).then(() => flash('Tour slot blocked'))}>
                Block
              </button>
            )}
            {slot.status === 'blocked' && (
              <button className="admin-btn admin-btn--good" onClick={() => updateSlot(slot._id, { status: 'available' }).then(() => flash('Tour slot unblocked'))}>
                Unblock
              </button>
            )}
            {slot.status === 'booked' && (
              <button className="admin-btn admin-btn--warn" onClick={() => updateSlot(slot._id, { unbook: true }).then(() => flash('Tour booking cancelled'))}>
                Unbook
              </button>
            )}
            <button className="admin-btn admin-btn--danger" onClick={() => deleteSlot(slot._id)}>
              Delete
            </button>
          </div>
        );
      },
    }),
  ];

  const table = useReactTable({
    data: slots,
    columns,
    state: { sorting, columnFilters, globalFilter, pagination },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    globalFilterFn,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const { pageIndex, pageSize } = table.getState().pagination;
  const totalFiltered = table.getFilteredRowModel().rows.length;
  const pageCount = table.getPageCount();

  if (!initialized) {
    return <div className="admin-login"><p>Loading...</p></div>;
  }

  if (!user) {
    return (
      <div className="admin-login">
        <h2>Admin Login Required</h2>
        <p>Please log in with Netlify Identity to manage tours.</p>
        <button className="btn btn--primary" onClick={() => netlifyIdentity.open('login')}>
          Log In
        </button>
      </div>
    );
  }

  return (
    <div className="admin-manager">
      <BackToPortal />
      <div className="admin-manager__topbar">
        <div>
          <h1 className="admin-manager__title">Tours Manager</h1>
          <p className="admin-manager__subtitle">Add, update, search, export, and manage tour slots.</p>
        </div>
        <button className="btn btn--secondary btn--sm" onClick={() => netlifyIdentity.logout()}>
          Log Out
        </button>
      </div>

      <div className="admin-manager__msg-container" aria-live="polite" ref={adminMsg}>
        {msg && <div className="admin-manager__msg">{msg}</div>}
        {error && <div className="admin-manager__error">{error}</div>}
      </div>

      <section className="admin-manager__section">
        <details className="admin-manager__export">
          <summary className="admin-manager__export-summary">
            <h2 className="admin-manager__section-title">Add Tour Slot</h2>
          </summary>
          <form className="admin-manager__add-form admin-manager__export-controls" onSubmit={addSlot} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="tour-date">Date</label>
            <input
              className={`form-input${tourFormErrors.newDate ? ' is-invalid' : ''}`}
              type="date"
              id="tour-date"
              required
              value={newDate}
              onChange={(e) => {
                const value = e.target.value;
                setNewDate(value);
                if (value) {
                  setTourFormErrors((prev) => ({ ...prev, newDate: undefined }));
                }
              }}
              min={new Date().toISOString().split('T')[0]}
              aria-invalid={Boolean(tourFormErrors.newDate)}
              aria-describedby={tourFormErrors.newDate ? 'tour-date-error' : undefined}
            />
            {tourFormErrors.newDate && <p className="admin-field-error" id="tour-date-error">{tourFormErrors.newDate}</p>}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="tour-start">Start Time</label>
            <select
              className={`form-select${tourFormErrors.timeRange ? ' is-invalid' : ''}`}
              id="tour-start"
              value={`${newStart}|${newEnd}`}
              onChange={(e) => {
                const [start, end] = e.target.value.split('|');
                setNewStart(start);
                setNewEnd(end);
                if (start && end) {
                  setTourFormErrors((prev) => ({ ...prev, timeRange: undefined }));
                }
              }}
              aria-invalid={Boolean(tourFormErrors.timeRange)}
              aria-describedby={tourFormErrors.timeRange ? 'tour-time-range-error' : undefined}
            >
              {sortedTimeSlotOptions.map((slot) => (
                <option key={`${slot.tourStart}-${slot.tourEnd}`} value={`${slot.tourStart}|${slot.tourEnd}`}>
                  {fmtTime(slot.tourStart)} - {fmtTime(slot.tourEnd)}
                </option>
              ))}
            </select>
            {tourFormErrors.timeRange && <p className="admin-field-error" id="tour-time-range-error">{tourFormErrors.timeRange}</p>}
            <details>
              <summary>How to Customize Time Slots</summary>
              <p>To customize the available time slot options, edit via the CMS by logging in at <a href={`${import.meta.env.SITE}admin/`} target="_blank" rel="noopener noreferrer">the admin panel</a> and navigating to the "Tour Time Slots" collection.</p>
            </details>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="tour-status">Status</label>
            <select className="form-select" id="tour-status" value={newStatus} onChange={(e) => setNewStatus(e.target.value as 'available' | 'blocked' | 'booked')}>
              <option value="available">Available</option>
              <option value="blocked">Blocked</option>
              <option value="booked">Booked (phone/walk-in)</option>
            </select>
          </div>

          {newStatus === 'booked' && (
            <fieldset className="admin-manager__fieldset admin-manager__add-form-guest-fieldset">
              <legend className="form-label">Guest Details</legend>
              <div className="admin-manager__other-contacts-collection">
                <div className="form-group">
                  <label className="form-label" htmlFor="tour-guest-name">Name *</label>
                  <input
                    className={`form-input${tourFormErrors.guestName ? ' is-invalid' : ''}`}
                    type="text"
                    id="tour-guest-name"
                    required
                    value={newTour.name}
                    onChange={(e) => {
                      const value = e.target.value;
                      setNewTour((prev) => ({ ...prev, name: value }));
                      if (value.trim()) {
                        setTourFormErrors((prev) => ({ ...prev, guestName: undefined }));
                      }
                    }}
                    aria-invalid={Boolean(tourFormErrors.guestName)}
                    aria-describedby={tourFormErrors.guestName ? 'tour-guest-name-error' : undefined}
                  />
                  {tourFormErrors.guestName && <p className="admin-field-error" id="tour-guest-name-error">{tourFormErrors.guestName}</p>}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="tour-guest-email">Email *</label>
                  <input
                    className={`form-input${tourFormErrors.guestEmail ? ' is-invalid' : ''}`}
                    type="email"
                    id="tour-guest-email"
                    required
                    value={newTour.email}
                    onChange={(e) => {
                      const value = e.target.value;
                      setNewTour((prev) => ({ ...prev, email: value }));
                      if (value.trim()) {
                        setTourFormErrors((prev) => ({ ...prev, guestEmail: undefined }));
                      }
                    }}
                    aria-invalid={Boolean(tourFormErrors.guestEmail)}
                    aria-describedby={tourFormErrors.guestEmail ? 'tour-guest-email-error' : undefined}
                  />
                  {tourFormErrors.guestEmail && <p className="admin-field-error" id="tour-guest-email-error">{tourFormErrors.guestEmail}</p>}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="tour-guest-phone">Phone</label>
                  <input className="form-input" type="tel" id="tour-guest-phone" value={newTour.phone} onChange={(e) => setNewTour((prev) => ({ ...prev, phone: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="tour-guest-party">Party Size</label>
                  <input className="form-input" type="number" id="tour-guest-party" min={1} value={newTour.partySize} onChange={(e) => setNewTour((prev) => ({ ...prev, partySize: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="tour-guest-msg">Notes</label>
                  <textarea className="form-input" id="tour-guest-msg" rows={3} value={newTour.message} onChange={(e) => setNewTour((prev) => ({ ...prev, message: e.target.value }))} />
                </div>
              </div>
            </fieldset>
          )}

            <div className="form-group is-button">
              <button type="submit" className="btn btn--primary" disabled={adding}>
                {adding ? 'Adding...' : 'Add Slot'}
              </button>
            </div>
          </form>
        </details>
      </section>

      <section className="admin-manager__section">
        <details className="admin-manager__export">
          <summary className="admin-manager__export-summary">
            <h2 className="admin-manager__section-title">Tour Calendar</h2>
          </summary>
          <form className="admin-manager__grid" style={{ padding: 'var(--space-4)' }} onSubmit={saveCalendarSettings}>
            <fieldset className="admin-manager__fieldset">
              <legend>Booking Window Buffer</legend>
              <p className="admin-manager__subtitle">
                This controls when visitors stop seeing a slot as available online. You can still manually add or book slots at any time.
              </p>
              <div className="form-group checks-vertical">
                {[12, 24, 36, 48].map((hours) => (
                  <label key={hours} className="form-label" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="radio"
                      name="booking-buffer-hours"
                      value={hours}
                      checked={Number(calendarSettings.bookingBufferHours) === hours}
                      onChange={() => setCalendarSettings((prev) => ({ ...prev, bookingBufferHours: hours as 12 | 24 | 36 | 48 }))}
                    />
                    {hours} hours
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="admin-manager__fieldset">
              <legend>Holiday Mode</legend>
              <p className="admin-manager__subtitle">
                Holiday mode disables the Tour Booking Calendar for visitors without deleting or changing saved slots and bookings that you or a visitor have already made.
              </p>

              <div className="form-group checks-vertical">
                <label className="form-label" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="radio"
                    name="holiday-mode"
                    value="off"
                    checked={calendarSettings.holidayMode === 'off'}
                    onChange={() => setCalendarSettings((prev) => ({ ...prev, holidayMode: 'off' }))}
                  />
                  Off (normal calendar behavior)
                </label>
                <label className="form-label" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="radio"
                    name="holiday-mode"
                    value="range"
                    checked={calendarSettings.holidayMode === 'range'}
                    onChange={() => setCalendarSettings((prev) => ({ ...prev, holidayMode: 'range' }))}
                  />
                  Disable booking for a date-time range
                </label>
                <label className="form-label" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="radio"
                    name="holiday-mode"
                    value="indefinite"
                    checked={calendarSettings.holidayMode === 'indefinite'}
                    onChange={() => setCalendarSettings((prev) => ({ ...prev, holidayMode: 'indefinite' }))}
                  />
                  Disable booking indefinitely
                </label>
              </div>

              {calendarSettings.holidayMode === 'range' && (
                <div className="admin-manager__other-contacts-collection">
                  <div className="form-group">
                    <label className="form-label" htmlFor="tour-holiday-start">Holiday start (date and time)</label>
                    <input
                      className="form-input"
                      type="datetime-local"
                      id="tour-holiday-start"
                      value={holidayStartInput}
                      onChange={(e) => setHolidayStartInput(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="tour-holiday-end">Holiday end (date and time)</label>
                    <input
                      className="form-input"
                      type="datetime-local"
                      id="tour-holiday-end"
                      value={holidayEndInput}
                      onChange={(e) => setHolidayEndInput(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </fieldset>

            <fieldset className="admin-manager__fieldset admin-manager__fieldset--wedding-notes">
              <legend>Holiday Message to Website Visitors (Optional)</legend>
              <p className="admin-manager__subtitle">
                This message appears above the public Tours Calendar when present. Plain text only.
              </p>
              <div className="form-group">
                <label className="form-label" htmlFor="tour-holiday-message">Holiday message</label>
                <textarea
                  className="form-input"
                  id="tour-holiday-message"
                  rows={6}
                  value={holidayMessageHtmlInput}
                  onChange={(e) => setHolidayMessageHtmlInput(e.target.value)}
                />
              </div>
              {holidayMessageHtmlInput.trim() && (
                <div className="admin-manager__msg" style={{ whiteSpace: 'pre-line' }}>{holidayMessageHtmlInput}</div>
              )}
            </fieldset>

            <div className="admin-manager__actions-row">
              <button className="btn btn--primary" type="submit" disabled={savingCalendarSettings}>
                {savingCalendarSettings ? 'Saving...' : 'Save Tour Calendar Settings'}
              </button>
            </div>
          </form>
        </details>
      </section>

      <hr className="admin-manager__divider" />

      <section className="admin-manager__section">
        <div className="admin-manager__section-header">
          <h2 className="admin-manager__section-title">All Tour Slots</h2>
          <div style={{ display: 'flex', gap: '0.5rem', maxWidth: '300px', alignItems: 'start' }}>
            <div>
              <button className="btn btn--secondary btn--sm" onClick={runSeedSync} disabled={seeding || loading}>
                {seeding ? 'Syncing...' : 'Generate Future Slots'}
              </button>
              <details>
                <summary>What is this?</summary>
                <p>This will add future tour slots based on the templates you have set up (see the "Tour Time Slots" collection in <a href={`${import.meta.env.SITE}admin/`} target="_blank" rel="noopener noreferrer">the admin panel</a>) and remove any future slots that no longer fit the templates. It will not modify any past or currently booked slots.</p>
              </details>
            </div>
            <button className="btn btn--secondary btn--sm" onClick={fetchSlots} disabled={loading || seeding}>
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>

        {lastSyncResult && (
          <div className="admin-manager__msg" role="status" aria-live="polite">
            <strong>Last Sync Result:</strong>{' '}
            Added {lastSyncResult.insertedCount}, removed {lastSyncResult.deletedCount}, templates {lastSyncResult.seededTemplates},
            window {lastSyncResult.windowStart} to {lastSyncResult.windowEnd},
            ran {new Date(lastSyncResult.syncedAt).toLocaleString()}.
          </div>
        )}

        <details className="admin-manager__export">
          <summary className="admin-manager__export-summary">Export Booked Tours</summary>
          <div className="admin-manager__export-controls">
            <div className="form-group">
              <label className="form-label" htmlFor="tour-exp-from">From date</label>
              <input className="form-input" type="date" id="tour-exp-from" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)} max={exportTo || undefined} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="tour-exp-to">To date</label>
              <input className="form-input" type="date" id="tour-exp-to" value={exportTo} onChange={(e) => setExportTo(e.target.value)} min={exportFrom || undefined} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="tour-exp-fmt">Format</label>
              <select className="form-select" id="tour-exp-fmt" value={exportFmt} onChange={(e) => setExportFmt(e.target.value as 'csv' | 'xlsx' | 'ods')}>
                <option value="csv">CSV (.csv)</option>
                <option value="xlsx">Excel (.xlsx)</option>
                <option value="ods">OpenDocument (.ods)</option>
              </select>
            </div>
            <div className="form-group">
              <button className="btn btn--primary btn--sm" onClick={exportTours} disabled={exporting || filteredExportBookedSlots.length === 0}>
                {exporting ? 'Exporting...' : 'Download'}
              </button>
              <div className="admin-manager__export-count">{filteredExportBookedSlots.length} booked slot(s) in selected range</div>
            </div>
          </div>
        </details>

        <div className="table-controls">
          <input
            className="form-input table-search"
            type="search"
            placeholder="Search tour slots..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            aria-label="Search tour slots"
          />
          <select className="form-select table-status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter tour slots by status">
            <option value="">All statuses</option>
            <option value="available">Available</option>
            <option value="booked">Booked</option>
            <option value="blocked">Blocked</option>
          </select>
        </div>

        {slots.length === 0 && !loading ? (
          <p className="admin-manager__empty">No slots found. Add some above.</p>
        ) : (
          <>
            <div className="admin-manager__table-wrap">
              <table className="admin-manager__table">
                <thead>
                  {table.getHeaderGroups().map((group) => (
                    <tr key={group.id}>
                      {group.headers.map((header) => (
                        <th
                          key={header.id}
                          onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                          className={header.column.getCanSort() ? 'sortable-col' : ''}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getCanSort() && (
                            <span className="sort-icon" aria-hidden="true">
                              {header.column.getIsSorted() === 'asc' ? ' ▲' : header.column.getIsSorted() === 'desc' ? ' ▼' : ' ⇅'}
                            </span>
                          )}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length} className="admin-manager__empty">No tour slots match your filters.</td>
                    </tr>
                  ) : (
                    table.getRowModel().rows.map((row) => (
                      <tr key={row.id} className={`admin-row admin-row--${row.original.status}`}>
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="table-pagination">
              <span className="table-pagination__info">
                {totalFiltered === 0
                  ? 'No results'
                  : `Showing ${pageIndex * pageSize + 1}-${Math.min((pageIndex + 1) * pageSize, totalFiltered)} of ${totalFiltered}`}
              </span>
              <div className="table-pagination__controls">
                <button className="admin-btn" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()} aria-label="First page">
                  «
                </button>
                <button className="admin-btn" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Previous page">
                  ‹
                </button>
                <span className="table-pagination__page">Page {pageIndex + 1} of {pageCount || 1}</span>
                <button className="admin-btn" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Next page">
                  ›
                </button>
                <button className="admin-btn" onClick={() => table.setPageIndex(pageCount - 1)} disabled={!table.getCanNextPage()} aria-label="Last page">
                  »
                </button>
              </div>
              <select className="form-select table-pagination__size" value={pageSize} onChange={(e) => table.setPageSize(Number(e.target.value))} aria-label="Rows per page">
                {[10, 20, 50, 100].map((size) => (
                  <option key={size} value={size}>{size}/page</option>
                ))}
              </select>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
