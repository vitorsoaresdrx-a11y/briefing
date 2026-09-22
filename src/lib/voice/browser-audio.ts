/**
 * Utilidades de áudio para o briefing por voz — SOMENTE navegador.
 * Não importar em código de servidor (este módulo usa `window`, `AudioContext`
 * e `navigator.mediaDevices`).
 *
 * Formatos exigidos pela Gemini Live API:
 * - entrada: PCM 16-bit little-endian, mono, 16 kHz
 * - saída:  PCM 16-bit little-endian, mono, 24 kHz
 */

function getAudioContextCtor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (
    (w.AudioContext as typeof AudioContext | undefined) ??
    (w.webkitAudioContext as typeof AudioContext | undefined) ??
    null
  );
}

/** Float32 [-1, 1] -> base64 de PCM 16-bit little-endian. */
export function float32ToInt16Base64(samples: Float32Array): string {
  const len = samples.length;
  const bytes = new Uint8Array(len * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < len; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** base64 de PCM 16-bit little-endian -> Float32 [-1, 1]. */
export function base64ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const len = Math.floor(binary.length / 2);
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const lo = binary.charCodeAt(i * 2);
    const hi = binary.charCodeAt(i * 2 + 1);
    let v = (hi << 8) | lo;
    if (v >= 0x8000) v -= 0x10000;
    out[i] = v / 0x8000;
  }
  return out;
}

/** Reamostra mono para 16 kHz (quando o AudioContext não aceitou 16 kHz). */
export function downsampleTo16k(input: Float32Array, fromRate: number): Float32Array {
  if (fromRate === 16000) return input;
  if (fromRate < 16000 || input.length === 0) return input;
  const ratio = fromRate / 16000;
  const outLen = Math.floor(input.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    out[i] = input[Math.floor(i * ratio)];
  }
  return out;
}

export type MicChunkHandler = (pcm16Base64: string) => void;

/**
 * Captura o microfone e entrega pedaços de PCM 16 kHz em base64.
 * Usa ScriptProcessor (depreciado, mas é o que funciona em Safari/iOS sem
 * AudioWorklet empacotado — suficiente para streaming de voz).
 */
export class MicStreamer {
  private ctx: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private analyser: AnalyserNode | null = null;
  private levelData: Uint8Array<ArrayBuffer> | null = null;
  private stream: MediaStream | null = null;
  private running = false;

  static async requestStream(): Promise<MediaStream> {
    return navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  }

  start(stream: MediaStream, onChunk: MicChunkHandler): void {
    const Ctor = getAudioContextCtor();
    if (!Ctor) throw new Error("Este navegador não suporta captura de áudio.");
    this.stop();

    let ctx: AudioContext;
    try {
      ctx = new Ctor({ sampleRate: 16000 });
    } catch {
      ctx = new Ctor();
    }
    void ctx.resume().catch(() => undefined);

    const source = ctx.createMediaStreamSource(stream);
    // 4096 frames ≈ 256 ms a 16 kHz — equilíbrio entre latência e nº de mensagens.
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = (ev) => {
      if (!this.running) return;
      const input = ev.inputBuffer.getChannelData(0);
      const resampled = downsampleTo16k(input, ev.inputBuffer.sampleRate);
      if (resampled.length === 0) return;
      try {
        onChunk(float32ToInt16Base64(resampled));
      } catch {
        // Ignora falha isolada de um pedaço; o stream continua.
      }
    };

    // O processor precisa estar conectado ao destino para processar.
    // Usa um GainNode zerado para não gerar eco no alto-falante.
    const silencer = ctx.createGain();
    silencer.gain.value = 0;
    source.connect(processor);
    processor.connect(silencer);
    silencer.connect(ctx.destination);

    // Analisador só para o nível de volume (espectro da tela) — não afeta o áudio.
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);

    this.ctx = ctx;
    this.source = source;
    this.processor = processor;
    this.analyser = analyser;
    this.levelData = new Uint8Array(analyser.fftSize);
    this.stream = stream;
    this.running = true;
  }

  /** Nível atual do microfone, de 0 (silêncio) a 1 — alimenta o espectro da tela. */
  getLevel(): number {
    const analyser = this.analyser;
    const data = this.levelData;
    if (!this.running || !analyser || !data) return 0;
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = ((data[i] ?? 128) - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / data.length);
    return Math.min(1, rms * 3);
  }

  stop(): void {
    this.running = false;
    try {
      this.processor?.disconnect();
    } catch {
      // noop
    }
    try {
      this.source?.disconnect();
    } catch {
      // noop
    }
    try {
      this.analyser?.disconnect();
    } catch {
      // noop
    }
    if (this.ctx) {
      const ctx = this.ctx;
      this.ctx = null;
      void ctx.close().catch(() => undefined);
    }
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        try {
          track.stop();
        } catch {
          // noop
        }
      }
      this.stream = null;
    }
    this.processor = null;
    this.source = null;
    this.analyser = null;
    this.levelData = null;
  }
}

/**
 * Toca o áudio PCM 24 kHz vindo do Google, encadeando os pedaços sem gaps.
 * `stop()` interrompe tudo na hora (usado no barge-in, quando o cliente
 * interrompe a IA no meio da fala).
 */
export class AudioOutPlayer {
  private ctx: AudioContext | null = null;
  private nextStart = 0;
  private sources = new Set<AudioBufferSourceNode>();

  private ensure(): AudioContext {
    if (this.ctx && this.ctx.state !== "closed") return this.ctx;
    const Ctor = getAudioContextCtor();
    if (!Ctor) throw new Error("Este navegador não suporta reprodução de áudio.");
    let ctx: AudioContext;
    try {
      ctx = new Ctor({ sampleRate: 24000 });
    } catch {
      ctx = new Ctor();
    }
    void ctx.resume().catch(() => undefined);
    this.ctx = ctx;
    this.nextStart = ctx.currentTime;
    return ctx;
  }

  enqueue(base64: string): void {
    const samples = base64ToFloat32(base64);
    if (samples.length === 0) return;
    const ctx = this.ensure();
    const buffer = ctx.createBuffer(1, samples.length, 24000);
    buffer.getChannelData(0).set(samples);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    const now = ctx.currentTime;
    // Quando a fila esvaziou (início de uma fala), segura 200 ms antes de
    // começar — absorve o jitter da rede e evita a fala "picotada/robotizada".
    // No meio de uma fala contínua, os pedaços seguem encadeados sem atraso.
    const startAt = this.nextStart <= now ? now + 0.2 : Math.max(this.nextStart, now);
    try {
      src.start(startAt);
    } catch {
      return;
    }
    this.nextStart = startAt + buffer.duration;
    this.sources.add(src);
    src.onended = () => {
      this.sources.delete(src);
    };
  }

  /** Para a fala atual (interrupção) e limpa a fila. */
  stop(): void {
    for (const src of this.sources) {
      try {
        src.stop();
      } catch {
        // noop
      }
      try {
        src.disconnect();
      } catch {
        // noop
      }
    }
    this.sources.clear();
    if (this.ctx && this.ctx.state !== "closed") {
      this.nextStart = this.ctx.currentTime;
    }
  }

  close(): void {
    this.stop();
    if (this.ctx) {
      const ctx = this.ctx;
      this.ctx = null;
      void ctx.close().catch(() => undefined);
    }
  }
}
