#!/usr/bin/env python3
"""
Gmail Manager - 通过 IMAP/SMTP 管理 Gmail
不需要 Mail.app，直接连接 Gmail 服务器
"""

import imaplib
import smtplib
import email
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.header import decode_header
import json
import sys
from datetime import datetime

class GmailManager:
    def __init__(self, email_address, app_password):
        """
        初始化 Gmail 管理器
        email_address: 你的 Gmail 地址
        app_password: Gmail 应用专用密码（不是账户密码）
        """
        self.email_address = email_address
        self.app_password = app_password
        self.imap_server = "imap.gmail.com"
        self.smtp_server = "smtp.gmail.com"
        self.imap = None
        self.smtp = None
    
    def connect_imap(self):
        """连接到 IMAP 服务器（读取邮件）"""
        try:
            self.imap = imaplib.IMAP4_SSL(self.imap_server)
            self.imap.login(self.email_address, self.app_password)
            return True
        except Exception as e:
            print(f"❌ IMAP 连接失败: {e}")
            return False
    
    def connect_smtp(self):
        """连接到 SMTP 服务器（发送邮件）"""
        try:
            self.smtp = smtplib.SMTP_SSL(self.smtp_server, 465)
            self.smtp.login(self.email_address, self.app_password)
            return True
        except Exception as e:
            print(f"❌ SMTP 连接失败: {e}")
            return False
    
    def list_mailboxes(self):
        """列出所有邮箱文件夹"""
        if not self.imap:
            self.connect_imap()
        
        status, folders = self.imap.list()
        print("\n📁 你的邮箱文件夹：")
        for folder in folders:
            print(f"  - {folder.decode()}")
    
    def get_emails(self, mailbox="INBOX", limit=10, unread_only=False):
        """
        获取邮件列表
        mailbox: 邮箱文件夹（默认收件箱）
        limit: 获取数量
        unread_only: 是否只显示未读邮件
        """
        if not self.imap:
            self.connect_imap()
        
        self.imap.select(mailbox)
        
        # 搜索邮件
        search_criteria = "UNSEEN" if unread_only else "ALL"
        status, messages = self.imap.search(None, search_criteria)
        
        email_ids = messages[0].split()
        total = len(email_ids)
        
        print(f"\n📬 共找到 {total} 封邮件" + (" (未读)" if unread_only else ""))
        
        # 获取最新的 N 封邮件
        email_list = []
        for email_id in email_ids[-limit:]:
            status, msg_data = self.imap.fetch(email_id, "(RFC822)")
            
            for response_part in msg_data:
                if isinstance(response_part, tuple):
                    msg = email.message_from_bytes(response_part[1])
                    
                    # 解码主题
                    subject = self.decode_header_value(msg["Subject"])
                    from_ = self.decode_header_value(msg.get("From"))
                    date = msg.get("Date")
                    
                    email_info = {
                        "id": email_id.decode(),
                        "subject": subject,
                        "from": from_,
                        "date": date
                    }
                    email_list.append(email_info)
        
        return email_list
    
    def decode_header_value(self, value):
        """解码邮件头部信息"""
        if value is None:
            return ""
        
        decoded_parts = decode_header(value)
        decoded_value = ""
        for part, encoding in decoded_parts:
            if isinstance(part, bytes):
                decoded_value += part.decode(encoding or "utf-8", errors="ignore")
            else:
                decoded_value += part
        return decoded_value
    
    def send_email(self, to, subject, body, html=False):
        """
        发送邮件
        to: 收件人（可以是列表）
        subject: 主题
        body: 正文
        html: 是否为 HTML 格式
        """
        if not self.smtp:
            self.connect_smtp()
        
        msg = MIMEMultipart("alternative")
        msg["From"] = self.email_address
        msg["To"] = to if isinstance(to, str) else ", ".join(to)
        msg["Subject"] = subject
        
        if html:
            msg.attach(MIMEText(body, "html"))
        else:
            msg.attach(MIMEText(body, "plain"))
        
        try:
            self.smtp.send_message(msg)
            print(f"✅ 邮件已发送到: {msg['To']}")
            return True
        except Exception as e:
            print(f"❌ 发送失败: {e}")
            return False
    
    def search_emails(self, query, mailbox="INBOX"):
        """
        搜索邮件
        query: 搜索关键词（在主题和发件人中搜索）
        """
        if not self.imap:
            self.connect_imap()
        
        self.imap.select(mailbox)
        
        # 搜索主题和发件人
        search_criteria = f'(OR SUBJECT "{query}" FROM "{query}")'
        status, messages = self.imap.search(None, search_criteria)
        
        email_ids = messages[0].split()
        print(f"\n🔍 找到 {len(email_ids)} 封匹配 '{query}' 的邮件")
        
        return self.get_email_details(email_ids)
    
    def get_email_details(self, email_ids):
        """获取邮件详情"""
        email_list = []
        for email_id in email_ids:
            status, msg_data = self.imap.fetch(email_id, "(RFC822)")
            
            for response_part in msg_data:
                if isinstance(response_part, tuple):
                    msg = email.message_from_bytes(response_part[1])
                    
                    email_info = {
                        "id": email_id.decode(),
                        "subject": self.decode_header_value(msg["Subject"]),
                        "from": self.decode_header_value(msg.get("From")),
                        "date": msg.get("Date"),
                        "body": self.get_email_body(msg)
                    }
                    email_list.append(email_info)
        
        return email_list
    
    def get_email_body(self, msg):
        """提取邮件正文"""
        body = ""
        if msg.is_multipart():
            for part in msg.walk():
                if part.get_content_type() == "text/plain":
                    body = part.get_payload(decode=True).decode(errors="ignore")
                    break
        else:
            body = msg.get_payload(decode=True).decode(errors="ignore")
        return body[:500]  # 只返回前500字符
    
    def mark_as_read(self, email_id):
        """标记邮件为已读"""
        if not self.imap:
            self.connect_imap()
        
        self.imap.store(email_id, '+FLAGS', '\\Seen')
        print(f"✅ 邮件 {email_id} 已标记为已读")
    
    def close(self):
        """关闭连接"""
        if self.imap:
            self.imap.close()
            self.imap.logout()
        if self.smtp:
            self.smtp.quit()


