import { OpenLyricsDocument, WordToken } from './lyrics';

export interface HistorySnapshot {
  document: OpenLyricsDocument;
  actionDesc: string;
}

export interface HistoryActionInfo {
  type: 'undo' | 'redo';
  description: string;
  timestamp: number;
}

export interface HistoryState {
  past: HistorySnapshot[];
  present: OpenLyricsDocument;
  future: HistorySnapshot[];
  lastHistoryAction?: HistoryActionInfo;
  lastEditTime?: number;
}

export type EditorAction =
  | { type: 'SET_DOCUMENT'; document: OpenLyricsDocument }
  | { type: 'SET_LINE_START'; lineIndex: number; timestamp: number }
  | { type: 'SET_LINE_END'; lineIndex: number; timestamp: number }
  | { type: 'SET_LINE_TIMING'; lineIndex: number; start: number; end: number; layerId?: string }
  | { type: 'SET_LINE_LAYER'; lineIndex: number; layerId: string }
  | { type: 'REORDER_LINES'; fromIndex: number; toIndex: number }
  | { type: 'UPDATE_LINE_TEXT'; lineIndex: number; text: string }
  | { type: 'ADD_LINE'; afterIndex?: number; text?: string; start?: number; end?: number; layerId?: string }
  | { type: 'DELETE_LINE'; lineIndex: number }
  | { type: 'DIVIDE_LINE_INTO_WORDS'; lineIndex: number }
  | { type: 'DIVIDE_ALL_LINES' }
  | { type: 'TOKENIZE_LINE'; lineIndex: number }
  | { type: 'UPDATE_WORD_TOKENS'; lineIndex: number; tokens: WordToken[] }
  | { type: 'SET_WORD_TOKEN'; lineIndex: number; tokenIndex: number; start: number; end: number }
  | { type: 'SET_WORD_TOKEN_TEXT'; lineIndex: number; tokenIndex: number; text: string }
  | { type: 'REMOVE_WORD_TOKENS'; lineIndex: number }
  | { type: 'TOGGLE_WORD_EMPHASIS'; lineIndex: number; tokenIndex: number }
  | { type: 'TOGGLE_LINE_EMPHASIS'; lineIndex: number }
  | { type: 'BATCH_TOKENIZE_ALL' }
  | { type: 'UPDATE_METADATA'; metadata: Partial<OpenLyricsDocument['metadata']> }
  | { type: 'APPLY_REMOTE_DOCUMENT'; document: OpenLyricsDocument }
  | { type: 'SET_LINE_VOCALIST'; lineIndex: number; vocalist: string | undefined }
  | { type: 'CONVERT_TO_ROMAJI' }
  | { type: 'CONVERT_TO_ROMAN_HINDI' }
  | { type: 'CONVERT_TO_KOREAN_ROMAN' }
  | { type: 'CONVERT_TO_INDIC_ROMAN'; language?: string }
  | { type: 'SHIFT_ALL_TIMESTAMPS'; deltaSeconds: number }
  | { type: 'BAKE_OFFSET_INTO_TIMESTAMPS' }
  | { type: 'UNDO' }
  | { type: 'REDO' };


export type SyncMode = 'line' | 'word';
export type ViewTab = 'editor' | 'timeline' | 'preview' | 'split' | 'settings' | 'projects';
export type RendererViewMode = 'flow' | 'stage' | 'kinetic' | 'editorial' | 'alve' | 'peak' | 'colors' | 'flythrough';
