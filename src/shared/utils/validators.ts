export const isValidGhanaPhone = (value: string) => {
  if (!value || typeof value !== "string") return false;
  const digits = value.replace(/\D/g, "");
  // Accept: 0XXXXXXXXX (10 digits starting with 0) or +233XXXXXXXXX (12 digits starting with 233)
  return /^0\d{9}$/.test(digits) || /^233\d{9}$/.test(digits);
};
