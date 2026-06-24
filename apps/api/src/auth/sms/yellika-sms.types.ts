export type YellikaSmsSendRequest = {
  recipient: string;
  sender_id: string;
  type: "plain";
  message: string;
};

export type YellikaSmsSendResponse = {
  status?: string;
  message?: string;
  data?: unknown;
  error?: string;
};

export type SupabaseSendSmsHookPayload = {
  user: {
    id: string;
    phone?: string | null;
    email?: string | null;
  };
  sms: {
    otp: string;
  };
};
