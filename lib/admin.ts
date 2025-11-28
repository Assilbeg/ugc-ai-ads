// Admin configuration
// Only these emails can access /admin routes

export const ADMIN_EMAILS = [
  'alexis.albo.lapro@gmail.com',
]

export function isAdmin(email: string | undefined): boolean {
  if (!email) return false
  return ADMIN_EMAILS.includes(email.toLowerCase())
}

