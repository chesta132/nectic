import { ZodError } from "zod";
import { ErrorReplyType } from "../server";

const joinPaths = (paths: PropertyKey[]) => {
  if (paths.length === 0) return "__root__";
  let joined = "";
  for (const path of paths) {
    if (!joined) joined = path.toString();
    // symbol | number
    else if (typeof path !== "string") joined += `[${path.toString()}]`;
    else joined += `.${path}`;
  }
  return joined;
};

export const formatZodMessage = (error: ZodError) => {
  return error.issues.map((issue) => ({
    field: joinPaths(issue.path),
    code: issue.code,
    message: issue.message,
    ...(issue.code === "invalid_format" && { format: issue.format }),
  }));
};

export const zodErrorToReplyError = (
  error: ZodError,
  /** @example "body" */
  on?: string,
): ErrorReplyType & { debug: any[] } => {
  const debug = [{ on }, ...formatZodMessage(error)];
  if (!on) debug.shift();

  const fields = error.issues.reduce(
    (acc, i) => {
      const fieldName = joinPaths(i.path);
      acc[fieldName] = i.message;
      return acc;
    },
    {} as Record<string, string>,
  );

  return { code: "BAD_REQUEST", debug, message: "Invalid payload", fields };
};
