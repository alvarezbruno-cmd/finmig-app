export interface ReferencePost {
  id: string;
  content: string;
  note?: string;
  createdAt: number;
}

export interface Idea {
  id: string;
  text: string;
  createdAt: number;
}

export interface SourceText {
  id: string;
  title: string;
  author: string;
  publication: string;
  date: string;
  link: string;
  ideas: Idea[];
  createdAt: number;
}

export interface SelectedIdea {
  text: string;
  sourceTitle: string;
  sourceAuthor: string;
}

export interface Variation {
  angle: string;
  post: string;
}

export interface HistoryEntry {
  id: string;
  topic: string;
  variations: Variation[];
  createdAt: number;
}

export interface GenerateRequest {
  topic: string;
  ideas: SelectedIdea[];
  extraNotes?: string;
  references: string[];
  performance?: string;
}

export interface PostMetrics {
  impressions: number;
  reached: number;
  reactions: number;
  comments: number;
  shares: number;
  saves: number;
  profileViews: number;
  followers: number;
  sends: number;
}

export type PostFormat = "texto" | "link" | "imagem" | "carrossel";

export interface PublishedPost {
  id: string;
  text: string;
  theme: string;
  format: PostFormat;
  postedAt: string;
  metrics: PostMetrics;
  link?: string;
  topRole?: string;
  topLocation?: string;
  topIndustry?: string;
  createdAt: number;
}

export interface RewriteRequest {
  fullPost: string;
  snippet: string;
  instruction: string;
}
