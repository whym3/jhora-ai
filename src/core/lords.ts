// Sign lords, dignities and nakshatra lords.
import type { Graha } from './positions';

/** Lord of each sign, Aries first (Rahu/Ketu co-lordship is an option elsewhere). */
export const SIGN_LORD: Graha[] = ['Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter'];

export const signLord = (sign: number): Graha => SIGN_LORD[((sign % 12) + 12) % 12];

/** Vimsottari nakshatra lords, Aswini first (Ketu Ve Su Mo Ma Ra Ju Sa Me repeating). */
export const NAK_LORD: Graha[] = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'];
export const nakshatraLord = (nak: number): Graha => NAK_LORD[((nak % 9) + 9) % 9];

/** Vimsottari dasa years per lord (used for KP sub-lord proportions too). */
export const VIMSOTTARI_YEARS: Record<Graha, number> = {
  Ketu: 7, Venus: 20, Sun: 6, Moon: 10, Mars: 7, Rahu: 18, Jupiter: 16, Saturn: 19, Mercury: 17,
};

export const SHORT: Record<Graha | 'Lagna', string> = {
  Lagna: 'As', Sun: 'Su', Moon: 'Mo', Mars: 'Ma', Mercury: 'Me', Jupiter: 'Ju', Venus: 'Ve', Saturn: 'Sa', Rahu: 'Ra', Ketu: 'Ke',
};
