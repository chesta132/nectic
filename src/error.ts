export class NectError extends Error {
  cause?: Error;

  constructor(message?: string, opt?: { cause?: unknown }) {
    super(message);
    this.cause = opt?.cause && opt?.cause instanceof Error ? opt.cause : new Error(String(opt?.cause));
  }
}
