export interface PcmMicrophone { stop(): Promise<void>; close(): void }
/** Browser-only PCM capture. 100ms 16kHz mono chunks, no file/recording storage or local playback. */
export async function openPcmMicrophone(signal: AbortSignal, chunk: (pcm: Uint8Array) => void): Promise<PcmMicrophone> {
  let stream: MediaStream | undefined; let context: AudioContext | undefined;
  let node: AudioWorkletNode | undefined; let closed = false; let flushed: (() => void) | undefined;
  const close = () => {
    if (closed) return; closed = true;
    signal.removeEventListener("abort", close);
    stream?.getTracks().forEach(track => track.stop()); node?.disconnect(); node?.port.close();
    void context?.close().catch(() => {}); flushed?.();
  };
  signal.addEventListener("abort", close, { once: true });
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
    if (closed || signal.aborted) { stream.getTracks().forEach(track => track.stop()); throw Error("CANCELLED"); }
    context = new AudioContext({ sampleRate: 16000 });
    const worklet = `class VoicePcm extends AudioWorkletProcessor {
      constructor() { super(); this.buffer=[]; this.stopped=false; this.port.onmessage=()=>{
        this.stopped=true; this.flush(); this.port.postMessage({done:true}); }; }
      flush() { if(this.buffer.length) { this.port.postMessage({samples:Float32Array.from(this.buffer)}); this.buffer=[]; } }
      process(inputs) { if(this.stopped) return false;
        const samples=inputs[0]?.[0]; if(samples) for(const sample of samples) {
          this.buffer.push(sample); if(this.buffer.length===1600) this.flush(); } return true; }
    } registerProcessor("voice-pcm",VoicePcm);`;
    const url = URL.createObjectURL(new Blob([worklet], { type: "text/javascript" }));
    try { await context.audioWorklet.addModule(url); } finally { URL.revokeObjectURL(url); }
    if (closed || signal.aborted) throw Error("CANCELLED");
    node = new AudioWorkletNode(context, "voice-pcm");
    node.port.onmessage = event => {
      if (closed) return;
      if (event.data.done) { flushed?.(); return; }
      const samples: Float32Array = event.data.samples;
      const pcm = new Uint8Array(samples.length * 2); const view = new DataView(pcm.buffer);
      samples.forEach((sample, index) => { const bounded = Math.max(-1, Math.min(1, sample)); view.setInt16(index * 2, Math.round(bounded * (bounded < 0 ? 32768 : 32767)), true); });
      chunk(pcm);
    };
    context.createMediaStreamSource(stream).connect(node);
    const silent = context.createGain(); silent.gain.value = 0; node.connect(silent).connect(context.destination);
    await context.resume();
    if (closed || signal.aborted) throw Error("CANCELLED");
    return { close, async stop() {
      if (closed) return;
      stream?.getTracks().forEach(track => track.stop());
      await new Promise<void>(resolve => { flushed = resolve; node!.port.postMessage("flush"); });
      close();
    } };
  } catch (error) { close(); throw error; }
}
