export const MAX_POST_CHARS = 500;
export const MAX_POST_IMAGES = 10;
export const MAX_VIDEO_SECONDS = 60;

export function clampPostText(text) {
  return String(text || '').slice(0, MAX_POST_CHARS);
}

function canvasToBlob(canvas, type = 'image/webp', quality = 0.82) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Не удалось прочитать фото')); };
    img.src = url;
  });
}

export async function compressImage(file, maxSide = 1600) {
  if (!file || !file.type?.startsWith('image/')) return file;
  if (file.type === 'image/gif') return file;

  const img = await loadImage(file);
  let { width, height } = img;
  if (!width || !height) return file;

  const scale = Math.min(1, maxSide / Math.max(width, height));
  const targetW = Math.max(1, Math.round(width * scale));
  const targetH = Math.max(1, Math.round(height * scale));

  if (scale === 1 && file.size < 900 * 1024) return file;

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, targetW, targetH);
  const blob = await canvasToBlob(canvas, 'image/webp', 0.82);
  if (!blob) return file;

  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.webp', { type: 'image/webp' });
}

export async function preparePostImages(fileList) {
  const files = Array.from(fileList || []).filter(f => f.type?.startsWith('image/'));
  if (files.length > MAX_POST_IMAGES) {
    throw new Error(`Можно добавить максимум ${MAX_POST_IMAGES} фото`);
  }
  const result = [];
  for (const file of files) {
    result.push(await compressImage(file));
  }
  return result;
}

export function getVideoDuration(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(0);
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number(video.duration) || 0);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Не удалось прочитать длительность видео'));
    };
    video.src = url;
  });
}

export async function validateVideoFile(file) {
  if (!file) return { file: null, duration: 0 };
  const duration = await getVideoDuration(file);
  if (duration > MAX_VIDEO_SECONDS + 0.25) {
    throw new Error('Видео должно быть не длиннее 1 минуты');
  }
  return { file, duration };
}
