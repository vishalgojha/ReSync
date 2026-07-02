export const API_BASE = import.meta.env.VITE_API_URL ?? ''

export const SIO_URL = import.meta.env.VITE_SIO_URL ?? (API_BASE || undefined)
