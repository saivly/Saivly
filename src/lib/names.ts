/** Uppercases the first character of a name, leaving the rest as typed ("jan" -> "Jan"). */
export function capitalizeFirst(name: string): string {
  return name.charAt(0).toLocaleUpperCase() + name.slice(1);
}
