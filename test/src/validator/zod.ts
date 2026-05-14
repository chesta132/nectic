import z from "zod";

export const user = z
  .object({
    id: z.number(),
    username: z.string(),
  })
  .strip();

export type User = z.infer<typeof user>;

export const transfom = z
  .object({
    stringToNumber: z.string().transform((val) => parseInt(val)),
  })
  .strict();
export type Transform = z.infer<typeof transfom>;
export type TransformInput = z.input<typeof transfom>;
