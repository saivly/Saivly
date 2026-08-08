// 16+ chars, at least one lowercase, one uppercase, one digit, one symbol.
export const PASSWORD_PATTERN =
  "(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{16,}";

export const PASSWORD_REGEX = new RegExp(`^${PASSWORD_PATTERN}$`);

export const PASSWORD_HINT =
  "At least 16 characters, with uppercase, lowercase, a number, and a symbol.";

export function isStrongPassword(password: string): boolean {
  return PASSWORD_REGEX.test(password);
}

// Drives the live checklist in the signup form — keep in sync with PASSWORD_PATTERN above.
export const passwordRequirements: {
  id: string;
  label: string;
  test: (password: string) => boolean;
}[] = [
  { id: "length", label: "At least 16 characters long", test: (p) => p.length >= 16 },
  { id: "uppercase", label: "Contains uppercase letters", test: (p) => /[A-Z]/.test(p) },
  { id: "lowercase", label: "Contains lowercase letters", test: (p) => /[a-z]/.test(p) },
  { id: "number", label: "Contains number", test: (p) => /\d/.test(p) },
  { id: "punctuation", label: "Contains symbol", test: (p) => /[^A-Za-z0-9]/.test(p) },
];
