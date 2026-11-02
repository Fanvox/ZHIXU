# 知序 Zhixu 部署指南（路线 A：持久进程 + 持久卷）

本文档对应「**先上线、再扩规模**」的部署路线：保持 SQLite 数据库与本地文件存储，
用一个**持久卷**挂载数据目录，部署到支持「常驻 Node 进程 + 持久磁盘」的平台。

> 不需要 Supabase、不需要改数据库。适合团队内部使用、几十~几百用户的规模。

---

## 一、它是怎么工作的

```
浏览器 ──HTTPS──> 托管平台（常驻 Node 进程，next start）
                       │
                       └── 挂载持久卷 /data
                             ├── zhixu.db      （SQLite 数据库）
                             └── uploads/      （上传的 PDF 等文件）
```

- `DATA_DIR=/data` 让应用把数据库和上传文件都写进持久卷
- 容器/服务重启后数据不丢
- 上传文件后**后台异步处理**，前端自动轮询状态

---

## 二、必须配置的环境变量

| 变量 | 必填 | 说明 |
|---|---|---|
| `DATA_DIR` | ✅ | 指向持久卷，如 `/data` |
| `AI_API_KEY` | 建议 | AI 模型 Key；不填则运行在演示模式 |
| `AI_BASE_URL` | 建议 | OpenAI 兼容接口地址，如 `https://api.deepseek.com` |
| `AI_MODEL` | 建议 | 对话/出题模型，如 `deepseek-chat` |
| `AI_EXTRACT_MODEL` | 可选 | 知识抽取用的更快模型 |
| `MAX_UPLOAD_SIZE_MB` | 可选 | 上传大小限制，默认 100 |
| `PORT` | 一般自动 | 平台通常自动注入 |

> ⚠️ 环境变量里的 Key 是**全局兜底**；用户也可以在「设置 → AI 配置」页面填写自己的 Key，
> 用户级配置优先级更高。

---

## 三、方式一：Docker（任意平台通用）

```bash
# 构建
docker build -t zhixu .

# 运行（把 zhixu-data 卷挂到 /data）
docker run -d --name zhixu \
  -p 3000:3000 \
  -v zhixu-data:/data \
  -e DATA_DIR=/data \
  -e AI_BASE_URL=https://api.deepseek.com \
  -e AI_MODEL=deepseek-chat \
  -e AI_API_KEY=sk-xxxx \
  zhixu
```

打开 `http://服务器IP:3000` 即可使用。

---

## 四、方式二：Railway

1. 打开 <https://railway.app> → **New Project → Deploy from GitHub repo**
2. 选择你的知序仓库（平台会自动识别 `Dockerfile`）
3. 在服务的 **Variables** 里添加：`DATA_DIR=/data`、`AI_*` 等
4. 在 **Volumes** 里新建卷，**Mount Path 填 `/data`**
5. 在 **Settings → Networking → Generate Domain** 生成公网域名

---

## 五、方式三：Render

1. <https://render.com> → **New → Web Service**
2. 连接仓库，Environment 选 **Docker**
3. **Environment Variables**：`DATA_DIR=/data`、`AI_*`
4. **Disks** → Add Disk → **Mount Path 填 `/data`**（建议 5GB 起）
5. 创建后即可通过分配的域名访问

---

## 六、方式四：Fly.io

```bash
fly launch          # 识别 Dockerfile，生成 fly.toml
fly volumes create zhixu_data --size 3
fly secrets set AI_BASE_URL=https://api.deepseek.com AI_MODEL=deepseek-chat AI_API_KEY=sk-xxxx
fly deploy
```

在 `fly.toml` 中加入挂载与数据目录：

```toml
[env]
  DATA_DIR = "/data"
  PORT = "3000"

[[mounts]]
  source = "zhixu_data"
  destination = "/data"
```

---

## 七、上线后验证清单

1. 打开域名 → 应自动跳转到 `/login`
2. 用演示账号登录：`demo@zhixu.app` / `demo123`（或注册新账号）
3. 上传一个小文件 → 文档状态应从「处理中」变为「完成」，图谱出现节点
4. **重启服务/容器**，确认数据还在（说明持久卷生效）

---

## 八、注意事项

- **单实例部署**：SQLite 不支持多实例并发写；如需横向扩展，请走路线 B（Postgres/Supabase）。
- **首次启动**会自动建库并写入演示数据，无需手动初始化。
- 文档解析是**后台异步**的：上传接口立即返回，前端每 3 秒轮询一次状态。
- 进程重启后会自动恢复「上次未处理完」的文档（状态停留在处理中的任务会被重新入队）。
