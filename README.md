# 灵墟论道 · 修仙主题网页游戏论坛

浏览器即用的修仙主题社区：道友注册登录、发帖论道、功法图鉴兑换修炼、境界成长、每日签到。

> **当前部署方式**：本机自托管（Windows）+ Cloudflare Tunnel 公网穿透
> 公网地址：`https://lol-equal-lucas-allows.trycloudflare.com`（快速隧道地址，重启隧道后会变，见下文）

## 功能一览

- **账号体系**：用户名 + 密码注册（bcrypt）、登录（JWT 7 天），注册赠 100 灵石
- **职业系统**：注册时七选一、**终身不可更改**——剑修（攻击+20%）／法修（灵气获取+20%）／鬼修（挂机速度+15%）／血修（突破成功率+10%）／妖修（功法抽取+5%）／魔修（全属性+10%，突破失败惩罚×2）／体修（气血上限+50%）；面板属性经 `/api/users/me/profile` 输出
- **境界挂机系统**（第3轮）：八大境界 练气→筑基→金丹→元婴→化神→合体→大乘→渡劫
  - 挂机灵气速率（灵气/分钟）：100 / 200 / 400 / 800 / 1600 / 3200 / 6400 / 12800（每境界翻倍）
  - 「开始挂机」记录时间；「结束挂机」或访问 `/api/auth/me`、`/api/cultivation/status`、`/api/users/me/profile` 时自动结算（离线时长×速率，零头秒数保留继续累计）
  - 「一键突破」消耗灵气冲击下一境界：消耗 1000~64000 逐级翻倍，基准成功率 90%→30% 逐级降低；失败损失一半消耗（魔修×2 全损），血修成功率+10%
  - 挂机速率 = 境界速率 × 职业倍率（鬼修1.15/法修1.2/魔修1.1）× 功法最高倍率
- **论坛**：五大板块（问道/感悟/杂谈/功法/公告）、发帖（灵气+10）、评论楼中楼（灵气+3）、点赞、收藏、关键词搜索、精华/置顶（管理员）
- **功法图鉴**：五品阶（黄/玄/地/天/仙，境界要求 练气/筑基/金丹/元婴/化神）× 八类型 × 九属性，兑换修炼得灵气加成（+5% ~ +40%，取最高不叠加，同样作用于挂机）；用户投稿、管理员审核（采纳奖灵气+15、灵石+20）
- **每日签到**：灵气+5、灵石+2，连签 7 天额外 +20 灵气 +10 灵石（东八区日期）
- **个人主页**：修行卡片（挂机开始/结束、灵气进度、一键突破）、修炼功法、收藏夹、签到日历、资料/密码编辑
- **管理后台**：功法审核、帖子置顶/加精/隐藏、数据统计

## 修行 API（第3轮新增，均需登录）

| 方法/路径 | 说明 |
|---|---|
| POST /api/cultivation/idle/start | 开始挂机（重复 400），返回 perMinute |
| POST /api/cultivation/idle/stop | 结算并停止：时长×速率=灵气 |
| GET /api/cultivation/status | 修行面板（访问即自动结算挂机收益，不打断挂机） |
| POST /api/cultivation/breakthrough | 一键突破：灵气≥消耗 → 成功 realm+1 / 失败损失 50%（魔修全损） |

## 技术栈

- 前端：原生 HTML/CSS/JS（零依赖、零构建），水墨修仙风深色主题，移动端自适应
- 后端：Node.js + Express（单服务同时托管 API 与静态页），Mongoose ODM，JWT 认证，helmet + 登录限流
- 数据库：MongoDB Atlas 免费层（M0）
- 对外暴露：cloudflared 快速隧道（免费、无需账号；国内可直连）

## 日常运维（本机自托管）

两个后台进程组成线上服务（均已注册开机自启计划任务 `XiuxianForumServer` / `XiuxianForumTunnel`）：

