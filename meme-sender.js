const fetch = require('node-fetch');

// Wallhaven API Key
const WALLHAVEN_API_KEY = process.env.WALLHAVEN_API_KEY;
// Discord Webhook URLs（5 个 channel，用逗号分隔）
const WEBHOOK_URLS = (process.env.WEBHOOK_URLS || '').split(',').filter(url => url.trim());

if (WEBHOOK_URLS.length === 0) {
  console.error('❌ 错误：WEBHOOK_URLS 环境变量未设置');
  process.exit(1);
}

if (!WALLHAVEN_API_KEY) {
  console.error('❌ 错误：WALLHAVEN_API_KEY 环境变量未设置');
  process.exit(1);
}

// 搜索分类（每天轮换）
const CATEGORIES = [
  { term: 'anime', categories: 'anime' },
  { term: 'programming', categories: 'general' },
  { term: 'computer', categories: 'general' },
  { term: 'code', categories: 'general' },
  { term: 'technology', categories: 'general' },
  { term: 'cyberpunk', categories: 'anime' },
  { term: 'developer', categories: 'general' }
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
  return parseInt(now.toISOString().split('T')[0].replace(/-/g, ''));
}

async function fetchMeme() {
  const seed = getTodaySeed();
  const catIndex = Math.floor(seededRandom(seed) * CATEGORIES.length);
  const category = CATEGORIES[catIndex];
  
  console.log(`📌 正在搜索 Wallhaven: "${category.term}"... (seed: ${seed})`);
  
  try {
    // Wallhaven API: https://wallhaven.cc/help/api
    const params = new URLSearchParams({
      q: category.term,
      categories: category.categories,
      purity: 'SFW',  // 只返回安全内容
      sorting: 'toplist',
      order: 'desc',
      per_page: '20',
      apikey: WALLHAVEN_API_KEY
    });
    
    const res = await fetch(`https://wallhaven.cc/api/v1/search?${params}`);
    
    if (!res.ok) {
      throw new Error(`Wallhaven API 返回错误：${res.status}`);
    }
    
    const data = await res.json();
    
    if (!data.data || data.data.length === 0) {
      throw new Error('未找到任何图片');
    }
    
    // 用种子选择图片（同一天所有 channel 相同）
    const imgIndex = Math.floor(seededRandom(seed + 1) * data.data.length);
    const image = data.data[imgIndex];
    
    const meme = {
      title: `${category.term} - ${image.resolution || 'HD'}`,
      url: image.path,  // 完整分辨率图片
      thumb: image.thumbs.large || image.thumbs.original,
      author: image.user ? image.user.username : 'Anonymous',
      url_original: `https://wallhaven.cc/w/${image.id}`
    };
    
    console.log(`✅ 找到图片：${meme.title} (index: ${imgIndex}/${data.data.length})`);
    return meme;
    
  } catch (error) {
    console.error(`❌ Wallhaven 获取失败:`, error.message);
    throw error;
  }
}

async function sendToDiscord(meme) {
  const payload = {
    content: `🌅 **每日 Meme**\n\n${meme.title}\n🎨 Author: ${meme.author}`,
    embeds: [{
      image: { url: meme.thumb },  // 用缩略图（加载更快）
      footer: {
        text: 'View on Wallhaven',
        url: meme.url_original
      },
      color: 0x00A8E6  // Wallhaven 蓝色
    }]
  };
  
  console.log(`📤 正在发送到 ${WEBHOOK_URLS.length} 个 Discord channel...`);
  
  const promises = WEBHOOK_URLS.map(async (url, index) => {
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
        console.error(`❌ Channel ${index + 1} 失败：${res.status}`);
      }
    } catch (error) {
      console.error(`❌ Channel ${index + 1} 错误：${error.message}`);
    }
  });
  
  await Promise.all(promises);
}

async function main() {
  console.log('🚀 开始每日 Meme 发送...');
  console.log(`📅 今天日期种子：${getTodaySeed()}`);
  console.log(`📋 目标 channel 数量：${WEBHOOK_URLS.length}`);
  
  try {
    const meme = await fetchMeme();
    await sendToDiscord(meme);
    console.log('🎉 完成！');
  } catch (error) {
    console.error('❌ 执行失败:', error.message);
    process.exit(1);
  }
}

main();
