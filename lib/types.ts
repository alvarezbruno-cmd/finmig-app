export interface ReferencePost {
  id: string;
  content: string;
  note?: string;
  createdAt: number;
}

export interface Variation {
  angle: string;
  post: string;
}

export interface HistoryEntry {
  id: string;
  topic: string;
  sourceContent: string;
  referenceIds: string[];
  variations: Variation[];
  createdAt: number;
}

export interface GenerateRequest {
  topic: string;
  sourceContent: string;
  references: string[];
}

export interface RewriteRequest {
  fullPost: string;
  snippet: string;
  instruction: string;
}
