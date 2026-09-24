import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0';

env.allowLocalModels = false;
env.useBrowserCache = true;
try {
  if (env.backends?.onnx?.wasm) env.backends.onnx.wasm.numThreads = 1;
  env.useWasmCache = true;
} catch {}

let transcriber = null;
let loading = null;
let modelLabel = '';

const HOTWORDS = 'Biedronka Żabka Lidl Auchan Carrefour Uber Bolt Booking Airbnb Netflix Spotify Adobe OpenAI Apple Johnny DaVinci Resolve PLN złoty złotych euro монтаж montaż зйомка shooting editing';

function progress(info) {
  if (!info) return;
  let p = Number(info.progress);
  if (Number.isFinite(p) && p <= 1) p *= 100;
  let text = 'Завантажую локальну Whisper-модель…';
  if (info.status === 'ready') text = 'Модель готова';
  else if (info.file) text = `Завантажую ${String(info.file).split('/').pop()}…`;
  self.postMessage({ type: 'progress', progress: Number.isFinite(p) ? p : null, text });
}

async function buildPipeline() {
  const hasWebGPU = !!self.navigator?.gpu;
  const isIOS = /iPad|iPhone|iPod/.test(self.navigator?.userAgent || '') ||
    (self.navigator?.platform === 'MacIntel' && (self.navigator?.maxTouchPoints || 0) > 1);
  // iOS Safari has a documented history of tab reloads with whisper-base, even
  // through WASM. Tiny multilingual is deliberately the first and only iOS
  // model: lower accuracy is preferable to losing the whole finance session.
  const attempts = isIOS
    ? (hasWebGPU ? [
        { id: 'onnx-community/whisper-base', opts: { device: 'webgpu', dtype: 'q4', progress_callback: progress }, label: 'Whisper base multilingual · iPhone WebGPU' },
        { id: 'onnx-community/whisper-tiny', opts: { device: 'wasm', dtype: 'q8', progress_callback: progress }, label: 'Whisper tiny multilingual · iPhone safe mode' },
      ] : [
        { id: 'onnx-community/whisper-tiny', opts: { device: 'wasm', dtype: 'q8', progress_callback: progress }, label: 'Whisper tiny multilingual · iPhone safe mode' },
      ])
    : hasWebGPU
    ? [
        { id: 'onnx-community/whisper-base', opts: { device: 'webgpu', dtype: 'q4', progress_callback: progress }, label: 'Whisper base q4 · WebGPU' },
        { id: 'onnx-community/whisper-tiny', opts: { device: 'wasm', dtype: 'q8', progress_callback: progress }, label: 'Whisper tiny multilingual · WASM' },
      ]
    : [
        { id: 'onnx-community/whisper-tiny', opts: { device: 'wasm', dtype: 'q8', progress_callback: progress }, label: 'Whisper tiny multilingual · WASM' },
      ];

  let lastError;
  for (const a of attempts) {
    try {
      self.postMessage({ type: 'progress', progress: null, text: `Готую ${a.label}…` });
      const pipe = await pipeline('automatic-speech-recognition', a.id, a.opts);
      transcriber = pipe;
      modelLabel = a.label;
      self.postMessage({ type: 'ready', model: modelLabel });
      return pipe;
    } catch (e) {
      lastError = e;
      self.postMessage({ type: 'progress', progress: null, text: `${a.label} не запустився, пробую легший варіант…` });
    }
  }
  throw lastError || new Error('Не вдалося завантажити локальну модель');
}

async function getTranscriber() {
  if (transcriber) return transcriber;
  if (!loading) loading = buildPipeline().finally(() => { loading = null; });
  return loading;
}

async function getPromptIds(pipe) {
  try {
    const fn = pipe?.tokenizer?.get_prompt_ids;
    if (typeof fn !== 'function') return null;
    return await fn.call(pipe.tokenizer, HOTWORDS);
  } catch {
    return null;
  }
}

self.onmessage = async (event) => {
  const msg = event.data || {};
  const requestId = msg.requestId;
  if (msg.type === 'warmup') {
    try { await getTranscriber(); } catch (e) { self.postMessage({ type: 'error', error: String(e?.message || e) }); }
    return;
  }
  if (msg.type !== 'transcribe') return;

  try {
    const audio = msg.audio instanceof Float32Array ? msg.audio : new Float32Array(msg.audio);
    if (!audio.length) throw new Error('Порожній аудіозапис');
    const pipe = await getTranscriber();
    const prompt_ids = await getPromptIds(pipe);
    const options = {
      task: 'transcribe',
      return_timestamps: false,
      chunk_length_s: 20,
      stride_length_s: 2,
    };
    if (prompt_ids) options.prompt_ids = prompt_ids;
    const result = await pipe(audio, options);
    const text = String(result?.text || '').trim();
    if (!text) throw new Error('Модель не почула мову. Спробуй говорити ближче до мікрофона.');
    self.postMessage({ type: 'result', text, model: modelLabel, requestId });
  } catch (e) {
    self.postMessage({ type: 'error', error: String(e?.message || e), requestId });
  }
};
