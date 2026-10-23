// Signs, nakshatras and the display formats JHora uses in its tables.

export const SIGNS = ['Ar', 'Ta', 'Ge', 'Cn', 'Le', 'Vi', 'Li', 'Sc', 'Sg', 'Cp', 'Aq', 'Pi'] as const;
export const SIGN_NAMES = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio',
  'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'] as const;

export const NAKSHATRAS = ['Aswi', 'Bhar', 'Krit', 'Rohi', 'Mrig', 'Ardr', 'Puna', 'Push', 'Asre',
  'Magh', 'PPha', 'UPha', 'Hast', 'Chit', 'Swat', 'Visa', 'Anu', 'Jye',
  'Mool', 'PSha', 'USha', 'Srav', 'Dhan', 'Sata', 'PBha', 'UBha', 'Reva'] as const;
export const NAKSHATRA_NAMES = ['Aswini', 'Bharani', 'Krittika', 'Rohini', 'Mrigasira', 'Ardra',
  'Punarvasu', 'Pushyami', 'Aslesha', 'Makha', 'Poorva Phalguni', 'Uttara Phalguni', 'Hasta',
  'Chitra', 'Swati', 'Visakha', 'Anuradha', 'Jyeshtha', 'Moola', 'Poorvashadha', 'Uttarashadha',
  'Sravanam', 'Dhanishtha', 'Satabhishak', 'Poorvabhadra', 'Uttarabhadra', 'Revati'] as const;

const NAK_SPAN = 360 / 27;

export const signOf = (lon: number) => Math.floor(lon / 30) % 12;
export const nakshatraOf = (lon: number) => Math.floor(lon / NAK_SPAN) % 27;
export const padaOf = (lon: number) => Math.floor((lon % NAK_SPAN) / (NAK_SPAN / 4)) + 1;

/** JHora's longitude format: "26 Sg 00' 01.51"" (seconds printed %05.2f, no carry). */
export function formatLongitude(lon: number): string {
  const sign = signOf(lon);
  let rem = lon - sign * 30;
  const d = Math.floor(rem);
  rem = (rem - d) * 60;
  const m = Math.floor(rem);
  const s = (rem - m) * 60;
  return `${String(d).padStart(2, ' ')} ${SIGNS[sign]} ${String(m).padStart(2, '0')}' ${s.toFixed(2).padStart(5, '0')}"`;
}

/** JHora's compact varga format "29Sg27": whole degrees, then minutes rounded without carry. */
export function formatVargaLongitude(lon: number): string {
  const sign = signOf(lon);
  const inSign = lon - sign * 30;
  const d = Math.floor(inSign);
  const m = Math.round((inSign - d) * 60);
  return `${String(d).padStart(2, ' ')}${SIGNS[sign]}${String(m).padStart(2, '0')}`;
}
