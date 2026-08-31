interface DateRangeFieldsetProps {
  tableDatePreset: 'week' | 'month' | 'year' | '';
  applyTableDatePreset: (preset: 'week' | 'month' | 'year') => void;
  clearTableDateRange: () => void;
  tableFromDate: string;
  tableToDate: string;
  setTableDatePreset: (preset: 'week' | 'month' | 'year' | '') => void;
  setTableFromDate: (date: string) => void;
  setTableToDate: (date: string) => void;
}

/**
 * DateRangeFieldset component for filtering table data by date range.
 * @param tableDatePreset The currently selected date preset ('week', 'month', 'year', or '').
 * @param applyTableDatePreset Function to apply a date preset.
 * @param clearTableDateRange Function to clear the date range filter.
 * @param tableFromDate The currently selected start date for the custom date range.
 * @param tableToDate The currently selected end date for the custom date range.
 * @param setTableDatePreset Function to set the date preset.
 * @param setTableFromDate Function to set the start date for the custom date range.
 * @param setTableToDate Function to set the end date for the custom date range.
 */
export default function DateRangeFieldset(
  { 
    tableDatePreset, 
    applyTableDatePreset, 
    clearTableDateRange, 
    tableFromDate, 
    tableToDate, 
    setTableDatePreset, 
    setTableFromDate, 
    setTableToDate 
  }: DateRangeFieldsetProps) {
  return (
    <fieldset className="table-date-range">
      <legend className="form-label">Filter Date Range</legend>
      <div className="table-date-range__grid">
        <div className="table-date-range__presets" role="radiogroup" aria-label="Quick date range selection">
          <strong>Preset ranges:</strong>
          <label className="table-date-range__preset-option">
            <input
              type="radio"
              name="table-date-preset"
              checked={tableDatePreset === 'week'}
              onChange={() => applyTableDatePreset('week')}
            />
            This week
          </label>
          <label className="table-date-range__preset-option">
            <input
              type="radio"
              name="table-date-preset"
              checked={tableDatePreset === 'month'}
              onChange={() => applyTableDatePreset('month')}
            />
            This month
          </label>
          <label className="table-date-range__preset-option">
            <input
              type="radio"
              name="table-date-preset"
              checked={tableDatePreset === 'year'}
              onChange={() => applyTableDatePreset('year')}
            />
            This year
          </label>
          <label className="table-date-range__preset-option">
            <input
              type="radio"
              name="table-date-preset"
              checked={tableDatePreset === ''}
              onChange={() => clearTableDateRange()}
            />
            All time
          </label>
        </div>

        <div className="table-date-range__fields">
          <strong>Custom range:</strong>
          <div className="form-group">
            <label className="form-label" htmlFor="table-date-from">From date</label>
            <input
              id="table-date-from"
              className="form-input table-date-filter"
              type="date"
              value={tableFromDate}
              max={tableToDate || undefined}
              onChange={(e) => {
                setTableDatePreset('');
                setTableFromDate(e.target.value);
              }}
              aria-label="Filter slots from date"
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="table-date-to">To date</label>
            <input
              id="table-date-to"
              className="form-input table-date-filter"
              type="date"
              value={tableToDate}
              min={tableFromDate || undefined}
              onChange={(e) => {
                setTableDatePreset('');
                setTableToDate(e.target.value);
              }}
              aria-label="Filter slots to date"
            />
          </div>

        </div>
      </div>

    </fieldset>
  )
}