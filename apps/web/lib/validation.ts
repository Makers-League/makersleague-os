import { z } from "zod";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Bitte gib eine gültige E-Mail-Adresse ein."));

export const emailSchema = z.object({ email });

export const codeSchema = z.object({
  email,
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Der Code hat 6 Ziffern."),
});

export const profileSchema = z.object({
  bio: z
    .string()
    .trim()
    .max(2000, "Höchstens 2000 Zeichen.")
    .transform((v) => (v === "" ? null : v)),
  links: z
    .string()
    .transform((v) =>
      v
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean),
    )
    .pipe(
      z
        .array(
          z.url({
            protocol: /^https?$/,
            error: "Links müssen mit http:// oder https:// beginnen.",
          }),
        )
        .max(5, "Höchstens 5 Links."),
    ),
  visibility: z.enum(["members", "board"]),
});

export type Visibility = z.infer<typeof profileSchema>["visibility"];
