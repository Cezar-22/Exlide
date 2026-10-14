// Live input level on the mic button, so a teacher can see at a glance that
// the microphone (laptop, USB, Bluetooth headset) is actually picking up sound.
// Opens its own getUserMedia stream on the OS default input, the same one
// the Web Speech API uses.

export interface MicLevel {
  deviceLabel: string;
  stop(): void;
}

export async function startMicLevel(onLevel: (level: number) => void): Promise<MicLevel> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  const context = new AudioContext();
  const analyser = context.createAnalyser();
  analyser.fftSize = 512;
  context.createMediaStreamSource(stream).connect(analyser);
  const samples = new Float32Array(analyser.fftSize);
  let frame = 0;
  const loop = () => {
    analyser.getFloatTimeDomainData(samples);
    let sum = 0;
    for (const s of samples) sum += s * s;
    onLevel(Math.min(1, Math.sqrt(sum / samples.length) * 6));
    frame = requestAnimationFrame(loop);
  };
  loop();
  return {
    deviceLabel: stream.getAudioTracks()[0]?.label ?? 'default microphone',
    stop() {
      cancelAnimationFrame(frame);
      for (const track of stream.getTracks()) track.stop();
      void context.close();
      onLevel(0);
    },
  };
}
