// printf("%.Nf") as jhora.exe's C runtime (MSVC 6) does it: the double is first converted to
// 17 significant decimal digits ($I10_OUTPUT), and that decimal string is rounded half up to N
// places. So 11.225 (11.2249999999999996...) prints "11.23" where a correctly rounding printf
// (and Number.toFixed) gives "11.22"; 9.575 (9.57499999999999928...) prints "9.57" either way.

export function cFixed(x: number, places: number): string {
  if (!Number.isFinite(x)) return String(x);
  const neg = x < 0 || Object.is(x, -0);
  const [mant, expPart] = Math.abs(x).toExponential(16).split('e');   // 17 significant digits
  const exp = Number(expPart);
  const digits = mant.replace('.', '');
  // decimal value = 0.digits * 10^(exp + 1); keep `places` decimals
  const intLen = exp + 1;
  const keep = intLen + places;   // digits kept from `digits`
  let kept: string;
  if (keep < 0) kept = '0';
  else {
    kept = digits.slice(0, keep).padEnd(keep, '0') || '0';
    if (keep < digits.length && digits[keep] >= '5') {
      // round half up on the decimal string
      const arr = kept.split('').map(Number);
      let i = arr.length - 1;
      while (i >= 0) { if (arr[i] === 9) { arr[i] = 0; i--; } else { arr[i]++; break; } }
      kept = (i < 0 ? '1' : '') + arr.join('');
    }
  }
  // kept holds the value * 10^places as a digit string
  const padded = kept.padStart(places + 1, '0');
  const body = places ? `${padded.slice(0, -places)}.${padded.slice(-places)}` : padded;
  return neg ? `-${body}` : body;
}
