# Pet

一个可以讲故事、做菜、喂食、成长和跳舞的小猫网页游戏。基础版开箱可玩，不需要 AI key；聊天、语音、看图和后续 AI 生成按需选配。MIT 开源。

## 交给智能体

用 Codex 或其他智能体打开项目，告诉它：

> 帮我配置并启动这个项目，先读取 AGENTS.md 和 pet-setup Skill，主动问我必填信息，并解释哪些选配可以不填。

仓库内置 `.agents/skills/pet-setup/SKILL.md`，根目录 `AGENTS.md` 要求首次接手主动询问。支持自动发现的宿主可读取仓库技能；其他宿主请手动读取这两份文件。它不会在没有运行智能体或用户尚未发出请求时自行发消息。[官方 Skill 说明](https://learn.chatgpt.com/docs/build-skills)

## 本机启动

需要 Node.js 22+。没有 npm 第三方依赖。

```sh
npm run setup
npm run doctor
npm start
```

也可直接 `npm start` 使用全部默认配置。打开 http://localhost:3210 。本机默认只监听回环地址，进度保存在 `data/`。一份服务只有一份共享进度。首次运行没有任何原用户资料。

## 哪些必填，哪些可不填

| 类别 | 配置 | 不填会怎样 |
| --- | --- | --- |
| 硬性运行条件 | Node.js 22+、可写目录、可用端口 | 不能启动/保存；目录与端口已有默认值 |
| 联网部署必填 | 自己的 `PET_ACCESS_PASSWORD`，至少12字符 | 非回环监听时拒绝启动；本机可以不填 |
| 选填 | 昵称、生日、替换角色 | 使用默认小猫和“朋友”，不需要真实身份 |
| 选配 AI 聊天 | 自己的聊天 key、地址、支持的模型 | 无 AI 回复；基础游戏照常 |
| 选配转文字/声音 | 对应 key、模型、提供商/声音；转文字需 FFmpeg | 没有该语音能力，仍能写故事或保存录音 |
| 选配照片/看图 | Python+Pillow；看图另需百炼配置 | 不使用照片能力，其他玩法照常 |
| 选配额外进化/动作/旅行 | 明确开启生成、自己的图片服务与所需依赖；旅行还需聊天+看图 | 基础两次预制进化及对应动作照常，之后不生成 |

详细字段见 [.env.example](.env.example) 和 [配置说明](.agents/skills/pet-setup/references/configuration.md)。`npm run doctor` 只显示缺项，绝不打印密钥或调用收费服务。已填 key 不等于余额/模型/网络已实测。

图片和旅行生成默认关闭；填 key 也不会自行打开。服务可能收费，免费托管不代表 AI 免费。所有密钥只放服务器 `.env` 或托管 Secret，不放浏览器或 GitHub。`npm run setup` 输入密钥时隐藏文字。

## 预制成长

原始形态 + 两次进化，共三套小猫，后两套自带匹配的待机、眨眼、跳舞动作。累计喂食3、8次完成两次基础成长。没有私人故事或真实家庭背景。默认停止在最后预制形态；选配图片生成后才继续后续成长。

[角色替换说明](.agents/skills/pet-setup/references/customization.md)介绍替换图像、部件、称呼及提示词。原图保留现有白底，进化图为透明 PNG。

## 上线

提供 Dockerfile 和 Render 免费模板。`render.yaml` 是临时试玩方案：用你自己的 Render/GitHub 账号，平台生成访问密码，浏览器用户名可填 `pet`。所有页面与数据 API 需密码，仅 `/healthz` 公共。

**免费 Render 的本地数据会在休眠、重启或重新部署后消失，不能用于承诺长期保档。** 长期使用需要你自己的持久盘环境；本项目尚无 SQL/远程存储适配。[Render 官方限制](https://render.com/docs/free) · [部署说明](.agents/skills/pet-setup/references/deployment.md)

公网请使用平台 HTTPS 或自己的 HTTPS 代理；手机网页麦克风也需要 HTTPS 与浏览器许可。不要复用开发者的服务器、域名或凭据。AI 功能会把相应内容发送到你所配置的供应商，启用前了解其费用与隐私政策。

## 检查

基础运行只需 Node；完整测试/美术检查还需要 Python、Pillow 和 FFmpeg。Python 使用 `python`（Windows）/`python3`（Linux），可用 `PET_IMAGE_PYTHON` 指定。

```sh
python -m pip install -r scripts/image-requirements.txt
npm test
npm run check:evolution
```

测试音频由 FFmpeg 合成，不包含真人录音。检查程序不请求真实供应商；图片完整性检查与实际浏览器动作验证分别进行。云模板需在你自己的账号部署并验证，不代表所有免费平台已实测。
