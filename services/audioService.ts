class AudioService {
  private ctx: AudioContext | null = null;
  private musicInterval: number | null = null;
  private isMuted: boolean = false;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;

  // Initialize context on first interaction
  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      
      this.masterGain.connect(this.ctx.destination);
      this.musicGain.connect(this.masterGain);
      
      this.masterGain.gain.value = 0.5; // Master volume
      this.musicGain.gain.value = 0.15; // Lower volume for background music
    }
    
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.5, this.ctx!.currentTime, 0.1);
    }
    return this.isMuted;
  }

  getMuted() {
    return this.isMuted;
  }

  // --- SOUND EFFECTS ---

  private playTone(freq: number, type: OscillatorType, duration: number, startTime: number = 0, volume: number = 1) {
    if (!this.ctx || this.isMuted || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime + startTime);

    gain.gain.setValueAtTime(0, this.ctx.currentTime + startTime);
    gain.gain.linearRampToValueAtTime(volume, this.ctx.currentTime + startTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + startTime + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(this.ctx.currentTime + startTime);
    osc.stop(this.ctx.currentTime + startTime + duration);
  }

  playCorrect() {
    this.init();
    // Happy Ding (High C -> E)
    this.playTone(523.25, 'sine', 0.3, 0, 0.5); // C5
    this.playTone(659.25, 'sine', 0.5, 0.1, 0.5); // E5
  }

  playWrong() {
    this.init();
    // Comic "Bonk" (Wood block style)
    if (!this.ctx || this.isMuted || !this.masterGain) return;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'square';
    // Pitch drop
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.1);

    // Short percussive envelope
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);

    // Lowpass filter to make it sound like wood/cartoon
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  playWin() {
    this.init();
    // Fanfare Arpeggio
    const now = 0;
    const speed = 0.1;
    this.playTone(523.25, 'triangle', 0.4, now, 0.4);       // C
    this.playTone(659.25, 'triangle', 0.4, now + speed, 0.4); // E
    this.playTone(783.99, 'triangle', 0.4, now + speed*2, 0.4); // G
    this.playTone(1046.50, 'triangle', 1.0, now + speed*3, 0.4); // High C
  }

  playLose() {
    this.init();
    // Sad descending slide
    if (!this.ctx || this.isMuted || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(100, this.ctx.currentTime + 1.5); // Slow slide down

    // Vibrato (LFO)
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 5;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 10;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    lfo.start();

    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1.5);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 1.5);
  }

  playSwoosh() {
    // Air sound for movement
    if (!this.ctx || this.isMuted || !this.masterGain) return;
    
    const bufferSize = this.ctx.sampleRate * 0.5; // 0.5 sec
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(400, this.ctx.currentTime);
    filter.frequency.linearRampToValueAtTime(1200, this.ctx.currentTime + 0.2);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    
    noise.start();
  }

  // --- BACKGROUND MUSIC (Procedural) ---
  
  startMusic() {
    if (this.musicInterval) return; // Already playing
    this.init();

    // Simple Cowboy "Walking" Bass/Pluck pattern
    const scale = [261.63, 293.66, 329.63, 392.00, 440.00]; // Pentatonic C
    let step = 0;

    const playNote = () => {
      if (!this.ctx || this.isMuted || !this.musicGain) return;
      
      // We play a soft plucked sound
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'triangle';
      
      // Simple melody logic
      const freq = scale[step % scale.length];
      // Randomly jump octaves for variation
      const octave = Math.random() > 0.8 ? 2 : 1; 

      osc.frequency.setValueAtTime(freq / octave, this.ctx.currentTime);
      
      gain.gain.setValueAtTime(0, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.2, this.ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);

      osc.connect(gain);
      gain.connect(this.musicGain!);
      
      osc.start();
      osc.stop(this.ctx.currentTime + 0.5);

      // Pattern: 1, 3, 5, 4...
      if (Math.random() > 0.5) step += 2;
      else step -= 1;
      if (step < 0) step = scale.length - 1;
    };

    // 100 BPM approx
    this.musicInterval = window.setInterval(playNote, 600);
  }

  stopMusic() {
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }
}

export const audioManager = new AudioService();
