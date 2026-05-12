import { NectRequest, NectResponse, Reply } from "../server";

export class NectRouteError {
  err;
  constructor(err: Error) {
    this.err = err;
  }

  handle(req: NectRequest, res: NectResponse, { debugMode }: { debugMode?: boolean }) {
    const reply = new Reply({ req, res, debugMode });
    return reply.error({ message: this.err.message, code: this.err.name }).fail(500);
  }
}
