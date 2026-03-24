import { z } from "zod";

export const documentIdParam = z.string().describe(
  "Document ID from URL: docs.google.com/document/d/{ID}/edit",
);

export const fileIdParam = z.string().describe(
  "File or document ID",
);

