import type { Answers } from "@/lib/briefing/types";

/**
 * Tipos mínimos das tabelas (espelham supabase/schema.sql).
 * Trocar por tipos gerados (`supabase gen types`) quando preferir.
 */
export type BriefingStatus = "rascunho" | "em_andamento" | "concluido";
export type TranscriptStatus = "pendente" | "processando" | "concluido" | "erro";

export type BriefingRow = {
  id: string;
  token: string;
  client_name: string | null;
  client_email: string | null;
  client_whatsapp: string | null;
  company: string | null;
  project_type: string | null;
  niche: string | null;
  status: BriefingStatus;
  current_step: string | null;
  answers: Answers;
  completeness: number;
  pending_fields: string[];
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  viewed_at: string | null;
};

export type Database = {
  public: {
    Tables: {
      briefings: {
        Row: BriefingRow;
        Insert: Partial<Omit<BriefingRow, "id" | "created_at" | "updated_at">>;
        Update: Partial<Omit<BriefingRow, "id" | "created_at">>;
        Relationships: [];
      };
      briefing_files: {
        // Sem coluna question_id (segue o schema): a pergunta é derivada do
        // storage_path, que segue <briefing_id>/<question_id>/<uuid>.<ext>.
        Row: {
          id: string;
          briefing_id: string;
          kind: string;
          storage_path: string;
          file_name: string;
          mime_type: string | null;
          size_bytes: number | null;
          created_at: string;
        };
        Insert: {
          briefing_id: string;
          kind?: string;
          storage_path: string;
          file_name: string;
          mime_type?: string | null;
          size_bytes?: number | null;
        };
        Update: Partial<{
          kind: string;
          storage_path: string;
          file_name: string;
          mime_type: string | null;
          size_bytes: number | null;
        }>;
        Relationships: [];
      };
      briefing_voice_sessions: {
        // Trilha de auditoria do briefing por voz (transcrição + campos
        // gravados via function call). As respostas ficam em briefings.answers.
        Row: {
          id: string;
          briefing_id: string;
          transcript: string;
          fields_saved: string[];
          created_at: string;
          ended_at: string | null;
        };
        Insert: {
          briefing_id: string;
          transcript?: string;
          fields_saved?: string[];
          ended_at?: string | null;
        };
        Update: Partial<{
          transcript: string;
          fields_saved: string[];
          ended_at: string | null;
        }>;
        Relationships: [];
      };
      briefing_audios: {
        Row: {
          id: string;
          briefing_id: string;
          question_id: string;
          storage_path: string;
          mime_type: string | null;
          duration_seconds: number | null;
          transcript: string | null;
          transcript_status: TranscriptStatus;
          transcript_error: string | null;
          created_at: string;
        };
        Insert: {
          briefing_id: string;
          question_id: string;
          storage_path: string;
          mime_type?: string | null;
          duration_seconds?: number | null;
          transcript?: string | null;
          transcript_status?: TranscriptStatus;
          transcript_error?: string | null;
        };
        Update: Partial<{
          transcript: string | null;
          transcript_status: TranscriptStatus;
          transcript_error: string | null;
        }>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      briefing_status: BriefingStatus;
      transcript_status: TranscriptStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
