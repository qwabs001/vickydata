export const smsService = {
  async sendSms(phoneNumber: string, message: string) {
    void phoneNumber;
    void message;
    return { ok: true } as const;
  }
};
