/** Allowlist de admins a partir de ADMIN_EMAILS (separados por vírgula). */
export function parseAdminEmails(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}
