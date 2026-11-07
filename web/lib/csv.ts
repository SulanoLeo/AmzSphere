export type CsvValue = string | number | boolean | null | undefined;

export function toCsv(rows: readonly (readonly CsvValue[])[]): string {
  return rows
    .map((row) =>
      row
        .map((value) => {
          let cell = value == null ? "" : String(value);
          if (typeof value === "string" && /^[\t\r ]*[=+\-@]/.test(cell)) {
            cell = `'${cell}`;
          }
          return /[",\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
        })
        .join(","),
    )
    .join("\r\n");
}

export function downloadCsv(filename: string, rows: readonly (readonly CsvValue[])[]): void {
  const blob = new Blob([`\uFEFF${toCsv(rows)}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
