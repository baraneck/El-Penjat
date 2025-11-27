
import React, { useMemo } from 'react';
import { Tile, GRID_SIZE } from '../types';

interface HiddenImageProps {
  imageSrc: string; // Accepts Data URI (SVG or Base64)
  revealedCount: number; // How many tiles should be revealed
}

/**
 * LOGIC FOR PROGRESSIVE REVEAL (UPDATED):
 * 
 * We want to prioritize outer edges but allow for "noisy" reveals so the center isn't always the absolute last.
 * 
 * 1. Algorithm: Calculate Euclidean distance from center (2,2).
 * 2. Sorting: We add a RANDOM factor to the distance during sort.
 *    score = distance + (random * 1.5)
 * 
 * This means a tile at distance 0 (center) could effectively compete with a tile at distance 1.5.
 * The result is a "Swiss Cheese" reveal that closes in on the center but shows parts of it earlier.
 */
const generateTiles = (): Tile[] => {
  const tiles: Tile[] = [];
  const center = Math.floor(GRID_SIZE / 2); // For 5x5, center is index 2
  let id = 0;

  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      // Euclidean distance formula: sqrt((x2-x1)^2 + (y2-y1)^2)
      const distance = Math.sqrt(Math.pow(r - center, 2) + Math.pow(c - center, 2));
      tiles.push({
        id: id++,
        row: r,
        col: c,
        distanceFromCenter: distance,
        revealed: false
      });
    }
  }

  // "Noisy" Sort by distance descending
  // We add random noise so the order isn't perfectly deterministic
  return tiles.sort((a, b) => {
    const scoreA = a.distanceFromCenter + (Math.random() * 1.5);
    const scoreB = b.distanceFromCenter + (Math.random() * 1.5);
    return scoreB - scoreA;
  });
};

export const HiddenImage: React.FC<HiddenImageProps> = ({ imageSrc, revealedCount }) => {
  // Memoize tiles so they don't reshuffle on every render, only on mount (game start)
  const sortedTiles = useMemo(() => generateTiles(), [imageSrc]); // Regenerate if imageSrc changes (new game)

  // Determine which specific tile IDs should be transparent based on the count
  const revealedIds = useMemo(() => {
    return new Set(sortedTiles.slice(0, revealedCount).map(t => t.id));
  }, [revealedCount, sortedTiles]);

  return (
    <div className="relative w-full aspect-square max-w-sm mx-auto rounded-xl overflow-hidden shadow-2xl border-4 border-amber-900/50 bg-gray-100">
      {/* Background/Base Layer (The Image) */}
      {imageSrc ? (
        <img 
          src={imageSrc} 
          alt="Hidden object" 
          className="absolute inset-0 w-full h-full object-contain bg-white" 
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-gray-400 bg-gray-200">
          <span className="text-xs">Imatge no disponible</span>
        </div>
      )}

      {/* Foreground Layer (The Grid of Tiles) */}
      <div 
        className="absolute inset-0 grid"
        style={{ 
          gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
          gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)`
        }}
      >
        {/* We map 0..24 to render the grid structure correctly in DOM order (Row 0..4) */}
        {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, index) => {
           const isRevealed = revealedIds.has(index);
           
           return (
             <div 
                key={index}
                className={`
                  border-r border-b border-amber-900/10 bg-slate-800 transition-all duration-1000 ease-in-out transform
                  ${isRevealed ? 'opacity-0 scale-50' : 'opacity-100 scale-100'}
                `}
             >
               {!isRevealed && (
                 <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-700 to-slate-800">
                   <span className="text-white/10 text-xs font-mono">?</span>
                 </div>
               )}
             </div>
           );
        })}
      </div>
    </div>
  );
};