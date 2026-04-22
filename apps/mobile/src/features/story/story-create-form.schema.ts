import { z } from 'zod';

/** Story yayinla — yalnizca kullanici metni; medya URL/type upload sonrasi eklenir. */
export const StoryCreateFormSchema = z.object({
  caption: z.string().max(200),
});

export type StoryCreateFormValues = z.infer<typeof StoryCreateFormSchema>;
