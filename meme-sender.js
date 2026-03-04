const fetch = require('node-fetch');

// Pexels API Key（从 GitHub Secrets 读取）
const PEXELS_API_KEY = process.env.PEXELS_API_KEY;

// Discord Webhook
const WEBHOOK_URL = process.env.WEBHOOK_URL;

if (!WEBHOOK_URL) {
  console.error('❌ 错误：WEBHOOK_URL 环境变量未设置');
  process.exit(1);
}

if (!PEXELS_API_KEY) {
  console.error('❌ 错误：PEXELS_API_KEY 环境变量未设置');
  process.exit(1);
}

// 搜索关键词（anime/CS/programming 相关）
const SEARCH_QUERIES = [
  'programming funny',
  'computer humor',
  'coding meme',
  'developer life',
  'software engineer',
  'anime art',
  'anime illustration'
];

async function fetchMeme() {
  const randomQuery = SEARCH_QUERIES[Math.floor(Math.random() * SEARCH_QUERIES.length)];
  console.log(`📌 正在搜索 Pexels: "${randomQuery}"...`);
  
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
    
    // 随机选择一张
    const randomPhoto = data.photos[Math.floor(Math.random() * data.photos.length)];
    
    const meme = {
      title: `${randomQuery} - Photo by ${randomPhoto.photographer}`,
      url: randomPhoto.src.large || randomPhoto.src.original,
      photographer: randomPhoto.photographer,
      url_original: randomPhoto.url
    };
    
    console.log(`✅ 找到图片: ${meme.title}`);
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
      color: 0x05A67E // Pexels 绿色
    }]
  };
  
  console.log('📤 正在发送到 Discord...');
  
  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' }
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Discord Webhook 返回错误：${res.status}`);
  }
  
  console.log('✅ 发送成功！');
}

async function main() {
  console.log('🚀 开始每日 Meme 发送...');
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