def main():
    """命令行交互界面"""
    print("""
╔═══════════════════════════════════════════╗
║     Gmail Manager - 邮件管理工具          ║
║     无需 Mail.app，直接管理 Gmail         ║
╚═══════════════════════════════════════════╝
    """)
    
    if len(sys.argv) < 2:
        print("""
使用方法：

1. 查看最新邮件：
   python3 gmail_manager.py list [数量] [--unread]
   
2. 搜索邮件：
   python3 gmail_manager.py search "关键词"
   
3. 发送邮件：
   python3 gmail_manager.py send 收件人 "主题" "正文"
   
4. 配置账户：
   首先需要在同目录创建 gmail_config.json 文件：
   {
     "email": "your@gmail.com",
     "app_password": "your-app-password"
   }
   
⚠️  注意：需要在 Google 账户中启用"应用专用密码"
        """)
        return
    
    # 读取配置
    try:
        with open("gmail_config.json", "r") as f:
            config = json.load(f)
            email_address = config["email"]
            app_password = config["app_password"]
    except FileNotFoundError:
        print("❌ 未找到配置文件 gmail_config.json")
        return
    
    # 创建管理器
    gm = GmailManager(email_address, app_password)
    
    command = sys.argv[1]
    
    try:
        if command == "list":
            limit = int(sys.argv[2]) if len(sys.argv) > 2 else 10
            unread_only = "--unread" in sys.argv
            emails = gm.get_emails(limit=limit, unread_only=unread_only)
            
            print("\n" + "="*60)
            for i, email_info in enumerate(emails, 1):
                print(f"\n📧 邮件 #{i}")
                print(f"   主题: {email_info['subject']}")
                print(f"   发件人: {email_info['from']}")
                print(f"   日期: {email_info['date']}")
                print("-"*60)
        
        elif command == "search":
            query = sys.argv[2] if len(sys.argv) > 2 else ""
            emails = gm.search_emails(query)
            
            for i, email_info in enumerate(emails, 1):
                print(f"\n📧 邮件 #{i}")
                print(f"   主题: {email_info['subject']}")
                print(f"   发件人: {email_info['from']}")
                print(f"   预览: {email_info['body'][:100]}...")
        
        elif command == "send":
            to = sys.argv[2]
            subject = sys.argv[3]
            body = sys.argv[4]
            gm.send_email(to, subject, body)
        
        else:
            print(f"❌ 未知命令: {command}")
    
    finally:
        gm.close()


if __name__ == "__main__":
    main()
