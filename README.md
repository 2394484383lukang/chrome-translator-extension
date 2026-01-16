# AI翻译助手 Chrome插件

一个功能强大的Chrome翻译插件，支持划词翻译和页面翻译，使用AI大模型提供高质量翻译。

## 功能特性

- **划词翻译**: 选中网页上的文本，自动弹出翻译气泡
- **页面翻译**: 一键翻译整个页面内容
- **AI大模型支持**: 
  - DeepSeek (deepseek-chat, deepseek-coder)
  - GLM4.7 (glm-4, glm-4-plus, glm-4-0520)
- **自定义配置**: 
  - 多种目标语言支持
  - 翻译风格选择（正式/随意/专业）
  - API密钥安全管理

## 安装方法

1. 下载或克隆此项目到本地
2. 打开Chrome浏览器，输入 `chrome://extensions/`
3. 开启"开发者模式"开关
4. 点击"加载已解压的扩展程序"
5. 选择项目文件夹 `chrome-translator-extension`

## 配置步骤

### 获取API密钥

**DeepSeek:**
1. 访问 [DeepSeek官网](https://platform.deepseek.com/)
2. 注册账号并获取API密钥

**GLM4.7:**
1. 访问 [智谱AI官网](https://open.bigmodel.cn/)
2. 注册账号并获取API密钥

### 插件配置

1. 点击浏览器工具栏中的插件图标
2. 点击"⚙️ 设置"按钮
3. 选择API提供商（DeepSeek或GLM）
4. 输入对应的API密钥
5. 选择目标语言和翻译风格
6. 点击"💾 保存设置"
7. 点击"🧪 测试连接"验证配置

## 使用方法

### 划词翻译
1. 在网页上选中要翻译的文本
2. 自动弹出翻译气泡
3. 点击"翻译"按钮获取翻译结果

### 页面翻译
1. 点击插件图标打开popup
2. 选择"页面翻译"模式
3. 点击"翻译"按钮
4. 翻译结果将在新窗口中显示

### 右键菜单翻译
1. 选中网页上的文本
2. 右键点击选择"使用AI翻译助手翻译"

## 项目结构

```
chrome-translator-extension/
├── manifest.json              # 插件配置文件
├── popup/                     # 弹出界面
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── options/                   # 设置页面
│   ├── options.html
│   ├── options.css
│   └── options.js
├── content/                   # 内容脚本
│   ├── content.js
│   └── content.css
├── background/                # 后台服务
│   └── background.js
├── lib/                       # 工具库
│   └── api.js
└── icons/                     # 图标资源
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## 技术栈

- **Manifest V3**: 最新的Chrome扩展API
- **原生JavaScript**: 无框架依赖，轻量高效
- **Chrome Storage API**: 本地配置存储
- **Modern Fetch API**: HTTP请求处理

## 隐私说明

- 本插件所有配置数据均存储在本地浏览器中
- API密钥仅用于调用翻译服务，不会上传到其他服务器
- 不会收集用户的浏览历史和翻译内容

## 许可证

MIT License

## 贡献

欢迎提交问题和改进建议！

## 更新日志

### v1.0.0 (2024-01-13)
- 初始版本发布
- 支持DeepSeek和GLM4.7 API
- 实现划词翻译和页面翻译功能
- 添加自定义配置选项