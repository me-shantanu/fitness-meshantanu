// utils/date.ts
// Local-timezone date string (YYYY-MM-DD), unlike toISOString() which uses UTC
export const localDateString = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
