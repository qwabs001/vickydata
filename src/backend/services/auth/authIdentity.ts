export const normalizeUsername = (value: string) => value.trim();

export const normalizePhoneNumber = (value: string) => value.trim();

export const isPhoneLoginIdentity = (value: string) => /^\+?\d[\d\s-]{7,}$/.test(value.trim());
