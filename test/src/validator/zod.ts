import z from "zod";

export const user = z
  .object({
    id: z.number(),
    username: z.string(),
  })
  .strip();

export type User = z.infer<typeof user>;
