// Public by design: the publishable key only lets callers use the split_* functions,
// and those only work with a room's link. Same Supabase project as Gillefeeling (for now).
export const config = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? 'https://knvrvmqdxvcatsrvkrgx.supabase.co',
  supabaseKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_5e3mg1E-r-P_to34ONwRfw_FQYUwy3z',
  brandUrl: 'https://ellenial.app',
  repoUrl: 'https://github.com/phoenixcyberpunk/ellenial-split',
}

/**
 * Links friends receive always point at the real address, never a *.vercel.app preview
 * (those sit behind Vercel's login wall).
 */
export function shareOrigin(): string {
  const host = location.hostname
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.ellenial.app')) return location.origin
  return 'https://split.ellenial.app'
}
