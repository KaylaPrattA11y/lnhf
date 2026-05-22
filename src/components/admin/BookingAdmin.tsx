import { useState, useEffect, useRef } from 'react';
import './BookingAdmin.css';
import * as XLSX from 'xlsx';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  createColumnHelper,
  flexRender,
  type SortingState,
  type ColumnFiltersState,
  type FilterFn,
} from '@tanstack/react-table';

const netlifyIdentity = window.netlifyIdentity!;
const SITE_BASE_URL = import.meta.env.DEV ? '' : import.meta.env.SITE.replace(/\/$/, '');

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

const columnHelper = createColumnHelper<Slot>();

const globalFilterFn: FilterFn<Slot> = (row, _columnId, filterValue: string) => {
  const s = filterValue.toLowerCase();
  const slot = row.original;
  return (
    fmt(slot.date).toLowerCase().includes(s) ||
    fmtTime(slot.startTime).toLowerCase().includes(s) ||
    slot.status.toLowerCase().includes(s) ||
    (slot.booking?.name ?? '').toLowerCase().includes(s) ||
    (slot.booking?.email ?? '').toLowerCase().includes(s)
  );
};

export default function BookingAdmin() {
  const adminMsg = useRef<HTMLDivElement>(null);
  const [initialized, setInitialized] = useState(false);
  const [user, setUser] = useState<unknown>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  // Add-slot form
  const [newDate, setNewDate] = useState('');
  const [newStart, setNewStart] = useState('13:00');
  const [newStatus, setNewStatus] = useState<'available' | 'blocked' | 'booked'>('available');
  const [adding, setAdding] = useState(false);
  const [newBooking, setNewBooking] = useState({ name: '', email: '', phone: '', partySize: '', message: '' });

  // Table state
  const [globalFilter, setGlobalFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'date', desc: false }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });

  // Export state
  const [exportFrom, setExportFrom] = useState('');
  const [exportTo, setExportTo] = useState('');
  const [exportFmt, setExportFmt] = useState<'csv' | 'xlsx' | 'ods'>('csv');
  const [exporting, setExporting] = useState(false);

  // Auth — register listeners BEFORE calling init() so the 'init' event is never missed
  useEffect(() => {
    netlifyIdentity.on('init', (u: unknown) => { setUser(u); setInitialized(true); });
    netlifyIdentity.on('login', (u: unknown) => { setUser(u); netlifyIdentity.close(); });
    netlifyIdentity.on('logout', () => setUser(null));
    netlifyIdentity.init({ APIUrl: 'https://lowernotleyhallfarm.netlify.app/.netlify/identity' });
  }, []);

  const authHeader = () => {
    const token = (netlifyIdentity.currentUser() as { token?: { access_token: string } })?.token?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  /**
   * If a function returns 401 the access token has likely expired.
   * Ask the widget to refresh; if refresh succeeds the `login` event
   * fires and sets a new user, which triggers fetchSlots again.
   * If it fails, open the login modal so the user can reauthenticate.
   */
  const handleUnauthorized = () => {
    // `refresh` exists on the CDN widget but is absent from the TS types
    const maybeRefresh = (netlifyIdentity as unknown as { refresh?: () => Promise<unknown> }).refresh;
    if (maybeRefresh) {
      maybeRefresh().catch(() => netlifyIdentity.open('login'));
    } else {
      netlifyIdentity.open('login');
    }
  };

  const fetchSlots = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${SITE_BASE_URL}/.netlify/functions/admin-bookings`, {
        headers: authHeader() as HeadersInit,
      });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (!res.ok) throw new Error('Could not load bookings');
      const data = await res.json();
      setSlots(Array.isArray(data) ? data : (data.slots ?? []));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchSlots();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const flash = (text: string) => { 
    setMsg(text); 
    setTimeout(() => setMsg(''), 7000000); 
  };

  const exportBookings = () => {
    setExporting(true);
    try {
      let booked = slots.filter(s => s.status === 'booked');
      if (exportFrom) booked = booked.filter(s => s.date >= exportFrom);
      if (exportTo)   booked = booked.filter(s => s.date <= exportTo);

      if (booked.length === 0) {
        flash('No booked slots found for the selected date range.');
        return;
      }

      const rows = booked.map(s => ({
        Date:        fmt(s.date),
        'Start Time': fmtTime(s.startTime),
        'End Time':  fmtTime(s.endTime),
        'Guest Name':  s.booking?.name ?? '',
        'Guest Email': s.booking?.email ?? '',
        'Guest Phone': s.booking?.phone ?? '',
        'Party Size':  s.booking?.partySize ?? '',
        Notes:         s.booking?.message ?? '',
        'Booked At':   s.booking?.bookedAt ? new Date(s.booking.bookedAt).toLocaleString() : '',
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Bookings');

      const dateStamp = new Date().toISOString().split('T')[0];
      const filename  = `lnhf-bookings-${dateStamp}.${exportFmt}`;
      const bookType  = exportFmt === 'csv' ? 'csv' : exportFmt === 'ods' ? 'ods' : 'xlsx';
      XLSX.writeFile(wb, filename, { bookType });
    } finally {
      setExporting(false);
    }
  };

  const updateSlot = async (id: string, body: Record<string, unknown>) => {
    const res = await fetch(`${SITE_BASE_URL}/.netlify/functions/admin-slot`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(authHeader() as HeadersInit) },
      body: JSON.stringify({ id, ...body }),
    });
    if (res.status === 401) { handleUnauthorized(); return; }
    if (!res.ok) throw new Error((await res.json()).error || 'Update failed');
    await fetchSlots();
  };

  const deleteSlot = async (id: string) => {
    if (!confirm('Delete this slot permanently?')) return;
    const res = await fetch(`${SITE_BASE_URL}/.netlify/functions/admin-slot`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...(authHeader() as HeadersInit) },
      body: JSON.stringify({ id }),
    });
    if (res.status === 401) { handleUnauthorized(); return; }
    if (!res.ok) throw new Error((await res.json()).error || 'Delete failed');
    await fetchSlots();
    flash('Slot deleted');
  };

  const addSlot = async (e: React.FormEvent) => {
    e.preventDefault();

    const endHour = parseInt(newStart.split(':')[0], 10) + 1;
    const endTime = `${String(endHour).padStart(2, '0')}:00`;

    // Duplicate check: same date + startTime already exists in the loaded data
    const duplicate = slots.some(s => s.date === newDate && s.startTime === newStart);
    if (duplicate) {
      flash(`A slot for ${fmt(newDate)} at ${fmtTime(newStart)} already exists.`);
      return;
    }

    setAdding(true);
    try {
      const payload: Record<string, unknown> = { date: newDate, startTime: newStart, endTime, status: newStatus };
      if (newStatus === 'booked') {
        payload.booking = {
          name: newBooking.name,
          email: newBooking.email,
          ...(newBooking.phone ? { phone: newBooking.phone } : {}),
          ...(newBooking.partySize ? { partySize: Number(newBooking.partySize) } : {}),
          ...(newBooking.message ? { message: newBooking.message } : {}),
        };
      }
      const res = await fetch(`${SITE_BASE_URL}/.netlify/functions/admin-slot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authHeader() as HeadersInit) },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Create failed');
      await fetchSlots();
      flash('Slot added');
      setNewDate('');
      setNewBooking({ name: '', email: '', phone: '', partySize: '', message: '' });
      setNewStatus('available');
    } catch (e) {
      flash(`Error: ${e instanceof Error ? e.message : 'Unknown'}`);
    } finally {
      setAdding(false);
    }
  };

  // Sync status dropdown → column filter and reset to page 1
  useEffect(() => {
    setColumnFilters(statusFilter ? [{ id: 'status', value: statusFilter }] : []);
    setPagination(p => ({ ...p, pageIndex: 0 }));
  }, [statusFilter]);

  useEffect(() => {
    setPagination(p => ({ ...p, pageIndex: 0 }));
  }, [globalFilter]);

  const columns = [
    columnHelper.accessor('date', {
      header: 'Date',
      cell: info => fmt(info.getValue()),
      sortingFn: 'alphanumeric',
    }),
    columnHelper.accessor(row => row.startTime, {
      id: 'time',
      header: 'Time',
      cell: info => {
        const slot = info.row.original;
        return `${fmtTime(slot.startTime)} – ${fmtTime(slot.endTime)}`;
      },
      sortingFn: (rowA, rowB) =>
        rowA.original.startTime.localeCompare(rowB.original.startTime),
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: info => (
        <span className={`admin-badge admin-badge--${info.getValue()}`}>
          {info.getValue()}
        </span>
      ),
      filterFn: 'equals',
    }),
    columnHelper.accessor(row => row.booking?.name ?? '', {
      id: 'guest',
      header: 'Guest',
      cell: info => {
        const slot = info.row.original;
        if (!slot.booking) return '—';
        return (
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
        );
      },
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: info => {
        const slot = info.row.original;
        return (
          <div className="admin-td-actions">
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

  // Wait for the identity widget to finish validating the stored session
  if (!initialized) {
    return <div className="admin-login"><p>Loading…</p></div>;
  }

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

      <div id="admin-msg" className="booking-admin__msg-container" aria-live="polite" ref={adminMsg}>
        {msg &&  <div className="booking-admin__msg" role="status">{msg}</div>}
        {error && <div className="booking-admin__error" role="alert">{error}</div>}
      </div>

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
              onChange={e => setNewStatus(e.target.value as 'available' | 'blocked' | 'booked')}
            >
              <option value="available">Available</option>
              <option value="blocked">Blocked</option>
              <option value="booked">Booked (phone/walk-in)</option>
            </select>
          </div>

          {newStatus === 'booked' && (
            <fieldset className="booking-admin__guest-fieldset">
              <legend className="form-label">Guest Details</legend>
              <div className="form-group">
                <label className="form-label" htmlFor="a-g-name">Name <span aria-hidden="true">*</span></label>
                <input
                  className="form-input"
                  type="text"
                  id="a-g-name"
                  required
                  value={newBooking.name}
                  onChange={e => setNewBooking(b => ({ ...b, name: e.target.value }))}
                  placeholder="Guest full name"
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="a-g-email">Email <span aria-hidden="true">*</span></label>
                <input
                  className="form-input"
                  type="email"
                  id="a-g-email"
                  required
                  value={newBooking.email}
                  onChange={e => setNewBooking(b => ({ ...b, email: e.target.value }))}
                  placeholder="guest@example.com"
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="a-g-phone">Phone</label>
                <input
                  className="form-input"
                  type="tel"
                  id="a-g-phone"
                  value={newBooking.phone}
                  onChange={e => setNewBooking(b => ({ ...b, phone: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="a-g-party">Party Size</label>
                <input
                  className="form-input"
                  type="number"
                  id="a-g-party"
                  min={1}
                  value={newBooking.partySize}
                  onChange={e => setNewBooking(b => ({ ...b, partySize: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="a-g-msg">Notes</label>
                <textarea
                  className="form-input"
                  id="a-g-msg"
                  rows={3}
                  value={newBooking.message}
                  onChange={e => setNewBooking(b => ({ ...b, message: e.target.value }))}
                  placeholder="Optional notes"
                />
              </div>
            </fieldset>
          )}

          <div className="form-group">
            <button
              type="submit"
              className="btn btn--primary"
              disabled={adding}
            >
              {adding ? 'Adding…' : 'Add Slot'}
            </button>
          </div>
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

        {/* Export booked entries */}
        <details className="booking-admin__export">
          <summary className="booking-admin__export-summary">Export Booked Entries</summary>
          <div className="booking-admin__export-controls">
            <div className="form-group">
              <label className="form-label" htmlFor="exp-from">From date</label>
              <input
                className="form-input"
                type="date"
                id="exp-from"
                value={exportFrom}
                onChange={e => setExportFrom(e.target.value)}
                max={exportTo || undefined}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="exp-to">To date</label>
              <input
                className="form-input"
                type="date"
                id="exp-to"
                value={exportTo}
                onChange={e => setExportTo(e.target.value)}
                min={exportFrom || undefined}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="exp-fmt">Format</label>
              <select
                className="form-select"
                id="exp-fmt"
                value={exportFmt}
                onChange={e => setExportFmt(e.target.value as 'csv' | 'xlsx' | 'ods')}
              >
                <option value="csv">CSV (.csv)</option>
                <option value="xlsx">Excel (.xlsx)</option>
                <option value="ods">OpenDocument (.ods)</option>
              </select>
            </div>
            <div className="form-group booking-admin__export-action">
              <button
                className="btn btn--primary btn--sm"
                onClick={exportBookings}
                disabled={exporting || slots.filter(s => s.status === 'booked').length === 0}
              >
                {exporting ? 'Exporting…' : 'Download'}
              </button>
              <span className="booking-admin__export-count">
                {(() => {
                  let n = slots.filter(s => s.status === 'booked');
                  if (exportFrom) n = n.filter(s => s.date >= exportFrom);
                  if (exportTo)   n = n.filter(s => s.date <= exportTo);
                  return `${n.length} booked slot${n.length !== 1 ? 's' : ''}`;
                })()}
              </span>
            </div>
          </div>
        </details>

        {/* Search + filter controls */}
        <div className="table-controls">
          <input
            className="form-input table-search"
            type="search"
            placeholder="Search slots…"
            value={globalFilter}
            onChange={e => setGlobalFilter(e.target.value)}
            aria-label="Search slots"
          />
          <select
            className="form-select table-status-filter"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            <option value="available">Available</option>
            <option value="booked">Booked</option>
            <option value="blocked">Blocked</option>
          </select>
        </div>

        {slots.length === 0 && !loading ? (
          <p className="booking-admin__empty">No slots found. Add some above.</p>
        ) : (
          <>
            <div className="booking-admin__table-wrap">
              <table className="booking-admin__table">
                <thead>
                  {table.getHeaderGroups().map(hg => (
                    <tr key={hg.id}>
                      {hg.headers.map(header => (
                        <th
                          key={header.id}
                          onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                          className={header.column.getCanSort() ? 'sortable-col' : ''}
                          aria-sort={
                            header.column.getIsSorted() === 'asc' ? 'ascending' :
                            header.column.getIsSorted() === 'desc' ? 'descending' : 'none'
                          }
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getCanSort() && (
                            <span className="sort-icon" aria-hidden="true">
                              {header.column.getIsSorted() === 'asc' ? ' ▲' :
                               header.column.getIsSorted() === 'desc' ? ' ▼' : ' ⇅'}
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
                      <td colSpan={columns.length} className="booking-admin__empty">
                        No slots match your filters.
                      </td>
                    </tr>
                  ) : (
                    table.getRowModel().rows.map(row => (
                      <tr key={row.id} className={`admin-row admin-row--${row.original.status}`}>
                        {row.getVisibleCells().map(cell => (
                          <td key={cell.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="table-pagination">
              <span className="table-pagination__info">
                {totalFiltered === 0
                  ? 'No results'
                  : `Showing ${pageIndex * pageSize + 1}–${Math.min((pageIndex + 1) * pageSize, totalFiltered)} of ${totalFiltered}`}
              </span>
              <div className="table-pagination__controls">
                <button
                  className="admin-btn"
                  onClick={() => table.setPageIndex(0)}
                  disabled={!table.getCanPreviousPage()}
                  aria-label="First page"
                >«</button>
                <button
                  className="admin-btn"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  aria-label="Previous page"
                >‹</button>
                <span className="table-pagination__page">
                  Page {pageIndex + 1} of {pageCount || 1}
                </span>
                <button
                  className="admin-btn"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  aria-label="Next page"
                >›</button>
                <button
                  className="admin-btn"
                  onClick={() => table.setPageIndex(pageCount - 1)}
                  disabled={!table.getCanNextPage()}
                  aria-label="Last page"
                >»</button>
              </div>
              <select
                className="form-select table-pagination__size"
                value={pageSize}
                onChange={e => table.setPageSize(Number(e.target.value))}
                aria-label="Rows per page"
              >
                {[10, 20, 50, 100].map(size => (
                  <option key={size} value={size}>{size} / page</option>
                ))}
              </select>
            </div>
          </>
        )}
      </section>

    </div>
  );
}
