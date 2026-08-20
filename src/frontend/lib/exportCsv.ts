type CsvValue = string | number | boolean | null | undefined;

const escapeCsvValue = (value: CsvValue) => {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

export const downloadCsv = (
  filename: string,
  rows: Array<Record<string, CsvValue>>,
  headers?: string[]
) => {
  if (typeof window === "undefined") return;
  const keys = headers?.length ? headers : rows.length ? Object.keys(rows[0]) : [];
  if (keys.length === 0) return;

  const lines = [keys.join(",")];
  for (const row of rows) {
    const line = keys.map((key) => escapeCsvValue(row[key])).join(",");
    lines.push(line);
  }

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
