export type ExportFormat = 'txt' | 'csv' | 'xlsx' | 'ods';

export default function ExportOptions() {
  return (
    <>
      <option value="csv">CSV (.csv)</option>
      <option value="xlsx">Excel (.xlsx)</option>
      <option value="ods">OpenDocument (.ods)</option>
      <option value="txt">Plain Text (.txt)</option>
    </>
  );
};
