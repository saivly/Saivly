/** RFC 4180 CSV. Cells that start with = + - @ are prefixed with ' so spreadsheets don't run them as formulas. */
export function toCsv(header: string[], rows: (string | number | null)[][]): string {
  const cell = (value: string | number | null) => {
    if (value === null) return "";
    let s = String(value);
    if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
