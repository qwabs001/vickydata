export const isValidGhanaPhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return /^0\d{9}$/.test(digits);
};
