/** Tipos e mapas compartilhados entre cliente e servidor (áudio/uploads). */

export const AUDIO_BUCKET = "briefing-audios" as const;
export const FILES_BUCKET = "briefing-files" as const;

export const AUDIO_MAX_BYTES = 25 * 1024 * 1024;
export const FILES_MAX_BYTES = 20 * 1024 * 1024;

const AUDIO_EXT: Record<string, string> = {
  "audio/webm": "webm",
  "audio/mp4": "mp4",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
};

const FILE_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
};

/** "audio/webm;codecs=opus" -> "audio/webm" */
export function baseMime(mime: string): string {
  return mime.split(";")[0].trim().toLowerCase();
}

export function isAudioMime(mime: string): boolean {
  return baseMime(mime) in AUDIO_EXT;
}

export function isFileMime(mime: string): boolean {
  return baseMime(mime) in FILE_EXT;
}

export function extForMime(mime: string): string {
  const base = baseMime(mime);
  return AUDIO_EXT[base] ?? FILE_EXT[base] ?? "bin";
}

export type AudioInfo = {
  id: string;
  question_id: string;
  mime_type: string | null;
  duration_seconds: number | null;
  transcript_status: "pendente" | "processando" | "concluido" | "erro";
  url: string | null;
};

export type FileInfo = {
  id: string;
  question_id: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  kind: string;
  url: string | null;
};
