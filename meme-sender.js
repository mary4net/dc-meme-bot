const fetch = require('node-fetch');

const SUBREDDITS = [
  'animememes',
  'csmemes', 
  'ProgrammerHumor',
  'wholesomeanimemes',
  'learnprogramming'
];

const WEBHOOK_URL = process.env.WEBHOOK_URL;

if (!WEBHOOK_URL) {
  console.error('❌ 错误：WEBHOOK_URL 环境变量未设置');
  process.exit(1);
}

// 更真实的 User-Agent
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function fetchMeme() {
  const randomSub = SUBREDDITS[Math.floor(Math.random() * SUBREDDITS.length)];
  console.log(`📌 正在从 r/${randomSub} 获取 meme...`);
  
  try {
    const res = await fetch(
      `https://www.reddit.com/r/${randomSub}/hot.json?limit=20`,
      { 
        headers: { 
          'User-Agent': USER_AGENT
        } 
      }
    );
    
    console.log(`Reddit 响应状态：${res.status}`);
    
    if (!res.ok) {
      throw new Error(`Reddit API 返回错误：${res.status}`);
    }
    
    const data = await res.json();
    if (!data.data || !data.data.children || data.data.children.length === 0) {
      throw new Error('未找到任何帖子');
    }
    
    const posts = data.data.children
      .filter(p => {
        const post = p.data;
        if (post.over_18) return false;
        const isImage = post.url.match(/\.(jpg|jpeg|png|gif)$/i);
        const isImgur = post.url.includes('i.imgur.com');
        const isRedditImage = post.url.startsWith('https://i.redd.it/');
        return isImage || isImgur || isRedditImage;
      })
      .map(p => ({
        title: p.data.title,
        url: p.data.url,
        subreddit: p.data.subreddit,
        permalink: `https://reddit.com${p.data.permalink}`
      }));
    
    if (posts.length === 0) throw new Error('过滤后没有合适的图片帖子');
    
    const randomPost = posts[Math.floor(Math.random() * posts.length)];
    console.log(`✅ 找到 meme: ${randomPost.title.substring(0, 50)}...`);
    return randomPost;
    
  } catch (error) {
    console.error(`❌ 从 r/${randomSub} 获取失败:`, error.message);
    throw error;
  }
}

async function sendToDiscord(meme) {
  const payload = {
    content: `🌅 **每日 Meme**\n📚 来自 r/${meme.subreddit}\n\n${meme.title}`,
    embeds: [{
      image: { url: meme.url },
      footer: { text: '点击标题查看原帖', url: meme.permalink },
      color: 0x5865F2
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
