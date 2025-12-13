export class BinanceHttpError extends Error {
  readonly name = "BinanceHttpError";

  constructor(
    public readonly status: number,
    public readonly code: number | null,
    message: string,
    public readonly body: unknown
  ) {
    super(message);
  }
}

