import { z } from "zod";

export const validate = async <T>(
  schema: z.ZodSchema<T>,
  data: unknown
): Promise<T> => {
  return schema.parseAsync(data);
};
