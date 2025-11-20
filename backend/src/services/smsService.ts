import africastalking from "africastalking";

class SMSService {
  private sms: any;

  constructor() {
    if (!process.env.AFRICAS_TALKING_API_KEY || !process.env.AFRICAS_TALKING_USERNAME) {
      throw new Error("AfricasTalking API credentials missing in environment variables.");
    }

    const africasTalkingInstance = africastalking({
      apiKey: process.env.AFRICAS_TALKING_API_KEY!,
      username: process.env.AFRICAS_TALKING_USERNAME!
    });

    this.sms = africasTalkingInstance.SMS;
  }

  async sendSMS(phoneNumber: string, message: string): Promise<any> {
    try {
      const formattedPhone = this.formatPhoneNumber(phoneNumber);

      const options = {
        to: [formattedPhone],
        message,
        from: process.env.AFRICAS_TALKING_SENDER_ID || undefined
      };

      const result = await this.sms.send(options);
      console.log("✅ SMS sent to:", formattedPhone);

      return result;
    } catch (error: any) {
      console.error("❌ Error sending SMS:", error);
      throw new Error(`Failed to send SMS: ${error?.message || error}`);
    }
  }

  async sendOTP(phoneNumber: string, otpCode: string) {
    const message = `Your Campus Connect verification code is: ${otpCode}. This code expires in 10 minutes.`;
    return this.sendSMS(phoneNumber, message);
  }

  private formatPhoneNumber(phone: string): string {
    let cleaned = phone.trim().replace(/[\s\-]/g, "");

    // Convert 07xx → +2557xx
    if (/^0\d{8,9}$/.test(cleaned)) {
      return "+255" + cleaned.substring(1);
    }

    // Convert 2557xx → +2557xx
    if (/^255\d{8,9}$/.test(cleaned)) {
      return "+" + cleaned;
    }

    // If missing + but looks like Tanzanian number
    if (/^\d{9}$/.test(cleaned)) {
      return "+255" + cleaned;
    }

    // Already in international format
    if (cleaned.startsWith("+")) {
      return cleaned;
    }

    throw new Error("Invalid phone number format: " + phone);
  }
}

export default new SMSService();
