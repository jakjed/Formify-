import type { OcrInput } from '../domain/ocr.types';

/** Postgres text columns reject NUL (0x00) bytes. */
export function fullTextForStorage(input: OcrInput, maxLen = 100_000): string {
  const mime = input.mimeType?.toLowerCase() ?? '';
  const name = input.originalName.toLowerCase();
  const isText =
    mime.startsWith('text/') ||
    name.endsWith('.txt') ||
    mime === 'application/json';
  if (!isText) return '';
  return input.buffer.toString('utf8').replace(/\0/g, '').slice(0, maxLen);
}
