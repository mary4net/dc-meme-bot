const fetch = require('node-fetch');

// Pexels API Key
const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
// 5 个 Server 的 Webhook URLs（用逗号分隔）
const WEBHOOK_URLS = (process.env.WEBHOOK_URLS || '').split(',').filter(url => url.trim());

if (WEBHOOK_URLS.length === 0) {
  console.error('❌ 错误：WEBHOOK_URLS 环境变量未设置（多个 URL 用逗号分隔）');
  process.exit(1);
}

if (!PEXELS_API_KEY) {
  console.error('❌ 错误：PEXELS_API_KEY 环境变量未设置');
  process.exit(1);
}

// 搜索关键词
const SEARCH_QUERIES = [
  'programming funny',
  'computer humor',
  'coding meme',
  'developer life',
  'software engineer',
  'anime art',
  'anime illustration'
];

/**
 * 用日期生成伪随机数（确保同一天所有 server 选到相同的图片）
 */
function seededRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

/**
 * 获取今天的种子（基于日期）
 */
function getTodaySeed() {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
  return parseInt(dateStr);
}

async function fetchMeme() {
  const seed = getTodaySeed();
  const queryIndex = Math.floor(seededRandom(seed) * SEARCH_QUERIES.length);
  const randomQuery = SEARCH_QUERIES[queryIndex];
  
  console.log(`📌 正在搜索 Pexels: "${randomQuery}"... (seed: ${seed})`);
  
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(randomQuery)}&per_page=15&orientation=any`,
      {
        headers: {
          'Authorization': PEXELS_API_KEY
        }
      }
    );
    
    if (!res.ok) {
      throw new Error(`Pexels API 返回错误：${res.status}`);
    }
    
    const data = await res.json();
    
    if (!data.photos || data.photos.length === 0) {
      throw new Error('未找到任何图片');
    }
    
    // 用种子选择图片（同一天所有 server 选到同一张）
    const photoIndex = Math.floor(seededRandom(seed + 1) * data.photos.length);
    const randomPhoto = data.photos[photoIndex];
    
    const meme = {
      title: `${randomQuery} - Photo by ${randomPhoto.photographer}`,
      url: randomPhoto.src.large || randomPhoto.src.original,
      photographer: randomPhoto.photographer,
      url_original: randomPhoto.url
    };
    
    console.log(`✅ 找到图片: ${meme.title} (index: ${photoIndex}/${data.photos.length})`);
    return meme;
    
  } catch (error) {
    console.error(`❌ Pexels 获取失败:`, error.message);
    throw error;
  }
}

async function sendToDiscord(meme) {
  const payload = {
    content: `🌅 **每日 Meme**\n\n${meme.title}\n📷 Photographer: ${meme.photographer}`,
    embeds: [{
      image: { url: meme.url },
      footer: {
        text: 'View on Pexels',
        url: meme.url_original
      },
      color: 0x05A67E
    }]
  };
  
  console.log(`📤 正在发送到 ${WEBHOOK_URLS.length} 个 Discord server...`);
  
  // 并行发送到所有 server
  const promises = WEBHOOK_URLS.map(async (url, index) => {
    try {
      const res = await fetch(url.trim(), {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (res.ok) {
        console.log(`✅ Server ${index + 1} 发送成功！`);
      } else {
        const errorText = await res.text();
        console.error(`❌ Server ${index + 1} 失败：${res.status}`);
      }
    } catch (error) {
      console.error(`❌ Server ${index + 1} 错误：${error.message}`);
    }
  });
  
  await Promise.all(promises);
}

async function main() {
  console.log('🚀 开始每日 Meme 发送...');
  console.log(`📅 今天日期种子：${getTodaySeed()}`);
  console.log(`📋 目标 server 数量：${WEBHOOK_URLS.length}`);
  
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
