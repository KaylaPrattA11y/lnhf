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
import { buildGoogleCalendarUrl, buildIcsDownloadUrl } from '../../lib/calendar-links';
import getCalendarEventTitle from '../../lib/getCalendarTourTitle';
import { ICONS } from './icons';

const netlifyIdentity = window.netlifyIdentity!;
const SITE_BASE_URL = import.meta.env.DEV ? '' : import.meta.env.SITE.replace(/\/$/, '');

interface TourSlot {
  _id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'available' | 'booked' | 'blocked';
  visitorVisibility?: 'visible' | 'holiday_mode' | 'booking_buffer' | 'booking_horizon' | 'not_applicable';
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
  bookingHorizonMonths: 1 | 2 | 3 | 4 | 5 | 6;
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

type TableDatePreset = '' | 'week' | 'month' | 'year';
type StatusFilterValue = '' | 'available-visible' | 'available-hidden' | 'booked' | 'blocked';

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

function toDateInputValue(value: Date) {
  const yyyy = value.getFullYear();
  const mm = String(value.getMonth() + 1).padStart(2, '0');
  const dd = String(value.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getDateRangeForPreset(preset: Exclude<TableDatePreset, ''>, now = new Date()) {
  const start = new Date(now);
  const end = new Date(now);

  if (preset === 'week') {
    const day = now.getDay();
    start.setDate(now.getDate() - day);
    end.setDate(start.getDate() + 6);
  }

  if (preset === 'month') {
    start.setDate(1);
    end.setMonth(now.getMonth() + 1, 0);
  }

  if (preset === 'year') {
    start.setMonth(0, 1);
    end.setMonth(11, 31);
  }

  return {
    fromDate: toDateInputValue(start),
    toDate: toDateInputValue(end),
  };
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
  const defaultTableRange = useMemo(() => getDateRangeForPreset('month'), []);

  const adminMsg = useRef<HTMLDivElement>(null);
  const addTourSlotDetailsRef = useRef<HTMLDetailsElement>(null);
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
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newTour, setNewTour] = useState({ name: '', email: '', phone: '', partySize: '', message: '' });
  const [tourFormErrors, setTourFormErrors] = useState<TourFormErrors>({});

  const [globalFilter, setGlobalFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>('booked');
  const [tableDatePreset, setTableDatePreset] = useState<TableDatePreset>('month');
  const [tableFromDate, setTableFromDate] = useState(defaultTableRange.fromDate);
  const [tableToDate, setTableToDate] = useState(defaultTableRange.toDate);
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
    bookingHorizonMonths: 3,
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

  const filteredTableSlots = useMemo(() => {
    return slots.filter((slot) => {
      if (tableFromDate && slot.date < tableFromDate) return false;
      if (tableToDate && slot.date > tableToDate) return false;
      return true;
    });
  }, [slots, tableFromDate, tableToDate]);

  const selectedExistingSlot = useMemo(() => {
    if (!newDate || !newStart) return null;
    return slots.find((slot) => slot.date === newDate && slot.startTime === newStart) ?? null;
  }, [slots, newDate, newStart]);

  // The single source of truth for "which existing slot, if any, will this
  // submission target automatically (i.e. without the pencil-icon edit flow)".
  const autoTargetSlot = useMemo(() => {
    if (editingSlotId || !selectedExistingSlot) return null;
    return selectedExistingSlot;
  }, [editingSlotId, selectedExistingSlot]);

  const isUpdatingExistingSlot = Boolean(autoTargetSlot);

  // The slot record currently backing editingSlotId, if any — used to know
  // whether an "edit" in progress originally belonged to a booked slot, so we
  // can warn if the admin is about to erase its guest data.
  const editingOriginalSlot = useMemo(() => {
    if (!editingSlotId) return null;
    return slots.find((s) => s._id === editingSlotId) ?? null;
  }, [editingSlotId, slots]);

  const formStatusMessage = useMemo(() => {
    if (editingSlotId) {
      if (editingOriginalSlot?.status === 'booked' && newStatus !== 'booked') {
        const tourGuestName = editingOriginalSlot.tour?.name ?? 'a guest';
        return newStatus === 'blocked'
          ? `A booking already exists for this date and time for "${tourGuestName}". Blocking this slot will erase the saved booking information.`
          : `A booking already exists for this date and time for "${tourGuestName}". Making this slot available will erase the saved booking information.`;
      }
      return 'Editing booked slot details. Update fields below, then save.';
    }

    if (!selectedExistingSlot) {
      if (newDate && newStart) {
        return 'Submitting this form will create and add a new tour slot to the booking calendar.';
      }
      return null;
    }

    if (selectedExistingSlot.status === 'blocked') {
      return 'This tour slot is currently blocked.';
    }

    if (selectedExistingSlot.status === 'booked') {
      if (newStatus === 'booked') {
        return 'A booking already exists for this date and time. Submitting will overwrite the existing booking information.';
      }
      if (newStatus === 'blocked') {
        return 'A booking already exists for this date and time. Blocking this slot will erase the saved booking information.';
      }
      return 'A booking already exists for this date and time. Making this slot available will erase the saved booking information.';
    }

    return null; // existing slot is 'available' — no message defined
  }, [editingSlotId, editingOriginalSlot, selectedExistingSlot, newDate, newStart, newStatus]);

  // When the user selects a date/time that matches an existing BOOKED slot
  // and has Status set to Booked, auto-populate the form with that booking's
  // details so they can review/edit rather than overwrite blindly. Skip if
  // we're already mid-edit on a *different* slot, so we don't silently
  // discard in-progress edits by retargeting out from under the admin.
  useEffect(() => {
    if (newStatus !== 'booked') return;
    if (!selectedExistingSlot || selectedExistingSlot.status !== 'booked') return;
    if (editingSlotId === selectedExistingSlot._id) return; // already populated for this slot
    if (editingSlotId) return; // already editing a different slot — don't clobber in-progress edits

    setEditingSlotId(selectedExistingSlot._id);
    setNewTour({
      name: selectedExistingSlot.tour?.name ?? '',
      email: selectedExistingSlot.tour?.email ?? '',
      phone: selectedExistingSlot.tour?.phone ?? '',
      partySize: selectedExistingSlot.tour?.partySize ? String(selectedExistingSlot.tour.partySize) : '',
      message: selectedExistingSlot.tour?.message ?? '',
    });
    setTourFormErrors({});
  }, [newDate, newStart, newStatus, selectedExistingSlot, editingSlotId]);

  const applyTableDatePreset = (preset: Exclude<TableDatePreset, ''>) => {
    const range = getDateRangeForPreset(preset);
    setTableDatePreset(preset);
    setTableFromDate(range.fromDate);
    setTableToDate(range.toDate);
  };

  const clearTableDateRange = () => {
    setTableDatePreset('');
    setTableFromDate('');
    setTableToDate('');
  };

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
        bookingHorizonMonths: Number(calendarSettings.bookingHorizonMonths),
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

  const updateSlot = async (id: string, body: { status?: TourSlot['status'] } & Record<string, unknown>) => {
    const slot = slots.find((s) => s._id === id);
    if (slot?.status === 'booked' && body.unbook === true) {
      const guestName = slot?.tour && slot.tour.name ? slot.tour.name : 'a guest';

      if (confirm(`This slot is booked by ${guestName}. Are you sure you want to unbook it?`)) {
        // update react state to reflect unbooking immediately for better UX
        setSlots((prev) => prev.map((s) => (s._id === id ? { ...s, status: 'available', tour: undefined } : s)));
        if (id === editingSlotId) {
          cancelEditSlot(); // clears editingSlotId + form so it doesn't shadow future submits
        }
      } else {
        return;
      }
    }
    if (slot?.status === 'available' && body.status === 'blocked') {
      if (confirm(`Blocking a slot will prevent guests from booking it. Are you sure you want to block it?`)) {
        // update react state to reflect blocking immediately for better UX
        setSlots((prev) => prev.map((s) => (s._id === id ? { ...s, status: 'blocked' } : s)));
        if (id === editingSlotId) {
          cancelEditSlot(); // clears editingSlotId + form so it doesn't shadow future submits
        }
      } else {
        return;
      }
    }

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
    if (!id) {
      flash('Error: Missing slot ID');
      return;
    }

    const slot = slots.find((s) => s._id === id);
    if (slot?.status === 'booked') {
      const guestName = slot?.tour && slot.tour.name ? slot.tour.name : 'a guest';
      if (confirm(`This slot is booked by ${guestName}. Are you sure you want to delete it?`)) {
        if (id === editingSlotId) {
          cancelEditSlot(); // clears editingSlotId + form so it doesn't shadow future submits
        }
      } else {
        return;
      }
    }

    if (confirm('Deleting this slot will remove any saved details. You can always add it back later. Delete this tour slot?')) {
      if (id === editingSlotId) {
        cancelEditSlot(); // clears editingSlotId + form so it doesn't shadow future submits
      }
    } else {
      return;
    }

    try {
      const res = await fetch(
        `${SITE_BASE_URL}/.netlify/functions/admin-tour-slot?id=${encodeURIComponent(id)}`,
        {
          method: 'DELETE',
          headers: {
            ...(authHeader() as HeadersInit)
            // No need for Content-Type when using query param
          },
        }
      );

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      let data: any = {};
      try {
        data = await res.json();
      } catch { }

      if (!res.ok) {
        throw new Error(data.error || `Failed with status ${res.status}`);
      }

      await fetchSlots();
      flash('Tour slot deleted successfully');
    } catch (err) {
      console.error('Delete error:', err);
      flash(`Error: ${err instanceof Error ? err.message : 'Failed to delete slot'}`);
    }
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

    const duplicate = slots.some(
      (slot) => slot.date === newDate && slot.startTime === newStart && slot._id !== editingSlotId,
    );

    if (duplicate && !autoTargetSlot) {
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
      } else {
        // Explicitly clear any existing guest/tour data when this submission
        // moves a slot to 'available' or 'blocked' — a booking's tour object
        // should not silently survive on the backend just because the field
        // was omitted from this payload. This is what backs the "will erase
        // the saved booking information" warnings shown above the form.
        payload.tour = null;
        payload.unbook = true;
      }

      const effectiveEditingSlotId = editingSlotId ?? autoTargetSlot?._id ?? null;
      const isEditing = Boolean(effectiveEditingSlotId);
      const requestBody = isEditing ? { id: effectiveEditingSlotId, ...payload } : payload;
      const res = await fetch(`${SITE_BASE_URL}/.netlify/functions/admin-tour-slot`, {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', ...(authHeader() as HeadersInit) },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) throw new Error((await res.json()).error || (isEditing ? 'Update failed' : 'Create failed'));
      await fetchSlots();
      if (editingSlotId) {
        flash('Tour slot updated');
      } else if (autoTargetSlot) {
        flash(newStatus === 'booked' ? 'Booking saved to existing slot' : 'Existing tour slot updated');
      } else {
        flash('Tour slot added');
      }
      setEditingSlotId(null);
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

  const beginQuickBookFromSlot = (slot: TourSlot) => {
    setEditingSlotId(slot._id);
    setNewDate(slot.date);
    setNewStart(slot.startTime);
    setNewEnd(slot.endTime);
    setNewStatus('booked');
    setNewTour({ name: '', email: '', phone: '', partySize: '', message: '' });
    setTourFormErrors({});

    const detailsEl = addTourSlotDetailsRef.current;
    if (detailsEl) {
      detailsEl.open = true;
      detailsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    requestAnimationFrame(() => {
      focusAndScrollToField('tour-guest-name');
    });
  };

  const beginEditBookedSlot = (slot: TourSlot) => {
    setEditingSlotId(slot._id);
    setNewDate(slot.date);
    setNewStart(slot.startTime);
    setNewEnd(slot.endTime);
    setNewStatus('booked');
    setNewTour({
      name: slot.tour?.name ?? '',
      email: slot.tour?.email ?? '',
      phone: slot.tour?.phone ?? '',
      partySize: slot.tour?.partySize ? String(slot.tour.partySize) : '',
      message: slot.tour?.message ?? '',
    });
    setTourFormErrors({});

    const detailsEl = addTourSlotDetailsRef.current;
    if (detailsEl) {
      detailsEl.open = true;
      detailsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    requestAnimationFrame(() => {
      focusAndScrollToField('tour-date');
    });
  };

  const cancelEditSlot = () => {
    setEditingSlotId(null);
    setNewDate('');
    setNewStatus('available');
    const firstSlot = sortedTimeSlotOptions[0];
    if (firstSlot) {
      setNewStart(firstSlot.tourStart);
      setNewEnd(firstSlot.tourEnd);
    }
    setNewTour({ name: '', email: '', phone: '', partySize: '', message: '' });
    setTourFormErrors({});
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

  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [tableFromDate, tableToDate]);

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
              {slot.status === 'available' && slot.visitorVisibility === 'booking_horizon' && (
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
      filterFn: (row, _columnId, filterValue: string) => {
        const slot = row.original;
        const isGuestHidden =
          slot.status === 'available' &&
          (slot.visitorVisibility === 'holiday_mode' ||
            slot.visitorVisibility === 'booking_buffer' ||
            slot.visitorVisibility === 'booking_horizon');

        if (!filterValue) return true;
        if (filterValue === 'available-visible') return slot.status === 'available' && !isGuestHidden;
        if (filterValue === 'available-hidden') return slot.status === 'available' && isGuestHidden;
        if (filterValue === 'booked') return slot.status === 'booked';
        if (filterValue === 'blocked') return slot.status === 'blocked';

        return true;
      },
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
              <li><strong>Email:</strong> <a href={`mailto:${slot.tour.email}`}>{slot.tour.email}</a></li>
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
        const calendarTitle = getCalendarEventTitle(slot.tour?.name);
        const calendarDescription = [
          slot.tour?.name ? `Guest: ${slot.tour.name}` : '',
          slot.tour?.email ? `Email: ${slot.tour.email}` : '',
          slot.tour?.phone ? `Phone: ${slot.tour.phone}` : '',
          slot.tour?.message ? `Notes: ${slot.tour.message}` : '',
        ].filter(Boolean).join('\n');
        const googleCalendarUrl = buildGoogleCalendarUrl({
          date: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          title: calendarTitle,
          description: calendarDescription,
        });
        // const icsDownloadUrl = buildIcsDownloadUrl({
        //   date: slot.date,
        //   startTime: slot.startTime,
        //   endTime: slot.endTime,
        //   title: calendarTitle,
        //   description: calendarDescription,
        //   filename: `lnhf-tour-${slot.date}-${slot.startTime}`,
        // }, SITE_BASE_URL);

        return (
          <div className="admin-td-actions">
            {slot.status === 'booked' && (
              <button
                className="admin-btn admin-btn--good"
                onClick={() => beginEditBookedSlot(slot)}
                aria-label="Edit booking details"
              >
                {ICONS.Edit}
              </button>
            )}
            {slot.status === 'available' && (
              <button
                className="admin-btn admin-btn--good"
                onClick={() => beginQuickBookFromSlot(slot)}
                aria-label="Book tour slot"
              >
                {ICONS.Plus}
              </button>
            )}
            {slot.status === 'available' && (
              <button
                className="admin-btn admin-btn--muted"
                onClick={() => updateSlot(slot._id, { status: 'blocked' }).then(() => flash('Tour slot blocked'))}
                aria-label="Block tour slot"
              >
                {ICONS.Block}
              </button>
            )}
            {slot.status === 'blocked' && (
              <button
                className="admin-btn admin-btn--good"
                onClick={() => updateSlot(slot._id, { status: 'available' }).then(() => flash('Tour slot unblocked'))}
                aria-label="Unblock tour slot"
              >
                {ICONS.Unblock}
              </button>
            )}
            {slot.status === 'booked' && (
              <button
                className="admin-btn admin-btn--warn"
                onClick={() => updateSlot(slot._id, { unbook: true }).then(() => flash('Tour booking cancelled'))}
                aria-label="Clear tour slot"
              >
                {ICONS.Clear}
              </button>
            )}
            <button
              aria-label="Delete tour slot"
              className="admin-btn admin-btn--danger"
              onClick={() => deleteSlot(slot._id)}
            >
              {ICONS.Delete}
            </button>
            {slot.status === 'booked' && (
              <a
                className="admin-btn admin-btn--muted"
                href={googleCalendarUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Add to Google Calendar"
              >
                {ICONS.GoogleCalendar}
              </a>
            )}
            {/* {slot.status === 'booked' && (
              <a 
                className="admin-btn admin-btn--muted" 
                href={icsDownloadUrl} 
                aria-label="Download .ics file"
              >
                {ICONS.CalendarDownArrow}
              </a>
            )} */}
          </div>
        );
      },
    }),
  ];

  const table = useReactTable({
    data: filteredTableSlots,
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
        <div className="admin-manager__controls">
          <div>
            <button className="btn btn--primary btn--sm" onClick={fetchSlots} disabled={loading || seeding}>
              {loading ? 'Loading...' : 'Refresh Tour Database'}
            </button>
            <details className="table-details-help">
              <summary>What does this do?</summary>
              <p>This will refresh the <strong>Tour Database</strong> table displayed below by fetching the latest tour slots from the server.</p>
            </details>
          </div>
          <div>
            <button className="btn btn--primary btn--sm" onClick={runSeedSync} disabled={seeding || loading}>
              {seeding ? 'Syncing...' : 'Regenerate Tour Slots'}
            </button>
            <details className="table-details-help">
              <summary>What does this do?</summary>
              <p>This will add/remove tour slots based on the "Tour Time Slots" templates you have set up.</p>
              <ul>
                <li>It will not modify or remove any past or currently booked slots.</li>
                <li>Please allow some time for the changes to take effect.</li>
              </ul>
              <p><em>See the "Tour Time Slots" collection in <a href={`${import.meta.env.SITE}admin/`} target="_blank" rel="noopener noreferrer">the admin panel</a> to make changes.</em></p>
            </details>
          </div>
          <button className="btn btn--secondary btn--sm" onClick={() => netlifyIdentity.logout()}>
            Log Out
          </button>
        </div>
      </div>

      <div className="admin-manager__msg-container" aria-live="polite" ref={adminMsg}>
        {msg && <div className="admin-manager__msg"><p>{msg}</p></div>}
        {error && <div className="admin-manager__error"><p>{error}</p></div>}
      </div>

      <section className="admin-manager__section">
        <details className="admin-manager__export" ref={addTourSlotDetailsRef}>
          <summary className="admin-manager__export-summary">
            <h2 className="admin-manager__section-title">Tour Database</h2>
          </summary>
          <div className="admin-manager__section-inner">
            {lastSyncResult && (
              <div className="admin-manager__msg" role="status" aria-live="polite">
                <strong>Last Sync Result:</strong>{' '}
                Added {lastSyncResult.insertedCount}, removed {lastSyncResult.deletedCount}, templates {lastSyncResult.seededTemplates},
                window {lastSyncResult.windowStart} to {lastSyncResult.windowEnd},
                ran {new Date(lastSyncResult.syncedAt).toLocaleString()}.
              </div>
            )}

            <div className="table-controls">
              <fieldset className="table-date-range">
                <legend className="form-label">Filter Attributes</legend>
                <label>
                  Search Tour Slots
                  <input
                    className="form-input table-search"
                    type="search"
                    placeholder="Enter date, time, guest name, or email"
                    value={globalFilter}
                    onChange={(e) => setGlobalFilter(e.target.value)}
                    id="tour-table-search"
                  />
                </label>
                <div className="table-status-filter-wrap">
                  <label>
                    Filter by Tour Slot Status
                    <select
                      className="form-select table-status-filter"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as StatusFilterValue)}
                    >
                      <option value="">All statuses</option>
                      <option value="available-visible">Available</option>
                      <option value="available-hidden">Available (hidden from visitors)</option>
                      <option value="booked">Booked</option>
                      <option value="blocked">Blocked</option>
                    </select>
                  </label>
                  <details className="table-details-help">
                    <summary>What does each Tour Slot Status mean?</summary>
                    <p><strong>Available:</strong> Guests can see and book this slot.</p>
                    <p><strong>Available (hidden from visitors):</strong> Slot exists but is currently hidden by holiday mode, booking buffer, or booking horizon rules.</p>
                    <p><strong>Booked:</strong> Already reserved by a guest.</p>
                    <p><strong>Blocked:</strong> Manually disabled and not bookable.</p>
                  </details>
                </div>
              </fieldset>

              <fieldset className="table-date-range" aria-label="Tour slots date range filters">
                <legend className="form-label">Filter Date Range</legend>
                <div className="table-date-range__grid">
                  <div className="table-date-range__presets" role="radiogroup" aria-label="Quick date ranges for tour slots">
                    <strong>Preset ranges:</strong>
                    <label className="table-date-range__preset-option">
                      <input
                        type="radio"
                        name="tour-table-date-preset"
                        checked={tableDatePreset === 'week'}
                        onChange={() => applyTableDatePreset('week')}
                      />
                      This week
                    </label>
                    <label className="table-date-range__preset-option">
                      <input
                        type="radio"
                        name="tour-table-date-preset"
                        checked={tableDatePreset === 'month'}
                        onChange={() => applyTableDatePreset('month')}
                      />
                      This month
                    </label>
                    <label className="table-date-range__preset-option">
                      <input
                        type="radio"
                        name="tour-table-date-preset"
                        checked={tableDatePreset === 'year'}
                        onChange={() => applyTableDatePreset('year')}
                      />
                      This year
                    </label>
                    <label className="table-date-range__preset-option">
                      <input
                        type="radio"
                        name="tour-table-date-preset"
                        checked={tableDatePreset === ''}
                        onChange={() => clearTableDateRange()}
                      />
                      All time
                    </label>
                  </div>

                  <div className="table-date-range__fields">
                    <strong>Custom range:</strong>
                    <div className="form-group">
                      <label className="form-label" htmlFor="tour-table-date-from">From date</label>
                      <input
                        id="tour-table-date-from"
                        className="form-input table-date-filter"
                        type="date"
                        value={tableFromDate}
                        max={tableToDate || undefined}
                        onChange={(e) => {
                          setTableDatePreset('');
                          setTableFromDate(e.target.value);
                        }}
                        aria-label="Filter tour slots from date"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="tour-table-date-to">To date</label>
                      <input
                        id="tour-table-date-to"
                        className="form-input table-date-filter"
                        type="date"
                        value={tableToDate}
                        min={tableFromDate || undefined}
                        onChange={(e) => {
                          setTableDatePreset('');
                          setTableToDate(e.target.value);
                        }}
                        aria-label="Filter tour slots to date"
                      />
                    </div>

                  </div>
                </div>

              </fieldset>

            </div>

          </div>
          {filteredTableSlots.length === 0 && !loading ? (
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
                            data-name={header.column.id}
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
        </details>
      </section>

      <section className="admin-manager__section">
        <details className="admin-manager__export" ref={addTourSlotDetailsRef}>
          <summary className="admin-manager__export-summary">
            <h2 className="admin-manager__section-title">{editingSlotId ? 'Edit an Existing Booked Slot' : 'Manage a Tour Slot'}</h2>
          </summary>
          <p className="admin-manager__subtitle">
            Use this form to manage tour slots by adding custom slots, removing existing slots, and directly booking slots to any chosen date and time slot. Choose <strong>Available</strong>/<strong>Blocked</strong> to create a slot for your guests, or choose <strong>Booked (phone/walk-in)</strong> to save guest details to an existing slot (same date/time) or create a booked slot if none exists.
          </p>
          <form className="admin-manager__add-form admin-manager__export-controls" onSubmit={addSlot} noValidate>
            {formStatusMessage && (
              <div className="admin-manager__msg" role="status" aria-live="polite">
                <p>{formStatusMessage}</p>
              </div>
            )}
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
              <label className="form-label" htmlFor="tour-start">Time Slot</label>
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
              <details className="table-details-help">
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
                {adding
                  ? (editingSlotId || isUpdatingExistingSlot ? 'Saving...' : 'Adding...')
                  : (editingSlotId
                    ? 'Save Changes'
                    : (isUpdatingExistingSlot ? 'Save Changes' : 'Add Slot'))}
              </button>
              {editingSlotId && (
                <button type="button" className="btn btn--secondary" onClick={cancelEditSlot} disabled={adding}>
                  Cancel Edit
                </button>
              )}
            </div>
          </form>
        </details>
      </section>

      <section className="admin-manager__section">
        <details className="admin-manager__export">
          <summary className="admin-manager__export-summary">
            <h2 className="admin-manager__section-title">Manage Tour Calendar</h2>
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
              <legend>Future Booking Horizon</legend>
              <p className="admin-manager__subtitle">
                This controls how far ahead tour slots are shown to visitors and how far future seeded slot generation runs.
              </p>
              <div className="form-group checks-vertical">
                {[1, 2, 3, 4, 5, 6].map((months) => (
                  <label key={months} className="form-label" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="radio"
                      name="booking-horizon-months"
                      value={months}
                      checked={Number(calendarSettings.bookingHorizonMonths) === months}
                      onChange={() => setCalendarSettings((prev) => ({ ...prev, bookingHorizonMonths: months as 1 | 2 | 3 | 4 | 5 | 6 }))}
                    />
                    {months} {months === 1 ? 'month' : 'months'}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="admin-manager__fieldset admin-manager__fieldset--holiday-mode">
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
                <div className="admin-manager__msg" style={{ whiteSpace: 'pre-line' }}><p>{holidayMessageHtmlInput}</p></div>
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

      <section className="admin-manager__section">
        <details className="admin-manager__export">
          <summary className="admin-manager__export-summary">
            <h2 className="admin-manager__section-title">Export Booked Tours</h2>
          </summary>
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
      </section>

    </div>
  );
}