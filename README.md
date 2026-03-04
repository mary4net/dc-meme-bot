# Discord Daily Meme Bot 🎭

每天自动从 Reddit 抓取 anime/CS meme 并发送到 Discord。

## 设置步骤

### 1. 创建 Discord Webhook
1. Discord 服务器设置 → **整合** → **创建 Webhook**
2. 选择频道，复制 **Webhook URL**

### 2. 配置 GitHub Secret
1. GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret**
   - Name: `WEBHOOK_URL`
   - Value: 你的 Discord Webhook URL

### 3. 测试
1. **Actions** → **Daily Meme** → **Run workflow**
2. 检查 Discord 频道

### 4. 自动运行
- 每天 **7:50 UTC** 自动发送（比 daily digest 早 10 分钟）
- 编辑 `.github/workflows/daily-meme.yml` 可调整时间
