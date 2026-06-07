/** Types pdfmake simplifiés (évite la dépendance aux déclarations du package). */
export type PdfContent = Record<string, unknown> | string | number | null | PdfContent[];
export type PdfTableCell = Record<string, unknown> | string;
export type PdfDocumentDefinitions = Record<string, unknown>;
