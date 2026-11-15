export function roundScore(value, decimals = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;

  const factor = 10 ** decimals;
  const sign = number < 0 ? -1 : 1;
  return sign * Math.round((Math.abs(number) + Number.EPSILON) * factor) / factor;
}

export function sumRoundedScores(values) {
  return roundScore(
    values.reduce((sum, value) => sum + roundScore(value, 2), 0),
    2
  );
}

export function formatScore(value, decimals = 1, signed = false) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";

  const rounded = roundScore(number, decimals);
  const formatted = new Intl.NumberFormat("it-IT", {
    useGrouping: false,
    minimumFractionDigits: decimals === 2 ? 2 : 0,
    maximumFractionDigits: decimals,
  }).format(rounded);

  return signed && rounded > 0 ? `+${formatted}` : formatted;
}
