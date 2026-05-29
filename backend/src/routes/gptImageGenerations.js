const express = require('express');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const config = require('../config');

const router = express.Router();

const GPT_SIZE_MAP = {
  '1:1_1k': '1024x1024', '1:1_2k': '2048x2048', '1:1_4k': '2880x2880',
  '3:2_1k': '1248x832',  '3:2_2k': '2496x1664', '3:2_4k': '3504x2336',
  '2:3_1k': '832x1248',  '2:3_2k': '1664x2496', '2:3_4k': '2336x3504',
  '4:3_1k': '1152x864',  '4:3_2k': '2304x1728', '4:3_4k': '3264x2448',
  '3:4_1k': '864x1152',  '3:4_2k': '1728x2304', '3:4_4k': '2448x3264',
  '5:4_1k': '1120x896',  '5:4_2k': '2240x1792', '5:4_4k': '3200x2560',
  '4:5_1k': '896x1120',  '4:5_2k': '1792x2240', '4:5_4k': '2560x3200',
  '16:9_1k': '1280x720', '16:9_2k': '2560x1440', '16:9_4k': '3840x2160',
  '9:16_1k': '720x1280', '9:16_2k': '1440x2560', '9:16_4k': '2160x3840',
  '2:1_1k': '2048x1024', '2:1_2k': '2688x1344', '2:1_4k': '3840x1920',
  '1:2_1k': '1024x2048', '1:2_2k': '1344x2688', '1:2_4k': '1920x3840',
  '21:9_1k': '1456x624', '21:9_2k': '3024x1296', '21:9_4k': '3696x1584',
  '9:21_1k': '624x1456', '9:21_2k': '1296x3024', '9:21_4k': '1584x3696',
};

