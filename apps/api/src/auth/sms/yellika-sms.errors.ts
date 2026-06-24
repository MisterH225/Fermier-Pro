export class YellikaSmsSendError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean = true
  ) {
    super(message);
    this.name = "YellikaSmsSendError";
  }
}
