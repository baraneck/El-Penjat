
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

interface WordResponse {
  word: string;
  hint: string;
  imageDescription: string;
}

/**
 * Generates a random word, a hint, and a visual description for SVG generation.
 * Accepts a list of words to exclude to prevent repetition.
 */
export const generateGameData = async (excludeWords: string[] = []): Promise<WordResponse> => {
  const model = "gemini-2.5-flash";
  
  // Format the exclude list for the prompt (limit to last 50 to save tokens/context)
  const recentExcludes = excludeWords.slice(0, 50).join(", ");
  const excludeInstruction = recentExcludes ? `IMPORTANT: No facis servir cap d'aquestes paraules ja utilitzades: [${recentExcludes}].` : "";

  const response = await ai.models.generateContent({
    model: model,
    contents: `Genera una paraula per al joc del penjat en català. Vull varietat: evita les paraules massa fàcils o típiques (com 'Gat', 'Casa', 'Sol'). Selecciona un substantiu físic aleatori (objecte, animal, lloc, instrument, menjar, vehicle). Retorna també una pista enginyosa en català i una descripció visual breu en anglès per generar una icona SVG. ${excludeInstruction}`,
    config: {
      temperature: 1.2, // High randomness
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          word: {
            type: Type.STRING,
            description: "La paraula a endevinar en català, normalitzada (sense accents, dièresis ni espais, tot majúscules).",
          },
          hint: {
            type: Type.STRING,
            description: "Una pista breu i divertida en català que ajudi a endevinar la paraula sense dir-la explícitament.",
          },
          imageDescription: {
            type: Type.STRING,
            description: "A short, clear description of the object in English to assist in generating an SVG icon.",
          },
        },
        required: ["word", "hint", "imageDescription"],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("No s'ha pogut generar la paraula.");
  
  return JSON.parse(text) as WordResponse;
};

/**
 * Generates an SVG code string based on the object word using Gemini Flash.
 * This avoids Quota limits of Imagen and is faster.
 */
export const generateSecretImageSVG = async (word: string, description: string): Promise<string> => {
  const model = "gemini-2.5-flash";
  
  const prompt = `
    Create a high-quality, colorful, flat-design SVG illustration of a: ${word} (${description}).
    Requirements:
    - ViewBox: "0 0 512 512"
    - Style: Modern, flat vector art, vibrant colors.
    - Composition: Centered object, transparent background (no background rect).
    - Complexity: Simple enough to be recognized, but detailed enough to look good.
    - OUTPUT: Return ONLY the raw SVG XML code. Do not wrap in markdown code blocks.
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: "text/plain", // We want raw text/xml
      }
    });

    let svgCode = response.text || "";
    
    // Cleanup markdown if present
    svgCode = svgCode.replace(/```svg/g, '').replace(/```xml/g, '').replace(/```/g, '').trim();
    
    // If it doesn't start with <svg, try to find it
    const svgStart = svgCode.indexOf('<svg');
    const svgEnd = svgCode.lastIndexOf('</svg>');
    
    if (svgStart !== -1 && svgEnd !== -1) {
      svgCode = svgCode.substring(svgStart, svgEnd + 6);
    } else if (!svgCode.includes('<svg')) {
      // Fallback simple circle if generation fails badly
      return `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><circle cx="256" cy="256" r="200" fill="#ccc" /><text x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="50">?</text></svg>')}`;
    }

    // Convert to Data URI
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgCode)))}`;

  } catch (error) {
    console.error("SVG generation failed", error);
    // Return a fallback placeholder
    return `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#f0f0f0"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="40" fill="#999">Error Generant Imatge</text></svg>')}`;
  }
};

/**
 * Generates a high-quality SVG postcard string based on the game result.
 */
