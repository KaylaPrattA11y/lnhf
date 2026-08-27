import { useEffect, useMemo, useState, useRef } from 'react';
import * as XLSX from 'xlsx';
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
import { comparePricingEntries } from '../../lib/pricing-order';
import { ICONS } from './icons';

const to12HourTime = (time24: string) => {
  const [hourStr, minute] = time24.split(':');
  let hour = Number(hourStr);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12 || 12;
  return `${hour}:${minute} ${ampm}`;
};

const formatDatePretty = (dateStr: string) => {
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

const netlifyIdentity = window.netlifyIdentity!;
const SITE_BASE_URL = import.meta.env.DEV ? '' : import.meta.env.SITE.replace(/\/$/, '');

interface PricingCollectionEntry {
  id: string;
  name: string;
  feeType: 'static' | 'dynamic';
  isChecked: boolean;
  perUnit: boolean;
  maxUnits?: number;
  billingTreatment?: 'includedInTotals' | 'returnedLater' | 'informationalOnly';
  value: number;
  description?: string;
}

interface WeddingActivity {
  label: string;
  date: string;
  time?: string;
}

interface WeddingContact {
  fullName?: string;
  role?: string;
  email?: string;
  phone?: string;
}

interface WeddingPricingItem {
  sourceType: 'collection' | 'custom';
  entryKey?: string;
  label: string;
  value: number;
  quantity: number;
  billingTreatment: 'includedInTotals' | 'returnedLater' | 'informationalOnly';
  isChecked: boolean;
}

interface WeddingPaymentReceived {
  label: string;
  value: number;
  dateReceived?: string;
}

interface Wedding {
  _id: string;
  status: 'active' | 'cancelled';
  bride: { fullName: string; email?: string; phone?: string };
  groom: { fullName: string; email?: string; phone?: string };
  otherContacts: WeddingContact[];
  weddingDate: string;
  weddingTime?: string;
  notes?: string;
  activities: WeddingActivity[];
  pricingItems: WeddingPricingItem[];
  paymentsReceived: WeddingPaymentReceived[];
  finalCost: number;
  createdAt: string;
  updatedAt: string;
}

interface WeddingsAdminProps {
  pricingEntries: PricingCollectionEntry[];
}

type TableDatePreset = '' | 'week' | 'month' | 'year';

interface WeddingFormErrors {
  brideFullName?: string;
  groomFullName?: string;
  weddingDate?: string;
  activityLabels: Record<number, string>;
  activityDates: Record<number, string>;
  paymentLabels: Record<number, string>;
  paymentValues: Record<number, string>;
}

function money(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function fmtDate(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function toDateKey(value: string) {
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return value;

  const usMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usMatch) {
    const [, month, day, year] = usMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().split('T')[0];
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

function buildHalfHourTimeOptions() {
  const options: string[] = [];
  const minutesInDay = 24 * 60;
  const startAtNoonMinutes = 12 * 60;

  for (let step = 0; step < 48; step += 1) {
    const totalMinutes = (startAtNoonMinutes + step * 30) % minutesInDay;
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    options.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
  }
  return options;
}

function getWeddingTotals(wedding: Pick<Wedding, 'finalCost' | 'pricingItems'>) {
  const refundableTotal = (wedding.pricingItems ?? [])
    .filter((item) => isReturnedLater(item.billingTreatment) && !isOmittedFromTotal(item.billingTreatment))
    .reduce((sum, item) => sum + Number(item.value || 0) * Math.max(1, Number(item.quantity ?? 1)), 0);

  const total = Number(wedding.finalCost || 0);

  return {
    total,
    refundableTotal,
    netTotal: total - refundableTotal,
  };
}

function getPaymentsReceivedTotal(wedding: Pick<Wedding, 'paymentsReceived'>) {
  return (wedding.paymentsReceived ?? []).reduce((sum, payment) => sum + Number(payment.value || 0), 0);
}

function getBalanceRemaining(wedding: Pick<Wedding, 'finalCost' | 'paymentsReceived'>) {
  return Number(wedding.finalCost || 0) - getPaymentsReceivedTotal(wedding);
}

const columnHelper = createColumnHelper<Wedding>();

const globalFilterFn: FilterFn<Wedding> = (row, _columnId, filterValue: string) => {
  const term = filterValue.toLowerCase();
  const wedding = row.original;
  return (
    wedding.bride.fullName.toLowerCase().includes(term) ||
    wedding.groom.fullName.toLowerCase().includes(term) ||
    wedding.weddingDate.toLowerCase().includes(term) ||
    wedding.status.toLowerCase().includes(term)
  );
};

const isReturnedLater = (billingTreatment?: 'includedInTotals' | 'returnedLater' | 'informationalOnly') =>
  billingTreatment === 'returnedLater';

const isOmittedFromTotal = (billingTreatment?: 'includedInTotals' | 'returnedLater' | 'informationalOnly') =>
  billingTreatment === 'informationalOnly';

export default function WeddingsAdmin({ pricingEntries }: WeddingsAdminProps) {
  const defaultTableRange = useMemo(() => getDateRangeForPreset('year'), []);

  const orderedPricingEntries = useMemo(
    () => [...pricingEntries].sort(comparePricingEntries),
    [pricingEntries],
  );

  const staticDefaultEntryIds = useMemo(
    () => orderedPricingEntries.filter((entry) => entry.feeType === 'static').map((entry) => entry.id),
    [orderedPricingEntries],
  );
  const checkedDefaultEntryIds = useMemo(
    () => orderedPricingEntries.filter((entry) => entry.feeType === 'dynamic' && entry.isChecked).map((entry) => entry.id),
    [orderedPricingEntries],
  );
  const defaultSelectedEntryIds = useMemo(
    () => Array.from(new Set([...staticDefaultEntryIds, ...checkedDefaultEntryIds])),
    [staticDefaultEntryIds, checkedDefaultEntryIds],
  );

  const [initialized, setInitialized] = useState(false);
  const [user, setUser] = useState<unknown>(null);
  const [weddings, setWeddings] = useState<Wedding[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [bride, setBride] = useState({ fullName: '', email: '', phone: '' });
  const [groom, setGroom] = useState({ fullName: '', email: '', phone: '' });
  const [otherContacts, setOtherContacts] = useState<WeddingContact[]>([]);
  const [weddingDate, setWeddingDate] = useState('');
  const [weddingTime, setWeddingTime] = useState('');
  const [notes, setNotes] = useState('');
  const [activities, setActivities] = useState<WeddingActivity[]>([]);
  const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>(defaultSelectedEntryIds);
  const [entryQuantities, setEntryQuantities] = useState<Record<string, number>>({});
  const [customPricing, setCustomPricing] = useState<Array<{ label: string; value: string }>>([]);
  const [paymentsReceived, setPaymentsReceived] = useState<Array<{ label: string; value: string; dateReceived: string }>>([]);
  const [weddingFormErrors, setWeddingFormErrors] = useState<WeddingFormErrors>({
    activityLabels: {},
    activityDates: {},
    paymentLabels: {},
    paymentValues: {},
  });

  const [globalFilter, setGlobalFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tableDatePreset, setTableDatePreset] = useState<TableDatePreset>('year');
  const [tableFromDate, setTableFromDate] = useState(defaultTableRange.fromDate);
  const [tableToDate, setTableToDate] = useState(defaultTableRange.toDate);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'weddingDate', desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });

  const [exportFrom, setExportFrom] = useState('');
  const [exportTo, setExportTo] = useState('');
  const [exportFmt, setExportFmt] = useState<'csv' | 'xlsx' | 'ods'>('csv');
  const [exporting, setExporting] = useState(false);

  const detailsRef = useRef<HTMLDetailsElement>(null);

  const timeOptions = useMemo(() => buildHalfHourTimeOptions(), []);

  const weddingTimeOptions = useMemo(() => {
    if (!weddingTime || timeOptions.includes(weddingTime)) return timeOptions;
    return [weddingTime, ...timeOptions];
  }, [weddingTime, timeOptions]);

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

  const getFirstInvalidWeddingFieldId = (errors: WeddingFormErrors) => {
    if (errors.brideFullName) return 'wedding-bride-name';
    if (errors.groomFullName) return 'wedding-groom-name';
    if (errors.weddingDate) return 'wedding-date';

    for (let index = 0; index < activities.length; index += 1) {
      if (errors.activityLabels[index]) return `wedding-activity-label-${index}`;
      if (errors.activityDates[index]) return `wedding-activity-date-${index}`;
    }

    for (let index = 0; index < paymentsReceived.length; index += 1) {
      if (errors.paymentLabels[index]) return `wedding-payment-label-${index}`;
      if (errors.paymentValues[index]) return `wedding-payment-value-${index}`;
    }

    return undefined;
  };

  const fetchWeddings = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${SITE_BASE_URL}/.netlify/functions/admin-weddings`, {
        headers: authHeader() as HeadersInit,
      });
      if (res.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!res.ok) throw new Error('Could not load weddings');
      const data = await res.json();
      setWeddings(Array.isArray(data) ? data : data.weddings ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchWeddings();
  }, [user]);

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

  const selectedCollectionPricing = useMemo(
    () => orderedPricingEntries.filter((entry) => selectedEntryIds.includes(entry.id)),
    [orderedPricingEntries, selectedEntryIds],
  );

  const normalizedCustomPricing = useMemo(
    () => customPricing
      .map((entry) => ({
        label: entry.label.trim(),
        value: Number(entry.value),
      }))
      .filter((entry) => entry.label && Number.isFinite(entry.value)),
    [customPricing],
  );

  const normalizedPaymentsReceived = useMemo(
    () => paymentsReceived
      .map((payment) => ({
        label: payment.label.trim(),
        value: Number(payment.value),
        dateReceived: payment.dateReceived || undefined,
      }))
      .filter((payment) => payment.label && Number.isFinite(payment.value)),
    [paymentsReceived],
  );

  const pricingItems = useMemo<WeddingPricingItem[]>(
    () => [
      ...selectedCollectionPricing.map((entry) => ({
        sourceType: 'collection' as const,
        entryKey: entry.id,
        label: entry.name,
        value: Number(entry.value || 0),
        quantity: entry.perUnit ? Math.max(1, entryQuantities[entry.id] ?? 1) : 1,
        billingTreatment: entry.billingTreatment ?? 'includedInTotals',
        isChecked: entry.isChecked,
      })),
      ...normalizedCustomPricing.map((entry) => ({
        sourceType: 'custom' as const,
        label: entry.label,
        value: Number(entry.value),
        quantity: 1,
        billingTreatment: 'includedInTotals' as const,
        isChecked: true,
      })),
    ],
    [selectedCollectionPricing, normalizedCustomPricing, entryQuantities],
  );

  const billablePricingItems = useMemo(
    () => pricingItems.filter((item) => !isOmittedFromTotal(item.billingTreatment)),
    [pricingItems],
  );

  const totalCost = useMemo(
    () => billablePricingItems.reduce((sum, item) => sum + item.value * item.quantity, 0),
    [billablePricingItems],
  );

  const refundableTotal = useMemo(
    () => billablePricingItems
      .filter((item) => isReturnedLater(item.billingTreatment))
      .reduce((sum, item) => sum + item.value * item.quantity, 0),
    [billablePricingItems],
  );

  const netCostAfterRefund = useMemo(
    () => totalCost - refundableTotal,
    [totalCost, refundableTotal],
  );

  const totalPaymentsReceived = useMemo(
    () => normalizedPaymentsReceived.reduce((sum, payment) => sum + payment.value, 0),
    [normalizedPaymentsReceived],
  );

  const balanceRemaining = useMemo(
    () => totalCost - totalPaymentsReceived,
    [totalCost, totalPaymentsReceived],
  );

  const filteredExportWeddings = useMemo(() => {
    const fromKey = exportFrom ? toDateKey(exportFrom) : '';
    const toKey = exportTo ? toDateKey(exportTo) : '';

    return weddings.filter((wedding) => {
      const weddingDateKey = toDateKey(wedding.weddingDate);
      if (!weddingDateKey) return false;
      if (fromKey && weddingDateKey < fromKey) return false;
      if (toKey && weddingDateKey > toKey) return false;
      return true;
    });
  }, [weddings, exportFrom, exportTo]);

  const filteredTableWeddings = useMemo(() => {
    const fromKey = tableFromDate ? toDateKey(tableFromDate) : '';
    const toKey = tableToDate ? toDateKey(tableToDate) : '';

    return weddings.filter((wedding) => {
      const weddingDateKey = toDateKey(wedding.weddingDate);
      if (!weddingDateKey) return false;
      if (fromKey && weddingDateKey < fromKey) return false;
      if (toKey && weddingDateKey > toKey) return false;
      return true;
    });
  }, [weddings, tableFromDate, tableToDate]);

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

  const resetForm = () => {
    setEditingId(null);
    setBride({ fullName: '', email: '', phone: '' });
    setGroom({ fullName: '', email: '', phone: '' });
    setOtherContacts([]);
    setWeddingDate('');
    setWeddingTime('');
    setNotes('');
    setActivities([]);
    setSelectedEntryIds(defaultSelectedEntryIds);
    setEntryQuantities({});
    setCustomPricing([]);
    setPaymentsReceived([]);
    setWeddingFormErrors({ activityLabels: {}, activityDates: {}, paymentLabels: {}, paymentValues: {} });
  };

  useEffect(() => {
    if (!editingId) {
      setSelectedEntryIds(defaultSelectedEntryIds);
    }
  }, [defaultSelectedEntryIds, editingId]);

  const fillFormForEdit = (wedding: Wedding) => {
    setEditingId(wedding._id);
    setBride({
      fullName: wedding.bride.fullName,
      email: wedding.bride.email ?? '',
      phone: wedding.bride.phone ?? '',
    });
    setGroom({
      fullName: wedding.groom.fullName,
      email: wedding.groom.email ?? '',
      phone: wedding.groom.phone ?? '',
    });
    setOtherContacts((wedding.otherContacts ?? [])
      .map((contact) => ({
        fullName: contact.fullName ?? '',
        role: contact.role ?? '',
        email: contact.email ?? '',
        phone: contact.phone ?? '',
      }))
      .filter((contact) => contact.fullName || contact.role || contact.email || contact.phone));
    setWeddingDate(wedding.weddingDate);
    setWeddingTime(wedding.weddingTime ?? '');
    setActivities(wedding.activities ?? []);
    setNotes(wedding.notes ?? '');

    const collectionIds = (wedding.pricingItems ?? [])
      .filter((item) => item.sourceType === 'collection' && item.entryKey)
      .map((item) => item.entryKey as string);
    const collectionQuantities = (wedding.pricingItems ?? [])
      .filter((item) => item.sourceType === 'collection' && item.entryKey)
      .reduce<Record<string, number>>((acc, item) => {
        acc[item.entryKey as string] = Math.max(1, Number(item.quantity ?? 1));
        return acc;
      }, {});
    const customItems = (wedding.pricingItems ?? [])
      .filter((item) => item.sourceType === 'custom')
      .map((item) => ({ label: item.label, value: String(item.value) }));
    const payments = (wedding.paymentsReceived ?? []).map((payment) => ({
      label: payment.label,
      value: String(payment.value),
      dateReceived: payment.dateReceived ?? '',
    }));

    setSelectedEntryIds(collectionIds);
    setEntryQuantities(collectionQuantities);
    setCustomPricing(customItems);
    setPaymentsReceived(payments);
    setWeddingFormErrors({ activityLabels: {}, activityDates: {}, paymentLabels: {}, paymentValues: {} });

    detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    detailsRef.current?.setAttribute('open', 'true');
  };

  const addActivity = () => {
    setActivities((prev) => [...prev, { label: '', date: '', time: '' }]);
  };

  const updateActivity = (index: number, key: keyof WeddingActivity, value: string) => {
    setActivities((prev) => prev.map((item, i) => (i === index ? { ...item, [key]: value } : item)));

    if (key === 'label' && value.trim()) {
      setWeddingFormErrors((prev) => ({
        ...prev,
        activityLabels: { ...prev.activityLabels, [index]: '' },
      }));
    }

    if (key === 'date' && value) {
      setWeddingFormErrors((prev) => ({
        ...prev,
        activityDates: { ...prev.activityDates, [index]: '' },
      }));
    }
  };

  const removeActivity = (index: number) => {
    setActivities((prev) => prev.filter((_, i) => i !== index));
  };

  const addCustomPricing = () => {
    setCustomPricing((prev) => [...prev, { label: '', value: '' }]);
  };

  const addPaymentReceived = () => {
    setPaymentsReceived((prev) => [...prev, { label: '', value: '', dateReceived: '' }]);
  };

  const addOtherContact = () => {
    setOtherContacts((prev) => [...prev, { fullName: '', role: '', email: '', phone: '' }]);
  };

  const updateOtherContact = (index: number, key: keyof WeddingContact, value: string) => {
    setOtherContacts((prev) => prev.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  };

  const removeOtherContact = (index: number) => {
    setOtherContacts((prev) => prev.filter((_, i) => i !== index));
  };

  const updateCustomPricing = (index: number, key: 'label' | 'value', value: string) => {
    setCustomPricing((prev) => prev.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  };

  const updatePaymentReceived = (index: number, key: 'label' | 'value' | 'dateReceived', value: string) => {
    setPaymentsReceived((prev) => prev.map((item, i) => (i === index ? { ...item, [key]: value } : item)));

    if (key === 'label' && value.trim()) {
      setWeddingFormErrors((prev) => ({
        ...prev,
        paymentLabels: { ...prev.paymentLabels, [index]: '' },
      }));
    }

    if (key === 'value' && value.trim() !== '' && Number.isFinite(Number(value))) {
      setWeddingFormErrors((prev) => ({
        ...prev,
        paymentValues: { ...prev.paymentValues, [index]: '' },
      }));
    }
  };

  const removeCustomPricing = (index: number) => {
    setCustomPricing((prev) => prev.filter((_, i) => i !== index));
  };

  const removePaymentReceived = (index: number) => {
    setPaymentsReceived((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleCollectionEntry = (entryId: string) => {
    setSelectedEntryIds((prev) =>
      prev.includes(entryId) ? prev.filter((id) => id !== entryId) : [...prev, entryId],
    );

    setEntryQuantities((prev) => ({
      ...prev,
      [entryId]: Math.max(1, prev[entryId] ?? 1),
    }));
  };

  const setEntryQty = (entryId: string, qty: number, max?: number) => {
    const parsed = Number.isFinite(qty) ? qty : 1;
    const clamped = Math.min(Math.max(1, parsed), max ?? Infinity);
    setEntryQuantities((prev) => ({ ...prev, [entryId]: clamped }));
  };

  const saveWedding = async (e: React.FormEvent) => {
    e.preventDefault();

    const nextErrors: WeddingFormErrors = {
      activityLabels: {},
      activityDates: {},
      paymentLabels: {},
      paymentValues: {},
    };

    if (!bride.fullName.trim()) nextErrors.brideFullName = 'Bride full name is required.';
    if (!groom.fullName.trim()) nextErrors.groomFullName = 'Groom full name is required.';
    if (!weddingDate) nextErrors.weddingDate = 'Wedding date is required.';

    activities.forEach((activity, index) => {
      const hasLabel = activity.label.trim().length > 0;
      const hasDate = Boolean(activity.date);
      if (hasLabel && !hasDate) {
        nextErrors.activityDates[index] = 'Date is required when a label is provided.';
      }
      if (hasDate && !hasLabel) {
        nextErrors.activityLabels[index] = 'Label is required when a date is provided.';
      }
    });

    paymentsReceived.forEach((payment, index) => {
      const hasLabel = payment.label.trim().length > 0;
      const hasValue = payment.value.trim() !== '';
      if (hasLabel && !hasValue) {
        nextErrors.paymentValues[index] = 'Value is required when a label is provided.';
      }
      if (hasValue && !hasLabel) {
        nextErrors.paymentLabels[index] = 'Label is required when a value is provided.';
      }
    });

    if (
      nextErrors.brideFullName ||
      nextErrors.groomFullName ||
      nextErrors.weddingDate ||
      Object.keys(nextErrors.activityLabels).some((key) => Boolean(nextErrors.activityLabels[Number(key)])) ||
      Object.keys(nextErrors.activityDates).some((key) => Boolean(nextErrors.activityDates[Number(key)])) ||
      Object.keys(nextErrors.paymentLabels).some((key) => Boolean(nextErrors.paymentLabels[Number(key)])) ||
      Object.keys(nextErrors.paymentValues).some((key) => Boolean(nextErrors.paymentValues[Number(key)]))
    ) {
      setWeddingFormErrors(nextErrors);
      const firstInvalidFieldId = getFirstInvalidWeddingFieldId(nextErrors);
      if (firstInvalidFieldId) {
        requestAnimationFrame(() => focusAndScrollToField(firstInvalidFieldId));
      }
      return;
    }

    setWeddingFormErrors({ activityLabels: {}, activityDates: {}, paymentLabels: {}, paymentValues: {} });

    setSaving(true);
    try {
      const payload = {
        id: editingId ?? undefined,
        status: 'active',
        bride,
        groom,
        otherContacts: otherContacts
          .map((contact) => ({
            fullName: (contact.fullName ?? '').trim(),
            role: (contact.role ?? '').trim(),
            email: (contact.email ?? '').trim(),
            phone: (contact.phone ?? '').trim(),
          }))
          .filter((contact) => contact.fullName || contact.role || contact.email || contact.phone),
        weddingDate,
        weddingTime: weddingTime || undefined,
        activities: activities.filter((activity) => activity.label.trim() && activity.date),
        notes,
        pricingItems,
        paymentsReceived: normalizedPaymentsReceived,
      };

      const res = await fetch(`${SITE_BASE_URL}/.netlify/functions/admin-weddings`, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', ...(authHeader() as HeadersInit) },
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Save failed');
      }

      await fetchWeddings();
      flash(editingId ? 'Wedding updated' : 'Wedding created');
      resetForm();
    } catch (err) {
      flash(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const updateWeddingStatus = async (wedding: Wedding, status: 'active' | 'cancelled') => {
    const bride = wedding.bride.fullName || 'Unknown Bride';
    const groom = wedding.groom.fullName || 'Unknown Groom';
    const date = wedding.weddingDate || 'Unknown Date';
    const confirmMessage = status === 'cancelled'
      ? `Suspending this wedding (${bride}/${groom}: ${date}) as "${status}" will retain all present information - no data will be lost and it will still be accessible. Proceed?`
      : `Do you want to reactivate this wedding (${bride}/${groom}: ${date})?`;

    if (!confirm(confirmMessage)) return;

    const res = await fetch(`${SITE_BASE_URL}/.netlify/functions/admin-weddings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(authHeader() as HeadersInit) },
      body: JSON.stringify({ ...wedding, id: wedding._id, status }),
    });
    if (res.status === 401) {
      handleUnauthorized();
      return;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Status update failed');
    }
    await fetchWeddings();
    flash(status === 'cancelled' ? 'Wedding marked cancelled' : 'Wedding reactivated');
  };

  const deleteWedding = async (id: string) => {
    if (!id) {
      flash('Error: Missing wedding ID');
      return;
    }

    const bride = weddings.find((w) => w._id === id)?.bride.fullName || 'Unknown Bride';
    const groom = weddings.find((w) => w._id === id)?.groom.fullName || 'Unknown Groom';
    const date = weddings.find((w) => w._id === id)?.weddingDate || 'Unknown Date';
    const isCancelled = weddings.find((w) => w._id === id)?.status === 'cancelled';
    const confirmMessage = isCancelled
      ? `This wedding (${bride}/${groom}: ${date}) is currently suspended. Deleting it will permanently remove all information. Proceed to delete?`
      : `If you wish to retain the information for this wedding (${bride}/${groom}: ${date}), use the "Suspend wedding" button instead. Proceed to delete this wedding booking permanently?`;

    if (!confirm(confirmMessage)) return;

    try {
      console.log('Deleting wedding with ID:', id);

      const res = await fetch(
        `${SITE_BASE_URL}/.netlify/functions/admin-weddings?id=${encodeURIComponent(id)}`,
        {
          method: 'DELETE',
          headers: authHeader() as HeadersInit,
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

      await fetchWeddings();
      flash('Wedding deleted successfully');
    } catch (err) {
      console.error('Delete error:', err);
      flash(`Error: ${err instanceof Error ? err.message : 'Failed to delete wedding'}`);
    }
  };

  const printStyles = `
    body { font-family: Georgia, serif; padding: 24px; }
    h1, h2 { margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; table-layout: fixed; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; vertical-align: top; }
    .right { text-align: right; font-weight: 700; }
    small { display: block; font-weight: 400; }
    .print-section { break-inside: avoid; page-break-inside: avoid; }
    .print-section:not(:last-child) { break-after: page; page-break-after: always; }
  `;

  const getWeddingPrintTotals = (wedding: Wedding) => {
    const { total, netTotal } = getWeddingTotals(wedding);
    return { total, netTotal };
  };

  const renderWeddingPrintSection = (wedding: Wedding) => {
    const contactRows = [
      {
        role: 'Bride',
        name: wedding.bride.fullName,
        email: wedding.bride.email ?? '',
        phone: wedding.bride.phone ?? '',
      },
      {
        role: 'Groom',
        name: wedding.groom.fullName,
        email: wedding.groom.email ?? '',
        phone: wedding.groom.phone ?? '',
      },
      ...(wedding.otherContacts ?? []).map((contact, index) => ({
        name: contact.fullName ?? '',
        role: contact.role || `Other Contact ${index + 1}`,
        email: contact.email ?? '',
        phone: contact.phone ?? '',
      })),
    ]
      .filter((contact) => contact.name || contact.role || contact.email || contact.phone)
      .map((contact) => `<tr><td>${contact.role}</td><td>${contact.name}</td><td>${contact.email}</td><td>${contact.phone}</td></tr>`)
      .join('');

    const details = (wedding.activities ?? [])
      .filter((activity) => activity.label && activity.date)
      .map((activity) => `<tr><td>${activity.label}</td><td>${formatDatePretty(activity.date)}</td><td>${activity.time ? to12HourTime(activity.time) : ''}</td></tr>`)
      .join('');

    const pricing = (wedding.pricingItems ?? [])
      .map((item) => {
        const qty = Math.max(1, Number(item.quantity ?? 1));
        const label = qty > 1 ? `${item.label} x ${qty}` : item.label;
        return `<tr><td>${label}</td><td style="text-align:right;">${money(item.value * qty)}</td></tr>`;
      })
      .join('');

    const totals = getWeddingPrintTotals(wedding);
    const payments = (wedding.paymentsReceived ?? [])
      .map((payment) => `<tr><td>${payment.label}${payment.dateReceived ? `<small>${formatDatePretty(payment.dateReceived)}</small>` : ''}</td><td style="text-align:right;">${money(payment.value)}</td></tr>`)
      .join('');
    const paymentsTotal = getPaymentsReceivedTotal(wedding);
    const balanceRemaining = getBalanceRemaining(wedding);
    const notes = wedding.notes?.trim();

    return `
      <section class="print-section">
        <h1>Wedding: ${wedding.bride.fullName} & ${wedding.groom.fullName}</h1>
        <h2>${formatDatePretty(wedding.weddingDate)}${wedding.weddingTime ? ` at ${to12HourTime(wedding.weddingTime)}` : ''}</h2>
        <h2>Contacts</h2>
        <table>
          <tr><th>Role</th><th>Name</th><th>Email</th><th>Phone</th></tr>
          ${contactRows}
        </table>
        ${details ? `
        <h2>Additional Activities</h2>
        <table>
          <tr><th>Label</th><th>Date</th><th>Time</th></tr>
          ${details}
        </table>
        ` : ''}
        <h2>Pricing</h2>
        <table>
          <tr><th>Item</th><th>Value</th></tr>
          ${pricing}
          <tr><td class="right">Total</td><td class="right">${money(totals.total)}</td></tr>
          <tr><td class="right">Net Total <small>(after refundable items are returned)</small></td><td class="right">${money(totals.netTotal)}</td></tr>
        </table>
        <h2>Payments Received</h2>
        <table>
          <tr><th>Payment</th><th>Value</th></tr>
          ${payments || '<tr><td>No payments received.</td><td style="text-align:right;">$0.00</td></tr>'}
          <tr><td class="right">Total Payments Received</td><td class="right">${money(paymentsTotal)}</td></tr>
          <tr><td class="right">Balance Remaining</td><td class="right">${money(balanceRemaining)}</td></tr>
        </table>
        ${notes ? `<h2>Notes</h2><p>${notes.replace(/\n/g, '<br>')}</p>` : ''}
      </section>
    `;
  };

  const renderWeddingPrintDocument = (title: string, sectionsHtml: string) => `
    <html>
      <head>
        <title>${title}</title>
        <style>${printStyles}</style>
      </head>
      <body>${sectionsHtml}</body>
    </html>
  `;

  const printWedding = (wedding: Wedding) => {
    const html = renderWeddingPrintDocument('Wedding Summary', renderWeddingPrintSection(wedding));

    const printWindow = window.open('', '_blank', 'width=1000,height=800');
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const printAllWeddings = () => {
    const weddingsToPrint = table.getSortedRowModel().rows.map((row) => row.original);
    if (weddingsToPrint.length === 0) {
      flash('No weddings available to print.');
      return;
    }

    const sectionsHtml = weddingsToPrint.map((wedding) => renderWeddingPrintSection(wedding)).join('');
    const html = renderWeddingPrintDocument('All Wedding Summaries', sectionsHtml);

    const printWindow = window.open('', '_blank', 'width=1200,height=900');
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const exportWeddings = () => {
    setExporting(true);
    try {
      if (filteredExportWeddings.length === 0) {
        flash('No weddings found for the selected date range.');
        return;
      }

      const rows = filteredExportWeddings.map((wedding) => ({
        'Wedding Date': formatDatePretty(wedding.weddingDate),
        'Wedding Time': wedding.weddingTime ? to12HourTime(wedding.weddingTime) : '',
        Status: wedding.status,
        Bride: wedding.bride.fullName,
        Groom: wedding.groom.fullName,
        'Final Cost': wedding.finalCost,
        ...(() => {
          const { netTotal } = getWeddingTotals(wedding);
          return { 'Net Cost': netTotal };
        })(),
        'Payments Received Total': getPaymentsReceivedTotal(wedding),
        'Balance Remaining': getBalanceRemaining(wedding),
        'Other Contacts': (wedding.otherContacts ?? [])
          .map((contact) => [contact.fullName ?? '', contact.role ?? '', contact.email ?? '', contact.phone ?? ''].filter(Boolean).join(' | '))
          .filter(Boolean)
          .join(' || '),
        Activities: (wedding.activities ?? [])
          .map((item) => `${item.label}: ${formatDatePretty(item.date)}${item.time ? ` ${to12HourTime(item.time)}` : ''}`)
          .join(' | '),
        'Payments Received': (wedding.paymentsReceived ?? [])
          .map((payment) => `${payment.label}: ${money(payment.value)}${payment.dateReceived ? ` on ${formatDatePretty(payment.dateReceived)}` : ''}`)
          .join(' | '),
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Weddings');

      const dateStamp = new Date().toISOString().split('T')[0];
      const filename = `lnhf-weddings-${dateStamp}.${exportFmt}`;
      const bookType = exportFmt === 'csv' ? 'csv' : exportFmt === 'ods' ? 'ods' : 'xlsx';
      XLSX.writeFile(wb, filename, { bookType });
    } finally {
      setExporting(false);
    }
  };

  const columns = [
    columnHelper.accessor('weddingDate', {
      header: 'Date',
      cell: (info) => fmtDate(info.getValue()),
      sortingFn: 'alphanumeric',
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: (info) => <span className={`admin-badge admin-badge--${info.getValue()}`}>{info.getValue()}</span>,
      filterFn: 'equals',
    }),
    columnHelper.accessor((row) => row.bride.fullName, {
      id: 'bride',
      header: 'Bride',
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor((row) => row.groom.fullName, {
      id: 'groom',
      header: 'Groom',
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor('finalCost', {
      header: 'Final Cost',
      cell: (info) => money(Number(info.getValue())),
      sortingFn: 'alphanumeric',
    }),
    // columnHelper.accessor((row) => getWeddingTotals(row).netTotal, {
    //   id: 'netCost',
    //   header: 'Net Cost',
    //   cell: (info) => money(Number(info.getValue())),
    //   sortingFn: 'alphanumeric',
    // }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: (info) => {
        const wedding = info.row.original;
        return (
          <div className="admin-td-actions">
            <button aria-label="Edit wedding" className="admin-btn admin-btn--warn" onClick={() => fillFormForEdit(wedding)}>
              {ICONS.Edit}
            </button>
            {wedding.status === 'active' ? (
              <button aria-label="Suspend wedding" className="admin-btn admin-btn--muted" onClick={() => updateWeddingStatus(wedding, 'cancelled')}>
                {ICONS.PauseOutlineRounded}
              </button>
            ) : (
              <button aria-label="Reactivate wedding" className="admin-btn admin-btn--good" onClick={() => updateWeddingStatus(wedding, 'active')}>
                {ICONS.Play}
              </button>
            )}
            <button aria-label="Delete wedding" className="admin-btn admin-btn--danger" onClick={() => deleteWedding(wedding._id)}>
              {ICONS.Delete}
            </button>
            <button aria-label="Print wedding" className="admin-btn admin-btn--muted" onClick={() => printWedding(wedding)}>
              {ICONS.Print}
            </button>
          </div>
        );
      },
    }),
  ];

  const table = useReactTable({
    data: filteredTableWeddings,
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
        <p>Please log in with Netlify Identity to manage weddings.</p>
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
          <h1 className="admin-manager__title">Weddings Manager</h1>
          <p className="admin-manager__subtitle">Create and manage wedding bookings, activities, and pricing.</p>
        </div>
        <div className="admin-manager__controls">
          <div>
            <button className="btn btn--primary btn--sm" onClick={fetchWeddings} disabled={loading} style={{ marginRight: 'var(--space-2)' }}>
              {loading ? 'Loading...' : 'Refresh wedding database'}
            </button>
            <details className="table-details-help">
              <summary>What does this do?</summary>
              <p>This will refresh the <strong>Wedding Database</strong> table displayed below by fetching the latest wedding bookings from the server.</p>
            </details>
          </div>
          <button className="btn btn--secondary btn--sm" onClick={() => netlifyIdentity.logout()}>
            Log Out
          </button>
        </div>
      </div>

      <div className="admin-manager__msg-container" aria-live="polite">
        {msg && <div className="admin-manager__msg"><p>{msg}</p></div>}
        {error && <div className="admin-manager__error"><p>{error}</p></div>}
      </div>

      <section className="admin-manager__section">
        <details className="admin-manager__export">
          <summary className="admin-manager__export-summary">
            <h2 className="admin-manager__section-title">Wedding Database</h2>
          </summary>
          <div className="admin-manager__section-inner">
            <div className="table-controls">
              <fieldset className="table-date-range">
                <legend className="form-label">Filter Attributes</legend>
                <label>
                  Search Weddings
                  <input
                    className="form-input table-search"
                    type="search"
                    placeholder="Enter bride or groom name"
                    value={globalFilter}
                    onChange={(e) => setGlobalFilter(e.target.value)}
                  />
                </label>
                <label>
                  Filter by Wedding Status
                  <select className="form-select table-status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="">All statuses</option>
                    <option value="active">Active</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </label>
              </fieldset>

              <fieldset className="table-date-range" aria-label="Weddings date range filters">
                <legend className="form-label">Filter Date range</legend>
                <div className="table-date-range__grid">
                  <div className="table-date-range__presets" role="radiogroup" aria-label="Quick date ranges for weddings">
                    <strong>Preset ranges:</strong>
                    <label className="table-date-range__preset-option">
                      <input
                        type="radio"
                        name="wedding-table-date-preset"
                        checked={tableDatePreset === 'week'}
                        onChange={() => applyTableDatePreset('week')}
                      />
                      This week
                    </label>
                    <label className="table-date-range__preset-option">
                      <input
                        type="radio"
                        name="wedding-table-date-preset"
                        checked={tableDatePreset === 'month'}
                        onChange={() => applyTableDatePreset('month')}
                      />
                      This month
                    </label>
                    <label className="table-date-range__preset-option">
                      <input
                        type="radio"
                        name="wedding-table-date-preset"
                        checked={tableDatePreset === 'year'}
                        onChange={() => applyTableDatePreset('year')}
                      />
                      This year
                    </label>
                    <label className="table-date-range__preset-option">
                      <input
                        type="radio"
                        name="wedding-table-date-preset"
                        checked={tableDatePreset === ''}
                        onChange={() => clearTableDateRange()}
                      />
                      All time
                    </label>
                  </div>

                  <div className="table-date-range__fields">
                    <strong>Custom range:</strong>
                    <div className="form-group">
                      <label className="form-label" htmlFor="wedding-table-date-from">From date</label>
                      <input
                        id="wedding-table-date-from"
                        className="form-input table-date-filter"
                        type="date"
                        value={tableFromDate}
                        max={tableToDate || undefined}
                        onChange={(e) => {
                          setTableDatePreset('');
                          setTableFromDate(e.target.value);
                        }}
                        aria-label="Filter weddings from date"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="wedding-table-date-to">To date</label>
                      <input
                        id="wedding-table-date-to"
                        className="form-input table-date-filter"
                        type="date"
                        value={tableToDate}
                        min={tableFromDate || undefined}
                        onChange={(e) => {
                          setTableDatePreset('');
                          setTableToDate(e.target.value);
                        }}
                        aria-label="Filter weddings to date"
                      />
                    </div>
                  </div>
                </div>

              </fieldset>
            </div>
          </div>

          {filteredTableWeddings.length === 0 && !loading ? (
            <p className="admin-manager__empty">No weddings found. Add one above.</p>
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
                        <td colSpan={columns.length} className="admin-manager__empty">No weddings match your filters.</td>
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
                  <button className="admin-btn" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()} aria-label="First page">«</button>
                  <button className="admin-btn" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Previous page">‹</button>
                  <span className="table-pagination__page">Page {pageIndex + 1} of {pageCount || 1}</span>
                  <button className="admin-btn" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Next page">›</button>
                  <button className="admin-btn" onClick={() => table.setPageIndex(pageCount - 1)} disabled={!table.getCanNextPage()} aria-label="Last page">»</button>
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
        <details className="admin-manager__export" ref={detailsRef}>
          <summary className="admin-manager__export-summary">
            <h2 className="admin-manager__section-title">{editingId ? 'Edit Existing Wedding' : 'Add New Wedding'}</h2>
          </summary>
          <form className="admin-manager__grid" style={{ padding: 'var(--space-4)' }} onSubmit={saveWedding} noValidate>
            <fieldset className="admin-manager__fieldset">
              <legend>Bride</legend>
              <div className="form-group">
                <label className="form-label" htmlFor="wedding-bride-name">Full Name *</label>
                <input
                  id="wedding-bride-name"
                  className={`form-input${weddingFormErrors.brideFullName ? ' is-invalid' : ''}`}
                  value={bride.fullName}
                  onChange={(e) => {
                    const value = e.target.value;
                    setBride((prev) => ({ ...prev, fullName: value }));
                    if (value.trim()) {
                      setWeddingFormErrors((prev) => ({ ...prev, brideFullName: undefined }));
                    }
                  }}
                  required
                  aria-invalid={Boolean(weddingFormErrors.brideFullName)}
                  aria-describedby={weddingFormErrors.brideFullName ? 'wedding-bride-name-error' : undefined}
                />
                {weddingFormErrors.brideFullName && <p className="admin-field-error" id="wedding-bride-name-error">{weddingFormErrors.brideFullName}</p>}
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="wedding-bride-email">Email</label>
                <input id="wedding-bride-email" className="form-input" type="email" value={bride.email} onChange={(e) => setBride((prev) => ({ ...prev, email: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="wedding-bride-phone">Phone</label>
                <input id="wedding-bride-phone" className="form-input" value={bride.phone} onChange={(e) => setBride((prev) => ({ ...prev, phone: e.target.value }))} />
              </div>
            </fieldset>

            <fieldset className="admin-manager__fieldset">
              <legend>Groom</legend>
              <div className="form-group">
                <label className="form-label" htmlFor="wedding-groom-name">Full Name *</label>
                <input
                  id="wedding-groom-name"
                  className={`form-input${weddingFormErrors.groomFullName ? ' is-invalid' : ''}`}
                  value={groom.fullName}
                  onChange={(e) => {
                    const value = e.target.value;
                    setGroom((prev) => ({ ...prev, fullName: value }));
                    if (value.trim()) {
                      setWeddingFormErrors((prev) => ({ ...prev, groomFullName: undefined }));
                    }
                  }}
                  required
                  aria-invalid={Boolean(weddingFormErrors.groomFullName)}
                  aria-describedby={weddingFormErrors.groomFullName ? 'wedding-groom-name-error' : undefined}
                />
                {weddingFormErrors.groomFullName && <p className="admin-field-error" id="wedding-groom-name-error">{weddingFormErrors.groomFullName}</p>}
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="wedding-groom-email">Email</label>
                <input id="wedding-groom-email" className="form-input" type="email" value={groom.email} onChange={(e) => setGroom((prev) => ({ ...prev, email: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="wedding-groom-phone">Phone</label>
                <input id="wedding-groom-phone" className="form-input" value={groom.phone} onChange={(e) => setGroom((prev) => ({ ...prev, phone: e.target.value }))} />
              </div>
            </fieldset>

            <fieldset className="admin-manager__fieldset admin-manager__fieldset--other-contacts">
              <legend>Other Contacts</legend>
              <button type="button" className="btn btn-secondary" onClick={addOtherContact}>{ICONS.Plus} Add Other Contact</button>
              <div className="admin-manager__other-contacts-collection">
                {otherContacts.map((contact, index) => (
                  <div key={index} className="is-addons">
                    <div className="form-group">
                      <label className="form-label" htmlFor={`wedding-other-name-${index}`}>Full Name</label>
                      <input
                        id={`wedding-other-name-${index}`}
                        className="form-input"
                        value={contact.fullName ?? ''}
                        onChange={(e) => updateOtherContact(index, 'fullName', e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor={`wedding-other-role-${index}`}>Role</label>
                      <input
                        id={`wedding-other-role-${index}`}
                        className="form-input"
                        value={contact.role ?? ''}
                        onChange={(e) => updateOtherContact(index, 'role', e.target.value)}
                      />
                      <p>e.g. parent, wedding planner, photographer</p>
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor={`wedding-other-email-${index}`}>Email</label>
                      <input
                        id={`wedding-other-email-${index}`}
                        className="form-input"
                        type="email"
                        value={contact.email ?? ''}
                        onChange={(e) => updateOtherContact(index, 'email', e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor={`wedding-other-phone-${index}`}>Phone</label>
                      <input
                        id={`wedding-other-phone-${index}`}
                        className="form-input"
                        value={contact.phone ?? ''}
                        onChange={(e) => updateOtherContact(index, 'phone', e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <button type="button" className="admin-btn admin-btn--danger" onClick={() => removeOtherContact(index)}>
                        {ICONS.Delete} Remove
                      </button>
                    </div>
                  </div>
                ))}

              </div>
            </fieldset>

            <fieldset className="admin-manager__fieldset admin-manager__fieldset--wedding-dates">
              <legend>Event Date(s)</legend>
              <div className="admin-manager__other-contacts-collection">
                <div className="form-group">
                  <label className="form-label" htmlFor="wedding-date">Wedding Date *</label>
                  <input
                    id="wedding-date"
                    className={`form-input${weddingFormErrors.weddingDate ? ' is-invalid' : ''}`}
                    type="date"
                    value={weddingDate}
                    onChange={(e) => {
                      const value = e.target.value;
                      setWeddingDate(value);
                      if (value) {
                        setWeddingFormErrors((prev) => ({ ...prev, weddingDate: undefined }));
                      }
                    }}
                    required
                    aria-invalid={Boolean(weddingFormErrors.weddingDate)}
                    aria-describedby={weddingFormErrors.weddingDate ? 'wedding-date-error' : undefined}
                  />
                  {weddingFormErrors.weddingDate && <p className="admin-field-error" id="wedding-date-error">{weddingFormErrors.weddingDate}</p>}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="wedding-time">Wedding Time</label>
                  <select
                    id="wedding-time"
                    className="form-select"
                    value={weddingTime}
                    onChange={(e) => setWeddingTime(e.target.value)}
                  >
                    <option value="">Select time...</option>
                    {weddingTimeOptions.map((timeValue) => (
                      <option key={timeValue} value={timeValue}>{to12HourTime(timeValue)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button type="button" className="btn btn-secondary" onClick={addActivity}>{ICONS.Plus} Add Related Activity Date</button>

              <div className="admin-manager__other-contacts-collection">
                {activities.map((activity, index) => (
                  <div key={index} className="is-addons">
                    <div className="form-group">
                      <label className="form-label" htmlFor={`wedding-activity-label-${index}`}>Label *</label>
                      <input
                        id={`wedding-activity-label-${index}`}
                        className={`form-input${weddingFormErrors.activityLabels[index] ? ' is-invalid' : ''}`}
                        value={activity.label}
                        onChange={(e) => updateActivity(index, 'label', e.target.value)}
                        placeholder="Ceremony, reception, photoshoot"
                        aria-invalid={Boolean(weddingFormErrors.activityLabels[index])}
                        aria-describedby={weddingFormErrors.activityLabels[index] ? `wedding-activity-label-error-${index}` : undefined}
                      />
                      {weddingFormErrors.activityLabels[index] && (
                        <p className="admin-field-error" id={`wedding-activity-label-error-${index}`}>
                          {weddingFormErrors.activityLabels[index]}
                        </p>
                      )}
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor={`wedding-activity-date-${index}`}>Date *</label>
                      <input
                        id={`wedding-activity-date-${index}`}
                        className={`form-input${weddingFormErrors.activityDates[index] ? ' is-invalid' : ''}`}
                        type="date"
                        value={activity.date}
                        onChange={(e) => updateActivity(index, 'date', e.target.value)}
                        aria-invalid={Boolean(weddingFormErrors.activityDates[index])}
                        aria-describedby={weddingFormErrors.activityDates[index] ? `wedding-activity-date-error-${index}` : undefined}
                      />
                      {weddingFormErrors.activityDates[index] && (
                        <p className="admin-field-error" id={`wedding-activity-date-error-${index}`}>
                          {weddingFormErrors.activityDates[index]}
                        </p>
                      )}
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor={`wedding-activity-time-${index}`}>Time</label>
                      <select
                        id={`wedding-activity-time-${index}`}
                        className="form-select"
                        value={activity.time ?? ''}
                        onChange={(e) => updateActivity(index, 'time', e.target.value)}
                      >
                        <option value="">Select time...</option>
                        {activity.time && !timeOptions.includes(activity.time) && (
                          <option value={activity.time}>{to12HourTime(activity.time)}</option>
                        )}
                        {timeOptions.map((timeValue) => (
                          <option key={timeValue} value={timeValue}>{to12HourTime(timeValue)}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <button type="button" className="admin-btn admin-btn--danger" onClick={() => removeActivity(index)}>{ICONS.Delete} Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            </fieldset>

            <fieldset className="admin-manager__fieldset admin-manager__fieldset--wedding-pricing">
              <legend>Pricing</legend>
              <details className="table-details-help">
                <summary>How to Customize Pricing</summary>
                <p style={{ marginBlockEnd: 'var(--space-5)' }}>To customize the available pricing options, edit via the CMS by logging in at <a href={`${import.meta.env.SITE}admin/`} target="_blank" rel="noopener noreferrer">the admin panel</a> and navigating to the "Pricing" collection.</p>
              </details>
              <div className="admin-manager__pricing-collection">
                <div>
                  <div className="admin-manager__actions-row">
                    <div className="form-group checks-vertical">
                      {orderedPricingEntries.map((entry) => (
                        <label key={entry.id} className="form-label" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input
                            type="checkbox"
                            checked={selectedEntryIds.includes(entry.id)}
                            onChange={() => toggleCollectionEntry(entry.id)}
                          />
                          <div>
                            <span>{entry.name} </span>
                            <span className={`is-${entry.value < 0 ? 'negative' : 'positive'}`}>{money(entry.value)}</span>
                            {entry.perUnit && selectedEntryIds.includes(entry.id) && (
                              <>
                                {' '}x{' '}
                                <input
                                  type="number"
                                  className="pricing-table__qty-input"
                                  min={1}
                                  max={entry.maxUnits}
                                  value={entryQuantities[entry.id] ?? 1}
                                  onChange={(e) => setEntryQty(entry.id, parseInt(e.target.value, 10), entry.maxUnits)}
                                  aria-label={`Quantity for ${entry.name}`}
                                  style={{ width: '72px', marginInlineStart: '4px' }}
                                />
                              </>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="form-group">
                    <button type="button" className="btn btn-secondary" onClick={addCustomPricing}>{ICONS.Plus} Add Other Pricing Entry</button>
                  </div>
                </div>
                <div>
                  <table className="admin-manager__pricing-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pricingItems.length === 0 && (
                        <tr>
                          <td colSpan={2}>No pricing items selected.</td>
                        </tr>
                      )}
                      {pricingItems.map((item, index) => (
                        <tr key={`${item.label}-${index}`}>
                          <td>
                            {item.label}{item.quantity > 1 ? ` x ${item.quantity}` : ''}
                            {isReturnedLater(item.billingTreatment) && !isOmittedFromTotal(item.billingTreatment) ? ' (Refundable)' : ''}
                          </td>
                          <td className={`is-${item.value * item.quantity < 0 ? 'negative' : 'positive'}`}>{money(item.value * item.quantity)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <th scope="row">Total Amount Due <br /><small>Including refundable items</small></th>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(totalCost)}</td>
                      </tr>
                      <tr>
                        <th scope="row">Net Cost <br /><small>After Refundable Amounts Are Returned</small></th>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(netCostAfterRefund)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
              <div className="admin-manager__other-contacts-collection">
                {customPricing.map((entry, index) => (
                  <div key={index} className="is-addons">
                    <div className="form-group">
                      <label className="form-label" htmlFor={`wedding-custom-label-${index}`}>Label *</label>
                      <input id={`wedding-custom-label-${index}`} className="form-input" value={entry.label} onChange={(e) => updateCustomPricing(index, 'label', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor={`wedding-custom-value-${index}`}>Value *</label>
                      <input id={`wedding-custom-value-${index}`} className="form-input" type="number" step="0.01" value={entry.value} onChange={(e) => updateCustomPricing(index, 'value', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <button type="button" className="admin-btn admin-btn--danger" onClick={() => removeCustomPricing(index)}>{ICONS.Delete} Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            </fieldset>

            <fieldset className="admin-manager__fieldset admin-manager__fieldset--payments-received">
              <legend>Payments Received</legend>
              <button type="button" className="btn btn-secondary" onClick={addPaymentReceived}>{ICONS.Plus} Add Payment Received</button>

              <div className="admin-manager__other-contacts-collection">
                {paymentsReceived.map((payment, index) => (
                  <div key={index} className="is-addons">
                    <div className="form-group">
                      <label className="form-label" htmlFor={`wedding-payment-label-${index}`}>Label *</label>
                      <input
                        id={`wedding-payment-label-${index}`}
                        className={`form-input${weddingFormErrors.paymentLabels[index] ? ' is-invalid' : ''}`}
                        value={payment.label}
                        onChange={(e) => updatePaymentReceived(index, 'label', e.target.value)}
                        aria-invalid={Boolean(weddingFormErrors.paymentLabels[index])}
                        aria-describedby={weddingFormErrors.paymentLabels[index] ? `wedding-payment-label-error-${index}` : undefined}
                      />
                      {weddingFormErrors.paymentLabels[index] && (
                        <p className="admin-field-error" id={`wedding-payment-label-error-${index}`}>
                          {weddingFormErrors.paymentLabels[index]}
                        </p>
                      )}
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor={`wedding-payment-value-${index}`}>Value *</label>
                      <input
                        id={`wedding-payment-value-${index}`}
                        className={`form-input${weddingFormErrors.paymentValues[index] ? ' is-invalid' : ''}`}
                        type="number"
                        step="0.01"
                        value={payment.value}
                        onChange={(e) => updatePaymentReceived(index, 'value', e.target.value)}
                        aria-invalid={Boolean(weddingFormErrors.paymentValues[index])}
                        aria-describedby={weddingFormErrors.paymentValues[index] ? `wedding-payment-value-error-${index}` : undefined}
                      />
                      {weddingFormErrors.paymentValues[index] && (
                        <p className="admin-field-error" id={`wedding-payment-value-error-${index}`}>
                          {weddingFormErrors.paymentValues[index]}
                        </p>
                      )}
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor={`wedding-payment-date-${index}`}>Date Received</label>
                      <input
                        id={`wedding-payment-date-${index}`}
                        className="form-input"
                        type="date"
                        value={payment.dateReceived}
                        onChange={(e) => updatePaymentReceived(index, 'dateReceived', e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <button type="button" className="admin-btn admin-btn--danger" onClick={() => removePaymentReceived(index)}>{ICONS.Delete} Remove</button>
                    </div>
                  </div>
                ))}
              </div>

              <table className="admin-manager__pricing-table admin-manager__payments-table">
                <tbody>
                  <tr>
                    <th scope="row">Payments Received</th>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(totalPaymentsReceived)}</td>
                  </tr>
                  <tr>
                    <th scope="row">Balance Remaining</th>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(balanceRemaining)}</td>
                  </tr>
                </tbody>
              </table>
            </fieldset>
            <fieldset className="admin-manager__fieldset admin-manager__fieldset--wedding-notes">
              <legend>Details and Notes</legend>
              <div className="form-group">
                <label className="form-label" htmlFor="wedding-notes">Comments, questions, or special requests</label>
                <textarea id="wedding-notes" className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </fieldset>

            <div className="admin-manager__actions-row">
              <button className="btn btn--primary" type="submit" disabled={saving}>
                {saving ? 'Saving...' : editingId ? 'Update Wedding' : 'Create Wedding'}
              </button>
              {editingId && (
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => {
                    resetForm();
                    detailsRef.current?.removeAttribute('open');
                    detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                >
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
            <h2 className="admin-manager__section-title">Export Weddings</h2>
          </summary>
          <div className="admin-manager__export-controls">
            <div className="form-group">
              <label className="form-label" htmlFor="wedding-exp-from">From date</label>
              <input
                className="form-input"
                type="date"
                id="wedding-exp-from"
                value={exportFrom}
                onChange={(e) => setExportFrom(e.target.value)}
                max={exportTo || undefined}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="wedding-exp-to">To date</label>
              <input
                className="form-input"
                type="date"
                id="wedding-exp-to"
                value={exportTo}
                onChange={(e) => setExportTo(e.target.value)}
                min={exportFrom || undefined}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="wedding-export-format">Format</label>
              <select id="wedding-export-format" className="form-select" value={exportFmt} onChange={(e) => setExportFmt(e.target.value as 'csv' | 'xlsx' | 'ods')}>
                <option value="csv">CSV (.csv)</option>
                <option value="xlsx">Excel (.xlsx)</option>
                <option value="ods">OpenDocument (.ods)</option>
              </select>
            </div>
            <div className="form-group is-button">
              <button className="btn btn--primary btn--sm" onClick={exportWeddings} disabled={exporting || filteredExportWeddings.length === 0}>
                {exporting ? 'Exporting...' : 'Download'}
              </button>
              <div className="admin-manager__export-count">{filteredExportWeddings.length} wedding(s) in selected range</div>
            </div>
          </div>
        </details>
      </section>

    </div>
  );
}
