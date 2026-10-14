# 必填和选填

| 类别 | 字段/条件 | 不填的结果 |
| --- | --- | --- |
| 硬性：所有运行 | Node.js 22+、可写数据目录、可用端口 | 无法启动或保存，智能体处理安装/目录/端口 |
| 硬性：联网/云端 | `PET_ACCESS_PASSWORD` 至少12字符 | `HOST` 非回环地址时服务拒绝启动；访问时用户名可填 pet，密码是自己配置的密码 |
| 有默认值 | `HOST=127.0.0.1`、`PORT=3210`、`PET_DATA_DIR=./data` | 本机不必手填；默认只在本机访问 |
| 选填昵称 | `PET_OWNER_NICKNAME` | 默认“朋友”；不需要真实姓名或年龄 |
| 选配聊天/记忆提取 | `PET_CHAT_API_KEY`、地址、`PET_CHAT_MODEL` | 没有 AI 回复；基础故事/养成仍可用 |
| 选配转文字 | `PET_ASR_API_KEY`、地址、模型、`PET_ASR_PROVIDER`；FFmpeg | 录音仍可保存，但不能自动转文字 |
| 选配声音 | `PET_TTS_API_KEY`、地址、模型、`PET_TTS_VOICE`、`PET_TTS_PROVIDER` | 无合成声音，文字功能可用 |
| 选配照片上传 | Python + Pillow，必要时 `PET_IMAGE_PYTHON` | 不能处理上传照片，基础玩法可用 |
| 选配看图 | 百炼 `PET_VISION_API_KEY`、`PET_VISION_BASE_URL`、`PET_VISION_MODEL` | 不能理解图片；默认原生百炼格式 |
| 选配后续进化/额外动作 | `PET_ENABLE_GENERATION=1` + `PET_IMAGE_API_KEY`、`PET_IMAGE_BASE_URL`、编辑模型；Python+openai+Pillow、FFmpeg | 基础两次预制进化可玩，之后停在现有完整形态 |
| 选配旅行 | `PET_ENABLE_TRIPS=1`、`PET_DISABLE_TRIPS=0` + 聊天、看图、图片生成；需开启生成 | 没有旅行生成；旁白另外依赖 TTS |

共享 `PET_AI_API_KEY` 或 `OPENAI_API_KEY` 是聊天/转文字/发声的 key 后备；`PET_AI_BASE_URL` 是三者地址后备。不同服务/模型/声音必须符合用户的提供商，不能假设一个 key 包办所有服务。`VISION` 不用共享 key，而是专用 key 或 ASR key；若 ASR 是别的供应商不能据此宣称看图可用。

ASR/TTS 实现了 `openai` 和 `bailian` 两种格式；CHAT 使用 OpenAI-compatible 格式；VISION 使用百炼原生格式。模型默认值在 `.env.example`，需验证供应商实际支持。图片 CLI 只接收 base64 图片返回；需要供应商支持多参考图编辑。

`PET_IMAGE_PYTHON`、`PET_IMAGE_CLI`、`PET_IMAGE_FFMPEG` 可覆盖工具路径；默认 Python 是 Windows `python` / Linux `python3`，FFmpeg 为 `ffmpeg`。可安装 `python -m pip install -r scripts/image-requirements.txt`；只上传图片需要 Pillow 即可。基础版只需要 Node。

`.env` 只在服务器加载，现有进程环境优先。公开页面只显示配置存在或未配置，不输出密钥，不验证余额。`PET_SKIP_ENV=1` 是测试开关，不会清空继承环境；测试时移除所有真实服务 key 并保持生成/旅行关闭。

生日在游戏里可选，替换宠物也可选，不把它们作为首次启动的必填资料。AI 服务可能收费；“免费托管”不等于“免费 AI”。