export const generateSVGPostcard = (result: 'WON' | 'LOST', word: string): string => {
  const width = 800;
  const height = 450;
  
  let content = '';
  
  if (result === 'WON') {
    // Victory: Western Sunset, Sunburst, Sheriff Star, Festive
    content = `
      <defs>
        <linearGradient id="sky" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#4FB6FF" />
          <stop offset="50%" stop-color="#87CEEB" />
          <stop offset="100%" stop-color="#E0F7FA" />
        </linearGradient>
        <radialGradient id="sun" cx="50%" cy="100%" r="50%">
           <stop offset="0%" stop-color="#FFD700" />
           <stop offset="100%" stop-color="#FFA500" stop-opacity="0" />
        </radialGradient>
      </defs>
      
      <!-- Background -->
      <rect width="100%" height="100%" fill="url(#sky)" />
      <circle cx="400" cy="450" r="300" fill="url(#sun)" opacity="0.6" />
      
      <!-- Sun Rays -->
      <g stroke="#FFF" stroke-width="40" opacity="0.2" transform="translate(400,450)">
         ${Array.from({length: 12}).map((_,i) => `<line x1="0" y1="0" x2="0" y2="-600" transform="rotate(${i*30})" />`).join('')}
      </g>

      <!-- Confetti -->
      ${Array.from({length: 30}).map(() => {
        const x = Math.random() * 800;
        const y = Math.random() * 450;
        const color = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF'][Math.floor(Math.random() * 5)];
        return `<rect x="${x}" y="${y}" width="8" height="8" fill="${color}" transform="rotate(${Math.random()*360} ${x} ${y})" />`;
      }).join('')}

      <!-- Badge Icon (Simplified) -->
      <g transform="translate(680, 50) scale(0.8)">
        <path d="M50,0 L61,35 L98,35 L68,57 L79,93 L50,70 L21,93 L32,57 L2,35 L39,35 Z" fill="#FFD700" stroke="#B8860B" stroke-width="3" />
      </g>

      <!-- Text -->
      <text x="400" y="150" dominant-baseline="middle" text-anchor="middle" font-family="serif" font-weight="900" font-size="70" fill="#E65100" stroke="#FFF" stroke-width="4" filter="drop-shadow(3px 3px 2px rgba(0,0,0,0.3))">ENHORABONA!</text>
      
      <text x="400" y="240" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="30" fill="#5D4037">HAS SALVAT EL VAQUER!</text>

      <rect x="200" y="290" width="400" height="100" rx="10" fill="#FFF" stroke="#8D6E63" stroke-width="4" />
      <text x="400" y="320" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#8D6E63">LA PARAULA ERA:</text>
      <text x="400" y="360" dominant-baseline="middle" text-anchor="middle" font-family="monospace" font-weight="bold" font-size="45" fill="#3E2723" letter-spacing="4">${word}</text>
    `;
  } else {
    // Defeat: Stormy, Dark, Rain, Rope
    content = `
      <defs>
        <linearGradient id="storm" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#2c3e50" />
          <stop offset="100%" stop-color="#000000" />
        </linearGradient>
      </defs>
      
      <!-- Background -->
      <rect width="100%" height="100%" fill="url(#storm)" />
      
      <!-- Rain -->
      <g stroke="#7F8C8D" stroke-width="2" opacity="0.4">
         ${Array.from({length: 60}).map(() => {
           const x = Math.random() * 800;
           const y = Math.random() * 450;
           return `<line x1="${x}" y1="${y}" x2="${x-10}" y2="${y+20}" />`;
         }).join('')}
      </g>
      
      <!-- Rope Noose (Symbolic) -->
      <path d="M700,0 L700,150" stroke="#8B4513" stroke-width="8" />
      <circle cx="700" cy="180" r="30" stroke="#8B4513" stroke-width="8" fill="none" />

      <!-- Text -->
      <text x="400" y="150" dominant-baseline="middle" text-anchor="middle" font-family="serif" font-weight="900" font-size="80" fill="#C0392B" stroke="#FFF" stroke-width="2" filter="drop-shadow(4px 4px 0px #000)">GAME OVER</text>
      
      <text x="400" y="240" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="30" fill="#BDC3C7">S'HA ACABAT EL TEMPS...</text>

      <rect x="200" y="290" width="400" height="100" rx="10" fill="#34495E" stroke="#2C3E50" stroke-width="4" />
      <text x="400" y="320" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#BDC3C7">ERA:</text>
      <text x="400" y="360" dominant-baseline="middle" text-anchor="middle" font-family="monospace" font-weight="bold" font-size="45" fill="#ECF0F1" letter-spacing="4">${word}</text>
    `;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${content}</svg>`;
  
  // Return as Data URI
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
};