function loadRawSettings() {
  if (!fs.existsSync(config.SETTINGS_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(config.SETTINGS_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

function pickApiKey(settings, hint = '') {
  if (!settings) return '';
  const fb = settings.zhenzhenApiKey || '';
  const m = String(hint || '').toLowerCase();
  if (m.includes('gpt-image') || m.includes('gpt2') || m.includes('gpt_image') || m.includes('gptimage')) {
    return settings.gptImageApiKey || fb;
  }
  return fb;
}

function aspectToGptSize(aspectRatio, sizeLevel) {
  const ar = String(aspectRatio || '').trim();
  const safeAr = (!ar || ar === 'Auto' || ar === 'AUTO' || ar === 'empty') ? '1:1' : ar;
  const lvl = String(sizeLevel || '1K').toLowerCase();
  return GPT_SIZE_MAP[`${safeAr}_${lvl}`] || '1024x1024';
}

async function readImageDimensions(buf) {
  try {
    const meta = await sharp(buf).metadata();
    const width = Number(meta?.width || 0);
    const height = Number(meta?.height || 0);
    return width > 0 && height > 0 ? { width, height } : {};
  } catch {
    return {};
  }
}

async function saveRemoteImageInfo(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`下载失败: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const ext = (url.match(/\.(png|jpe?g|webp|gif)/i)?.[1] || 'png').toLowerCase();
    const filename = `img_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
    fs.writeFileSync(path.join(config.OUTPUT_DIR, filename), buf);
    const dims = await readImageDimensions(buf);
    return { url: `/files/output/${filename}`, ...dims };
  } catch (e) {
    console.error('⚠ GPT2 generations 转存图像失败:', e.message);
    return { url };
  }
}

async function saveBase64ImageInfo(b64) {
  try {
    const buf = Buffer.from(b64, 'base64');
    const filename = `img_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.png`;
    fs.writeFileSync(path.join(config.OUTPUT_DIR, filename), buf);
    const dims = await readImageDimensions(buf);
    return { url: `/files/output/${filename}`, ...dims };
  } catch (e) {
    console.error('⚠ GPT2 generations 解析 b64 失败:', e.message);
    return null;
  }
}

function shouldHandle(reqBody) {
  const { model, apiModel, paramKind: paramKindIn, images, image } = reqBody || {};
  const m = String(apiModel || model || '');
  const paramKind = paramKindIn || (m.includes('nano-banana') ? 'banana-ratio' : 'gpt-size');
  const refs = Array.isArray(images) ? images.filter(Boolean) : [];
  if (typeof image === 'string' && image && !refs.includes(image)) refs.unshift(image);
  return paramKind === 'gpt-size'
    && /^gpt-image-2(?:-all)?$/.test(m)
    && !m.includes('-fal')
    && refs.length === 0;
}

function normalizeSubmitResponse(data) {
  const items = Array.isArray(data?.data) ? data.data : [];
  const taskId = typeof data?.data === 'string' ? data.data : (data?.task_id || data?.data?.task_id || data?.id);
  return { items, taskId };
}

router.post('/image/submit', async (req, res, next) => {
  if (!shouldHandle(req.body)) return next();

  const settings = loadRawSettings();
  if (!settings?.zhenzhenApiKey && !settings?.gptImageApiKey) {
    return res.status(400).json({ success: false, error: '未配置 GPT Image API Key 或贞贞工坊 API Key' });
  }

  const { model, apiModel, prompt, n, aspect_ratio, image_size, size, quality } = req.body || {};
  if (!prompt) return res.status(400).json({ success: false, error: 'prompt 不得为空' });

  const finalApiModel = apiModel || model;
  const ar = String(aspect_ratio || '').trim();
  const isAuto = !ar || ar === 'Auto' || ar === 'AUTO' || ar === 'empty';
  const lvlUpper = String(image_size || '2K').toUpperCase();
  const lvlLower = lvlUpper.toLowerCase();
  const px = size || aspectToGptSize(ar, lvlUpper);
  const apiKey = pickApiKey(settings, finalApiModel);

  const body = {
    prompt,
    model: finalApiModel,
    n: Math.max(1, Math.min(4, parseInt(n ?? 1, 10) || 1)),
    quality: quality || 'auto',
    moderation: 'auto',
    size: px,
    image_size: lvlUpper,
    aspect_ratio: isAuto ? '1:1' : ar,
    aspectRatio: isAuto ? '' : ar,
    resolution: lvlLower,
    resolution_label: lvlUpper,
  };

  try {
    const url = `${config.ZHENZHEN_BASE_URL}/v1/images/generations?async=true`;
    console.log('[gpt2/generations] → /generations?async=true', 'model:', finalApiModel, 'size:', px, 'resolution:', lvlLower, 'aspectRatio:', ar || '1:1');
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });
    const text = await upstream.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { _raw: text }; }

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        success: false,
        error: data?.error?.message || data?.message || `上游 HTTP ${upstream.status}`,
        raw: data,
      });
    }

    const norm = normalizeSubmitResponse(data);
    if (norm.items.length && (norm.items[0]?.url || norm.items[0]?.b64_json)) {
      const images = [];
      for (const it of norm.items) {
        if (it?.b64_json) {
          const info = await saveBase64ImageInfo(it.b64_json);
          if (info?.url) images.push(info);
        } else if (it?.url) {
          const info = await saveRemoteImageInfo(it.url);
          if (info?.url) images.push(info);
        }
      }
      return res.json({ success: true, data: { sync: true, status: 'completed', progress: '100%', urls: images.map((it) => it.url), images, raw: data } });
    }

    if (norm.taskId) {
      return res.json({ success: true, data: { sync: false, taskId: norm.taskId, status: 'pending', progress: '0%', raw: data } });
    }

    return res.status(500).json({ success: false, error: 'GPT2 generations 未获取到 task_id 且无同步图片: ' + JSON.stringify(data).slice(0, 300), raw: data });
  } catch (e) {
    console.error('gpt2/generations submit 错误:', e);
    return res.status(500).json({ success: false, error: e.message || '请求失败' });
  }
});

module.exports = router;
