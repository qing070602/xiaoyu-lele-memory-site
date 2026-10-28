# 小宇和乐乐的猫咪纪念小窝

手机优先的纯静态情侣纪念网站，包含原创 SVG 小猫、相恋天数、时间线、相册和信封情书。HTML、CSS、JavaScript 直接运行，无需框架、安装依赖或构建。

## 修改内容

打开根目录 `config.js`。所有页面文案、昵称、纪念日、口令、情书和相册列表都在这里。

- `couple`：双方昵称。各页面里想单独写的称呼位于 `copy` 和 `letter`。
- `startDate`：纪念日起点，保持 ISO 格式并显式写北京时间，例如 `2026-06-12T00:00:00+08:00`。当天是第 1 天，次日第 2 天。
- `access.password`：入口口令，必须是字符串，例如 `"0612"`，避免丢掉开头的零。修改后也可以同步修改 `copy.gate.hint` 提示。
- `copy`：首页、入口、导航、按钮、提示、空状态和其他页面文字。
- `letter`：情书称呼、逐段正文和落款。
- `photos`：相册列表，每张包含 `src`、`caption`、`alt` 和 `placeholder`。

### 添加时间线

编辑 `data/timeline.json`，按想展示的顺序添加条目：

```json
{
  "date": "2026-06-12",
  "title": "我们在一起啦",
  "description": "在这里写下想记住的小事",
  "placeholder": false
}
```

日期暂时没决定可以用空字符串。示例卡片使用 `placeholder: true`，换成真实经历时改为 `false`。空数组 `[]` 会显示空状态。

### 替换照片

1. 把图片放进 `assets/photos/`，建议使用较小的 JPEG 或 WebP，文件名使用英文或数字。
2. 在 `config.js` 的 `photos` 中登记：

```js
{ src: "assets/photos/our-photo.jpg", caption: "这张照片的小故事", alt: "照片里是什么", placeholder: false }
```

3. 删除不用的占位条目。仅复制图片到文件夹不会自动添加进相册。图片路径区分大小写；缺失时页面会显示本地占位图。

## 本地预览

因为时间线和小猫 SVG 会通过 fetch 读取，需要使用静态 HTTP 服务器，不能直接双击 HTML 预览完整功能。在装有 Node.js 的电脑上，可使用自己熟悉的静态服务器，或用 Vercel 的预览部署检查。

## 临时发布与自动更新

临时使用 GitHub Pages 发布。公开发布仓库是 `qing070602/xiaoyu-lele-memory-site`，Pages 的发布源设置为 `main` 分支、根目录。提交配置和照片后，GitHub 会自动触发 Pages 发布；在 Actions 中确认 `pages build and deployment` 为 Success，再检查实际页面。

私有仓库 `qing070602/xiaoyu-lele-memory` 保留完整源码。两个仓库没有自动双向同步；临时站需要更新时，请更新公开发布仓库，并将需要保留的改动同步到私有仓库。

### 以后迁回 Vercel

使用个人私有 GitHub 仓库 `qing070602/xiaoyu-lele-memory`，导入 Vercel 项目。Framework Preset 选择 **Other**，Build Command 留空，输出目录使用项目根目录。

之后在 GitHub 修改配置或上传照片，提交到 `main`。Vercel 会自动触发部署；在项目 Deployments 页面确认状态变为 Ready，再用生产地址打开检查。上传照片和登记路径最好在同一次提交完成。

重新部署后若正在打开的标签页仍显示旧内容，刷新一次。部署成功、浏览器测试与微信真机测试是不同的验证步骤；分享前用手机网络和微信检查实际生产链接。

## 口令与搜索收录

默认演示口令是 `0612`，仅提供前端遮挡，文字和照片仍以静态文件方式托管。不要把它当成真正的隐私保护。解锁状态只在当前标签页中保存，可点击右上角“锁上小窝”清除。

页面带有 `noindex`，并为以后的 Vercel 部署配置了 `X-Robots-Tag` 响应头；GitHub Pages 不应用 `vercel.json`，当前使用页面内的 `noindex`。这些是搜索引擎指令，不是访问控制。私有 GitHub 仓库只保护源码仓库的访问，不会让发布后的静态资源变私有。

## 原创与开源许可

- 小猫、蝴蝶结、占位插画、页面样式和交互为此项目原创，不含现成版权角色图片。
- 中文字体：Google Fonts 的 ZCOOL KuaiLe；英文及数字：Mali。字体随站点托管，SIL Open Font License 见 `assets/fonts/` 内的 OFL 文件。
- UI 图标基于 Lucide，许可见 `assets/ICON-LICENSE`。
- 开源情侣站点已作为功能调研参考；未拷贝许可不明确的模板代码。
