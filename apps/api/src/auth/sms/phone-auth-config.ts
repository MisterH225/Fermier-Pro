export type PhoneAuthReadiness = {
  /** Hook Supabase + Yellika prêts à envoyer des OTP. */
  ready: boolean;
  yellikaApiToken: boolean;
  yellikaSenderId: boolean;
  supabaseSendSmsHookSecret: boolean;
  /** Variables manquantes (noms env, sans valeurs). */
  missing: string[];
};

export function getPhoneAuthReadiness(): PhoneAuthReadiness {
  const yellikaApiToken = Boolean(process.env.YELLIKA_SMS_API_TOKEN?.trim());
  const yellikaSenderId = Boolean(process.env.YELLIKA_SMS_SENDER_ID?.trim());
  const supabaseSendSmsHookSecret = Boolean(
    process.env.SUPABASE_SEND_SMS_HOOK_SECRET?.trim() ||
      process.env.SEND_SMS_HOOK_SECRETS?.trim()
  );

  const missing: string[] = [];
  if (!yellikaApiToken) {
    missing.push("YELLIKA_SMS_API_TOKEN");
  }
  if (!yellikaSenderId) {
    missing.push("YELLIKA_SMS_SENDER_ID");
  }
  if (!supabaseSendSmsHookSecret) {
    missing.push("SUPABASE_SEND_SMS_HOOK_SECRET");
  }

  return {
    ready: missing.length === 0,
    yellikaApiToken,
    yellikaSenderId,
    supabaseSendSmsHookSecret,
    missing
  };
}
