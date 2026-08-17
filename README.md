# 灵墟论道 · 修仙主题网页游戏论坛

浏览器即用的修仙主题社区：道友注册登录、发帖论道、功法图鉴兑换修炼、境界成长、每日签到。

## 功能一览

- **账号体系**：注册 / 登录（JWT），道号 + 邮箱，注册赠 100 灵石
- **论坛**：五大板块（问道/感悟/杂谈/功法/公告）、发帖（修为+10）、评论楼中楼（修为+3）、点赞、收藏、关键词搜索、精华/置顶（管理员）
- **功法图鉴**：五品阶（黄/玄/地/天/仙）× 八类型 × 九属性，兑换修炼得修为加成（+5% ~ +40%，取最高不叠加）；用户投稿、管理员审核（采纳奖修为+15、灵石+20）
- **境界成长**：修为自动突破 18 级境界（练气一层 → 仙人）
- **每日签到**：修为+5、灵石+2，连签 7 天额外 +20 修为 +10 灵石（东八区日期）
- **个人主页**：境界进度条、修炼功法、收藏夹、签到日历、资料/密码编辑
- **管理后台**：功法审核、帖子置顶/加精/隐藏、数据统计

## 技术栈

- 前端：原生 HTML/CSS/JS（零依赖、零构建），水墨修仙风深色主题，移动端自适应
- 后端：Node.js + Express，Mongoose ODM，JWT 认证，helmet + 登录限流
- 数据库：MongoDB（本地或 MongoDB Atlas 免费层）
- 部署：Koyeb 免费实例（Docker 单服务，Express 同时托管 API 与静态页，免绑卡）

## 本地开发

```bash
cd server
npm install
cp .env.example .env        # 填 MONGODB_URI / JWT_SECRET / ADMIN_EMAIL
npm run dev                 # 打开 http://localhost:3000 即是完整站点（前后端同源）
```

测试：

```bash
cd server
npm test                    # 单元测试（境界换算 / 奖励规则 / 东八区日期）
node scripts/smoke.js       # 全链路冒烟（需先启动服务与数据库，可用 SMOKE_BASE 指定线上地址）
```

## 部署到 Koyeb（免费）

1. **MongoDB Atlas**：免费 M0 集群，Network Access 添加 `0.0.0.0/0`，创建数据库用户，得到连接串
2. **推送本仓库到 GitHub**
3. **Koyeb**：注册（支持 GitHub 登录，无需绑卡）→ 控制台安装 Koyeb GitHub App 并授权该仓库
4. **创建服务**：Web Service → GitHub → 选择仓库与 `main` 分支 → Buildpack 选 **Dockerfile** → Instance 选 **Free** → 添加环境变量：
   - `MONGODB_URI`：Atlas 连接串（库名如 `xiuxian-forum`）
   - `JWT_SECRET`：任意长随机串
   - `ADMIN_EMAIL`：管理员邮箱（**用此邮箱注册的账号自动成为管理员**）
5. 部署完成后访问 `https://<服务名>.<组织名>.koyeb.app`，健康检查路径 `/api/health`
6. 用 `ADMIN_EMAIL` 注册账号 → 自动成为管理员 → 即可在导航看到「洞府管理」

## 项目结构

```
├── client/            # 前端静态页（由 Express 托管）
│   ├── *.html         # 9 个页面
│   ├── css/style.css
│   └── js/            # config/api/auth/ui 公共层 + pages/ 页面脚本
├── server/            # 后端 API
│   ├── src/
│   │   ├── models/    # User / Post / Comment / Technique / CheckIn
│   │   ├── controllers/ routes/ middlewares/ utils/ tests/
│   │   └── app.js server.js
│   └── scripts/smoke.js
└── Dockerfile         # Koyeb 构建镜像（node:20-alpine）
```

## 安全设计

- 密码 bcrypt 哈希存储，任何接口不返回；JWT 7 天有效期
- 前端一律 `textContent` 渲染用户内容（防 XSS）；后端 helmet 安全头
- 登录/注册接口每 IP 15 分钟 20 次限流
- 帖子/评论软删除；权限校验（作者/管理员）全覆盖
