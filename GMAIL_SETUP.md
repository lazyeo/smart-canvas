# 📧 Gmail Manager 使用指南

## 🚀 快速开始

### 第一步：获取 Gmail 应用专用密码

1. **访问 Google 账户安全设置**
   - 打开：https://myaccount.google.com/security
   - 或者在 Google 账户设置中找到"安全性"

2. **启用两步验证**（如果还没启用）
   - 在"安全性"页面找到"两步验证"
   - 按照提示完成设置

3. **生成应用专用密码**
   - 在"安全性"页面找到"应用专用密码"
   - 选择"邮件"和"Mac"
   - 点击"生成"
   - 复制生成的 16 位密码（格式：xxxx xxxx xxxx xxxx）

### 第二步：配置工具

创建配置文件：

```bash
cp gmail_config.json.template gmail_config.json
```

编辑 `gmail_config.json`，填入你的信息：

```json
{
  "email": "your-email@gmail.com",
  "app_password": "xxxxxxxxxxxxxxxx"
}
```

⚠️ **注意**：
- app_password 是 16 位密码，去掉空格
- 不是你的 Gmail 账户密码
- 这个文件包含敏感信息，不要分享给他人

### 第三步：使用工具

#### 📬 查看最新邮件

```bash
# 查看最新 10 封邮件
python3 gmail_manager.py list

# 查看最新 20 封邮件
python3 gmail_manager.py list 20

# 只查看未读邮件
python3 gmail_manager.py list 10 --unread
```

#### 🔍 搜索邮件

```bash
# 搜索包含关键词的邮件
python3 gmail_manager.py search "发票"
python3 gmail_manager.py search "Amazon"
```

#### 📤 发送邮件

```bash
python3 gmail_manager.py send "recipient@example.com" "邮件主题" "邮件内容"
```

---

## 🎯 功能特点

✅ **完全独立** - 不依赖 Mail.app，直接连接 Gmail 服务器
✅ **安全可靠** - 使用 Gmail 官方 IMAP/SMTP 协议
✅ **功能丰富** - 读取、发送、搜索、标记邮件
✅ **与 Superhuman 兼容** - 两者操作同一个邮箱，自动同步
✅ **命令行友好** - 可以在脚本中自动化使用

---

## 🔧 进阶功能

如果你需要更强大的功能（如批量操作、标签管理、过滤器等），我可以升级到使用 **Gmail API**，提供更多企业级功能。

---

## ❓ 故障排除

### 连接失败？
1. 确认已启用两步验证
2. 确认应用专用密码正确（16位，无空格）
3. 检查网络连接

### 无法获取应用专用密码？
- 确保 Gmail 账户已启用两步验证
- 某些企业/学校账户可能被管理员限制

---

## 💡 提示

- 这个工具与 Superhuman 完全兼容，互不影响
- 所有操作都是实时的，立即同步到 Gmail 服务器
- 你可以将这个工具集成到其他自动化脚本中
