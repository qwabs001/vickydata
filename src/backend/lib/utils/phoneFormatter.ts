export const normalizePhone = (value: string) => value.replace(/\D/g, "");

/**
 * Convert Ghana numbers to local provider format (must start with 0).
 * Examples:
 * +233556103095 -> 0556103095
 * 233556103095 -> 0556103095
 * 0556103095 -> 0556103095
 * 556103095 -> 0556103095
 */
export const toLocalGhanaPhone = (value: string): string => {
  const digits = normalizePhone(value ?? "");
  if (!digits) return "";

  if (digits.startsWith("233")) {
    const withoutCountryCode = digits.slice(3).replace(/^0+/, "");
    return withoutCountryCode ? `0${withoutCountryCode}` : "0";
  }

  const withoutLeadingZeroes = digits.replace(/^0+/, "");
  return withoutLeadingZeroes ? `0${withoutLeadingZeroes}` : "0";
};
