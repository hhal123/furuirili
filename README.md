# 弗睿营销日历

一个专门为东南亚电商营销设计的日历系统，帮助管理和跟踪各个国家的节日和季节性活动。

## 功能特点

- 显示东南亚各国（泰国、马来西亚、印尼、菲律宾）的节日和季节性活动
- 支持按国家筛选事件
- 事件提前一天显示，方便提前准备
- 显示未来100天内的事件倒计时
- 支持添加、编辑和删除事件
- 支持为每个事件添加SKU和历史产品信息
- 响应式设计，适配不同屏幕尺寸

## 技术栈

- HTML5
- CSS3
- JavaScript (原生)
- Supabase (数据库)

## 安装和使用

1. 克隆仓库：
```bash
git clone https://github.com/yourusername/marketing-calendar.git
```

2. 配置Supabase：
   - 创建一个新的Supabase项目
   - 创建`config.js`文件并添加你的Supabase配置：
```javascript
const SUPABASE_URL = 'your-supabase-url'
const SUPABASE_ANON_KEY = 'your-supabase-anon-key'
```

3. 打开`index.html`即可使用

## 数据库结构

### holidays表
- id: uuid (主键)
- date: date
- name: text
- description: text
- category: text
- region: text
- products: jsonb
- history_products: jsonb

### seasonal_events表
- id: uuid (主键)
- date: date
- name: text
- description: text
- category: text
- region: text
- duration: integer
- products: jsonb
- history_products: jsonb

## 使用说明

1. 事件管理：
   - 点击"添加新事件"按钮创建新事件
   - 点击已有事件可查看详情并编辑
   - 在事件详情中可添加SKU和历史产品信息

2. 日期导航：
   - 使用左右箭头切换月份
   - 点击"回到今天"返回当前月份

3. 地区筛选：
   - 使用顶部的复选框筛选显示的国家

## 注意事项

- 添加/编辑/删除事件需要输入密码
- 事件会提前一天显示在日历上
- SKU信息支持一键复制功能

## 许可证

MIT 