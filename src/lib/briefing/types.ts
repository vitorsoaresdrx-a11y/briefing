export type Option = {
  value: string;
  label: string;
  description?: string;
};

export type Condition =
  | { field: string; equals: string | boolean }
  | { field: string; includes: string }
  | { field: string; in: string[] }
  | { all: Condition[] }
  | { any: Condition[] };

export type QuestionType =
  | "text"
  | "textarea"
  | "email"
  | "phone"
  | "url"
  | "single"
  | "multi"
  | "cards"
  | "slider"
  | "links"
  | "colors"
  | "file";

export type Question = {
  id: string;
  type: QuestionType;
  label: string;
  help?: string;
  placeholder?: string;
  options?: Option[];
  required?: boolean;
  weight?: 1 | 2 | 3;
  allowAudio?: boolean;
  allowUnknown?: boolean;
  unknownLabel?: string;
  maxItems?: number;
  leftLabel?: string;
  rightLabel?: string;
  fileKind?: "logo" | "foto" | "documento" | "outro";
  showIf?: Condition;
};

export type Step = {
  id: string;
  title: string;
  subtitle?: string;
  estimatedMinutes: number;
  questions: Question[];
  showIf?: Condition;
};

/** Resposta salva em answers[questionId]. */
export type Answer = {
  value: unknown;
  skipped?: boolean;
  unknown?: boolean;
  audioId?: string;
};

export type Answers = Record<string, Answer>;
