import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameStatus, GameData, MAX_ERRORS } from './types';
import { generateGameData, generateSecretImageSVG, generateSVGPostcard } from './services/geminiService';
import { audioManager } from './services/audioService';
import { GameScene } from './components/GameScene';
import { HiddenImage } from './components/HiddenImage';
import { AlertCircle, RefreshCw, Trophy, Skull, Loader2, Image as ImageIcon, Volume2, VolumeX, Lightbulb } from 'lucide-react';

const ALPHABET = "ABCÇDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const App: React.FC = () => {
  const [status, setStatus] = useState<GameStatus>(GameStatus.IDLE);
  const [data, setData] = useState<GameData | null>(null);
  const [guessedLetters, setGuessedLetters] = useState<Set<string>>(new Set());
  const [wrongCount, setWrongCount] = useState(0);
  const [totalTurns, setTotalTurns] = useState(0); 
  const [animState, setAnimState] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  // Reaction Image State (SVG Postcard)
  const [finalImageUrl, setFinalImageUrl] = useState<string | null>(null);
  
  const startGame = async () => {
    // Init audio context on user gesture
    audioManager.init();
    audioManager.startMusic();
    
    // Reset State
    setStatus(GameStatus.LOADING);
    setGuessedLetters(new Set());
    setWrongCount(0);
    setTotalTurns(0);
    setAnimState('idle');
    setData(null);
    setFinalImageUrl(null);
    setShowHint(false);
    setErrorMessage('');

    try {
      // 1. Generate text data (Word & Hint)
      const wordData = await generateGameData();
      
      // 2. Generate the HIDDEN SVG image (Using Gemini Text model to avoid Quota issues)
      let svgImageSrc = "";
      try {
         // We ask the text model to write SVG code
         svgImageSrc = await generateSecretImageSVG(wordData.word, wordData.imageDescription);
      } catch (e) {
         console.warn("Error generant imatge SVG", e);
         // Fallback SVG if generation completely fails
         svgImageSrc = `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><text x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="50">?</text></svg>')}`;
      }

      setData({
        word: wordData.word.toUpperCase(),
        hint: wordData.hint,
        imageSrc: svgImageSrc
      });
      setStatus(GameStatus.PLAYING);

    } catch (error: any) {
      console.error(error);
      let msg = "Error de connexió.";
      
      // Extract useful error info
      if (error instanceof Error) {
        msg = error.message;
      } else if (typeof error === 'string') {
        msg = error;
      }
      
      // Helper for common issues
      if (msg.includes('permission denied') || msg.includes('403') || msg.includes('API_KEY')) {
        msg = "Error de Permisos: La clau API (API_KEY) no està configurada o està restringida en aquest dispositiu.";
      } else if (msg.includes('429')) {
        msg = "Quota excedida: Torna-ho a provar en uns minuts.";
      }

      setErrorMessage(msg);
      setStatus(GameStatus.ERROR);
    }
  };

  const toggleSound = () => {
    const muted = audioManager.toggleMute();
    setIsMuted(muted);
  };

  // Handle Game End - Switch to final image (SVG)
  const handleGameEnd = (result: 'WON' | 'LOST') => {
     if (!data) return;

     setStatus(result === 'WON' ? GameStatus.WON : GameStatus.LOST);
     
     // Generate SVG Postcard instantly
     const svgUrl = generateSVGPostcard(result, data.word);
     setFinalImageUrl(svgUrl);

     if (result === 'WON') {
       audioManager.playWin();
     } else {
       audioManager.playLose();
     }
  };

  const handleGuess = useCallback((letter: string) => {
    if (status !== GameStatus.PLAYING || guessedLetters.has(letter) || !data) return;

    audioManager.init();
    const newGuessed = new Set(guessedLetters);
    newGuessed.add(letter);
    setGuessedLetters(newGuessed);
    setTotalTurns(prev => prev + 1);

    if (data.word.includes(letter)) {
      audioManager.playCorrect();
      setAnimState('correct');
      // FASTER RECOVERY: 800ms
      setTimeout(() => setAnimState('idle'), 800); 

      const isWin = data.word.split('').every(char => newGuessed.has(char));
      if (isWin) {
        setTimeout(() => handleGameEnd('WON'), 1000);
      }
    } else {
      audioManager.playWrong();
      const newWrong = wrongCount + 1;
      setWrongCount(newWrong);
      setAnimState('wrong');
      // FASTER RECOVERY: 800ms
      setTimeout(() => setAnimState('idle'), 800);

      if (newWrong >= MAX_ERRORS) {
        setTimeout(() => handleGameEnd('LOST'), 1000);
      }
    }
  }, [status, guessedLetters, data, wrongCount]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const char = e.key.toUpperCase();
      if (ALPHABET.includes(char)) {
        handleGuess(char);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleGuess]);

  const effectiveRevealedCount = ((status as GameStatus) === GameStatus.WON || (status as GameStatus) === GameStatus.LOST)
    ? 25 
    : 2 + (totalTurns * 2);

  return (
    <div className="h-screen bg-[#f8f5e6] text-amber-900 font-sans flex flex-col overflow-hidden">
      
      {/* Fixed Header */}
      <header className="flex-none w-full bg-[#f8f5e6] z-10 px-4 py-3 border-b-2 border-amber-900/10 shadow-sm flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl md:text-3xl font-extrabold text-amber-800 tracking-tight drop-shadow-sm font-serif">
            El Penjat <span className="text-amber-600">3D</span>
          </h1>
          <button 
            onClick={toggleSound}
            className="p-2 rounded-full hover:bg-amber-100 text-amber-800 transition-colors"
            title={isMuted ? "Activar so" : "Silenciar"}
          >
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
        </div>
        <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-xl shadow-sm border border-amber-900/10">
           <span className="font-bold text-amber-900/50 uppercase text-xs">Errors</span>
           <span className={`text-xl font-bold ${wrongCount >= MAX_ERRORS - 1 ? 'text-red-600 animate-pulse' : 'text-amber-700'}`}>
             {wrongCount} / {MAX_ERRORS}
           </span>
        </div>
      </header>

      {/* Main Scrollable Area */}
      <main className="flex-grow overflow-y-auto p-4 w-full max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
        
          {/* Left Column: Visuals */}
          <div className="flex flex-col gap-6">
            
            {/* 3D Scene / Image Container */}
            <div className="h-64 md:h-80 w-full bg-white rounded-2xl shadow-xl p-2 border-4 border-amber-100 relative overflow-hidden group">
               
               {(status === GameStatus.WON || status === GameStatus.LOST) ? (
                 <div className="relative w-full h-full flex items-center justify-center bg-slate-800 rounded-xl overflow-hidden">
                    {finalImageUrl ? (
                      <img 
                        src={finalImageUrl} 
                        alt="Result Postcard"
                        className="w-full h-full object-contain animate-in zoom-in-50 duration-700 bg-slate-900"
                      />
                    ) : (
                       <Loader2 className="animate-spin w-10 h-10 text-white" />
                    )}
                 </div>
               ) : (
                 <GameScene 
                   errors={wrongCount} 
                   isCorrect={animState === 'correct'}
                   isWrong={animState === 'wrong'}
                   isWon={status === GameStatus.WON}
                   isLost={status === GameStatus.LOST}
                 />
               )}
            </div>

            {/* Hidden Image */}
            <div className="w-full max-w-xs mx-auto">
              <div className="flex justify-between items-center mb-2 px-1">
                <span className="text-xs font-bold text-amber-800/70 uppercase tracking-widest">Pista Visual</span>
                <span className="text-xs text-amber-800/50">Es revela progressivament...</span>
              </div>
              <HiddenImage imageSrc={data?.imageSrc || ''} revealedCount={effectiveRevealedCount} />
            </div>
          </div>

          {/* Right Column: Interaction */}
          <div className="flex flex-col justify-start gap-4">
            
            {status === GameStatus.IDLE && (
              <div className="text-center space-y-6 bg-white p-8 rounded-3xl shadow-xl border-4 border-amber-100 mt-4">
                <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto text-orange-600 mb-4 animate-bounce">
                  <Trophy size={40} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-amber-900 mb-2">Benvingut, Foraster!</h2>
                  <p className="text-amber-800/70">
                    Salva el vaquer "Woody" endevinant la paraula secreta abans que la corda s'estiri!
                  </p>
                </div>
                <button 
                  onClick={startGame}
                  className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg transform transition hover:scale-105 hover:shadow-2xl text-lg"
                >
                  Començar Aventura
                </button>
              </div>
            )}

            {status === GameStatus.LOADING && (
              <div className="flex flex-col items-center justify-center h-64 space-y-6 bg-white/50 rounded-3xl p-8 backdrop-blur-sm mt-4">
                <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-orange-500"></div>
                <p className="text-lg text-amber-900 font-medium animate-pulse text-center">
                  Buscant al diccionari...<br/>
                  <span className="text-sm text-amber-800/60 font-normal">Dibuixant la pista secreta...</span>
                </p>
              </div>
            )}

            {status === GameStatus.ERROR && (
              <div className="text-center p-6 bg-red-50 rounded-2xl border-2 border-red-200 mt-4">
                <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-2" />
                <h3 className="text-lg font-bold text-red-700 mb-2">Ups! Ha passat alguna cosa</h3>
                <p className="text-sm text-red-600 mb-4 font-mono bg-red-100 p-2 rounded break-all">
                  {errorMessage || "Error desconegut"}
                </p>
                <button onClick={startGame} className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 font-bold shadow-md mt-2">
                  Tornar a intentar
                </button>
              </div>
            )}

            {(status === GameStatus.PLAYING || status === GameStatus.WON || status === GameStatus.LOST) && data && (
              <div className="bg-white p-4 md:p-6 rounded-3xl shadow-xl border-4 border-amber-100 flex flex-col gap-4 relative overflow-hidden mt-0 md:mt-0">
                
                {/* Background texture */}
                <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#8B4513 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

                {/* Hint System */}
                <div className="bg-yellow-50 p-3 rounded-xl border-l-4 border-yellow-400 text-yellow-900 relative z-10">
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2">
                        <span className="font-bold text-yellow-600 uppercase text-xs tracking-wider">Pista:</span> 
                     </div>
                     {!showHint && (
                       <button 
                          onClick={() => setShowHint(true)}
                          className="text-xs flex items-center gap-1 bg-yellow-200 hover:bg-yellow-300 px-2 py-1 rounded text-yellow-800 font-bold transition-colors"
                       >
                         <Lightbulb size={12} /> Veure Pista
                       </button>
                     )}
                  </div>
                  {showHint && (
                     <div className="mt-2 italic font-medium text-sm md:text-base animate-in fade-in slide-in-from-top-2">
                       "{data.hint}"
                     </div>
                  )}
                </div>

                {/* Word Display */}
                <div className="flex flex-wrap justify-center gap-1.5 my-1 relative z-10">
                  {data.word.split('').map((char, idx) => (
                    <div 
                      key={idx}
                      className={`
                        w-8 h-10 md:w-12 md:h-14 flex items-center justify-center text-2xl md:text-3xl font-black rounded-md transition-all duration-300
                        ${guessedLetters.has(char) || status !== GameStatus.PLAYING 
                          ? 'bg-amber-100 text-amber-900 border-b-4 border-amber-300 translate-y-0' 
                          : 'bg-slate-200 border-b-4 border-slate-300'}
                      `}
                    >
                      {guessedLetters.has(char) || status !== GameStatus.PLAYING ? char : ''}
                    </div>
                  ))}
                </div>

                {/* Keyboard */}
                {status === GameStatus.PLAYING ? (
                  <div className="grid grid-cols-7 gap-1 z-10 select-none">
                    {ALPHABET.map((letter) => {
                      const isGuessed = guessedLetters.has(letter);
                      const isWrong = isGuessed && !data.word.includes(letter);
                      const isRight = isGuessed && data.word.includes(letter);
                      
                      return (
                        <button
                          key={letter}
                          disabled={isGuessed || animState !== 'idle'} // Disable while animating
                          onClick={() => handleGuess(letter)}
                          className={`
                            aspect-[4/5] rounded-md font-bold text-sm md:text-lg transition-all duration-150 relative touch-manipulation
                            ${!isGuessed 
                              ? 'bg-white hover:bg-orange-50 text-amber-900 border border-amber-200 shadow-[0_2px_0_0_rgba(180,83,9,0.2)] active:shadow-none active:translate-y-[2px]' 
                              : 'cursor-not-allowed shadow-none translate-y-[2px] border-none'}
                            ${isRight ? 'bg-green-500 text-white opacity-90' : ''}
                            ${isWrong ? 'bg-slate-300 text-slate-500 opacity-60' : ''}
                          `}
                        >
                          {letter}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 z-10">
                    <button 
                      onClick={startGame}
                      className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02]"
                    >
                      <RefreshCw /> {status === GameStatus.WON ? 'Nova Partida' : 'Tornar-ho a provar'}
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
};

export default App;