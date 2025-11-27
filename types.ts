
export enum GameStatus {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  PLAYING = 'PLAYING',
  WON = 'WON',
  LOST = 'LOST',
  ERROR = 'ERROR'
}

export interface GameData {
  word: string;
  hint: string;
  imageSrc: string; // Changed from imageBase64 to support SVG Data URIs
}

export interface Tile {
  id: number;
  row: number;
  col: number;
  distanceFromCenter: number;
  revealed: boolean;
}

// Configuration constants
export const MAX_ERRORS = 6;
export const GRID_SIZE = 5; // 5x5 grid for the image
