const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// Wallhaven API Key
const WALLHAVEN_API_KEY = process.env.WALLHAVEN_API_KEY;
// Discord Webhook URLs（多个 channel，用逗号分隔）
const WEBHOOK_URLS = (process.env.WEBHOOK_URLS || '').split(',').filter((url) => url.trim());

if (WEBHOOK_URLS.length === 0) {
  console.error('❌ 错误：WEBHOOK_URLS 环境变量未设置');
  process.exit(1);
}

if (!WALLHAVEN_API_KEY) {
  console.error('❌ 错误：WALLHAVEN_API_KEY 环境变量未设置');
  process.exit(1);
}

// --- state (dedupe across days) ---
// This file is cached by GitHub Actions (see workflow). Locally it just lives in the repo.
const STATE_DIR = path.join(__dirname, '.state');
const STATE_PATH = path.join(STATE_DIR, 'used.json');
const WINDOW = 45; // do not repeat within last N sends

function loadState() {
  try {
    if (fs.existsSync(STATE_PATH)) {
      const s = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
      if (Array.isArray(s.used)) return s;
    }
  } catch (_) { }
  return { used: [] };
}

function saveState(state) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

// 搜索分类（每天轮换 + 随机）
const CATEGORIES = [
  { term: '+genshin +kirara', categories: 'anime' },
  { term: '+genshin +xiao', categories: 'anime' },
  { term: '+genshin +ganyu', categories: 'anime' },
  { term: '+genshin +klee', categories: 'anime' },
  { term: '+genshin +albedo', categories: 'anime' },
  { term: '+genshin +tighnari', categories: 'anime' },
  { term: '+genshin +columbina', categories: 'anime' },
  { term: '+genshin +yoimiya', categories: 'anime' },
];

/**
 * 用日期生成伪随机数（确保同一天所有 channel 选到相同的图片）
 */
function seededRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

/**
 * 获取今天的种子
 */
function getTodaySeed() {
  const now = new Date();
  return parseInt(now.toISOString().split('T')[0].replace(/-/g, ''), 10);
}

async function searchWallhaven({ term, categories, page }) {
  const params = new URLSearchParams({
    q: term,
    categories,
    purity: '100', // SFW
    sorting: 'toplist',
    order: 'desc',
    per_page: '24',
    page: String(page),
    apikey: WALLHAVEN_API_KEY
  });

  const res = await fetch(`https://wallhaven.cc/api/v1/search?${params}`);
  if (!res.ok) throw new Error(`Wallhaven API 返回错误：${res.status}`);
  return res.json();
}

async function fetchMeme() {
  const seed = getTodaySeed();
  const state = loadState();
  const usedSet = new Set(state.used.slice(-WINDOW));

  const catIndex = Math.floor(seededRandom(seed) * CATEGORIES.length);
  const category = CATEGORIES[catIndex];

  console.log(`📌 正在搜索 Wallhaven: "${category.term}"... (seed: ${seed})`);

  // pull multiple pages so we can skip repeats
  const pages = [1, 2, 3];
  const all = [];
  for (const p of pages) {
    const data = await searchWallhaven({ ...category, page: p });
    const arr = (data?.data || []).filter((img) => img?.id && img?.thumbs?.large);
    all.push(...arr);
  }

  if (all.length === 0) throw new Error('未找到任何图片');

  // deterministic shuffle-ish start point per day
  const start = Math.floor(seededRandom(seed + 1) * all.length);
  let pick = null;

  for (let i = 0; i < all.length; i++) {
    const img = all[(start + i) % all.length];
    if (!usedSet.has(img.id)) {
      pick = img;
      break;
    }
  }

  // if we exhausted everything in-window, reset window (keep history but allow reuse)
  if (!pick) {
    console.log('⚠️ 本次候选都在最近发送过：清空去重窗口后重试。');
    state.used = [];
    saveState(state);
    pick = all[start];
  }

  const meme = {
    id: pick.id,
    title: `${category.term} - ${pick.resolution || 'HD'}`,
    url: pick.path,
    thumb: pick.thumbs.large || pick.thumbs.original,
    author: pick.user ? pick.user.username : 'Anonymous',
    url_original: `https://wallhaven.cc/w/${pick.id}`
  };

  state.used.push(meme.id);
  // trim stored history
  if (state.used.length > 400) state.used = state.used.slice(-400);
  saveState(state);

  console.log(`✅ 选择图片：${meme.id} (${meme.title})`);
  return meme;
}

async function sendToDiscord(meme) {
  const payload = {
    content: `🌅 **每日 Meme**\n\n${meme.title}\n🎨 Author: ${meme.author}`,
    embeds: [
      {
        image: { url: meme.thumb },
        footer: {
          text: `Wallhaven · ${meme.id} · no-repeat window=${WINDOW}`,
          url: meme.url_original
        },
        color: 0x00A8E6
      }
    ]
  };

  console.log(`📤 正在发送到 ${WEBHOOK_URLS.length} 个 Discord channel...`);

  await Promise.all(
    WEBHOOK_URLS.map(async (url, index) => {
      try {
        const res = await fetch(url.trim(), {
          method: 'POST',
          body: JSON.stringify(payload),
          headers: { 'Content-Type': 'application/json' }
        });

        if (res.ok) {
          console.log(`✅ Channel ${index + 1} 发送成功！`);
        } else {
          const errorText = await res.text();
          console.error(`❌ Channel ${index + 1} 失败：${res.status} ${errorText}`);
        }
      } catch (error) {
        console.error(`❌ Channel ${index + 1} 错误：${error.message}`);
      }
    })
  );
}

async function main() {
  console.log('🚀 开始每日 Meme 发送...');
  console.log(`📅 今天日期种子：${getTodaySeed()}`);
  console.log(`📋 目标 channel 数量：${WEBHOOK_URLS.length}`);

  const meme = await fetchMeme();
  await sendToDiscord(meme);
  console.log('🎉 完成！');
}

main().catch((err) => {
  console.error('❌ 执行失败:', err?.message || err);
  process.exit(1);
});
