/**
 * supabase.ts — client hook for the project's own Supabase backend.
 * VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are injected per environment
 * (dev/staging/prod) by the SPD provisioning pipeline.
 */
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !key) {
  console.warn('[spd-app] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — check .env')
}

export const supabase = createClient(url ?? '', key ?? '')
