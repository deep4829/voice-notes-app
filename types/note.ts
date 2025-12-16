export interface Note {
  id: string;
  title: string;
  audioUri: string;
  transcription: string;
  duration: number;
  language?: string;
  createdAt: number;
  updatedAt?: number;
  isFavorite?: boolean;
  tags?: string[];
  summary?: string;
}

export interface Recording {
  id: string;
  uri: string;
  duration: number;
  transcription: string;
  timestamp: number;
  title: string;
  time?: string;
  date?: string;
  isFavorite?: boolean;
}