| 进程 | 启动方式 | 作用 |
|---|---|---|
| 论坛服务 | `start-forum.bat`（或 `cd server && npm run dev`） | Express 监听 localhost:3000 |
| 公网隧道 | `start-tunnel.bat` | cloudflared 穿透，输出 `*.trycloudflare.com` 地址 |

常用操作：

```powershell
# 查看当前公网地址（隧道窗口里也有显示）
Get-Content "$env:LOCALAPPDATA\cloudflared\tunnel-url.txt" -ErrorAction SilentlyContinue

# 重启论坛服务：结束 node 进程后重新运行 start-forum.bat
# 重启隧道（会换新地址）：结束 cloudflared 进程后重新运行 start-tunnel.bat

# 取消开机自启
schtasks /Delete /TN XiuxianForumServer /F
schtasks /Delete /TN XiuxianForumTunnel /F
```

注意事项：
- **电脑关机/断网论坛即下线**，重新开机登录后会自动恢复（服务+隧道）
- 快速隧道地址在隧道重启后会**变化**；若需固定域名：注册 Cloudflare 账号 + 绑定自己的域名，改用命名隧道（`cloudflared tunnel login` 流程）
- `server/.env` 为本机配置（已 gitignore），含数据库凭据勿外传
- 本机到 Atlas 的解析依赖 `C:\Windows\System32\drivers\etc\hosts` 中三条 `ac-8sfwhqj-shard-*` 记录（本机 DNS 对 mongodb.net 污染的兜底），勿删除

## 本地开发

```bash
cd server
npm install
npm run dev        # http://localhost:3000 即完整站点（前后端同源）
```

测试：

```bash
cd server
npm test                       # 单元测试 48 项（境界表/职业/灵气规则/挂机结算/突破判定/东八区日期）
node scripts/smoke.js          # 全链路冒烟 85 项（注册职业→挂机结算→突破→功法→审核→权限）
node scripts/migrate-realm.js prod  # 运维：旧18级→新8境界数据迁移（exp→qi）
node scripts/hello-check.js 0  # 运维：直连 Atlas 分片 0 查主从状态
node scripts/drop-email-index.js dev  # 运维：清理旧版 email 唯一索引
```

## 云端部署（可选升级）

项目根目录含 `Dockerfile`（单容器：API + 静态页），可部署到任何容器平台（Render / Koyeb / Fly.io 等）。环境变量：

| 变量 | 说明 |
|---|---|
| `MONGODB_URI` | MongoDB 连接串（Atlas：Network Access 需允许 `0.0.0.0/0`） |
| `JWT_SECRET` | 任意长随机串 |
| `ADMIN_USERNAME` | 用此用户名注册的账号自动成为管理员 |

## 项目结构

```
├── client/            # 前端静态页（由 Express 托管）
│   ├── *.html         # 9 个页面
│   ├── css/style.css
│   └── js/            # config/api/auth/ui 公共层 + pages/ 页面脚本
├── server/            # 后端
│   ├── src/
│   │   ├── models/    # User / Post / Comment / Technique / CheckIn
│   │   ├── controllers/ routes/ middlewares/ utils/ tests/
│   │   └── app.js server.js
│   └── scripts/       # smoke.js / hello-check.js
├── start-forum.bat    # 一键启动论坛服务
├── start-tunnel.bat   # 一键启动公网隧道（断线自动重连）
└── Dockerfile         # 云端容器化部署用
```

## 安全设计

- 密码 bcrypt 哈希存储，任何接口不返回；JWT 7 天有效期
- 前端一律 `textContent` 渲染用户内容（防 XSS）；后端 helmet 安全头
- 登录/注册接口每 IP 15 分钟 20 次限流（进程内存计数，重启服务清零）
- 帖子/评论软删除；权限矩阵：游客只读 → 登录用户发帖/评论（仅本人可编辑）→ 管理员审核功法/置顶/加精/隐藏/删除（不可改写他人内容）
