# 🎵 هسته مستقل استریم و دانلود یوتیوب (haste strim)
### High-Performance Standalone YouTube Music Streaming & Audio Core for Node.js

این پوشه حاوی سرویس کامل، مستقل و خودکفای استریم و جستجوی یوتیوب موزیک است که می‌توانید آن را به صورت مستقیم کپی کرده و در هر پروژه دیگری (Express، Fastify، NestJS، الکترون یا سرور مستقل) استفاده نمایید.

---

## 📁 ساختار فایل‌های درون این پوشه (Folder Structure)

```text
haste strim/
├── bin/
│   └── yt-dlp                # باینری آماده اجرای yt-dlp برای لینوکس (بدون نیاز به نصب)
├── providers/
│   ├── index.js              # هماهنگ‌کننده چندموتوره و کش هوشمند استریم
│   ├── innertube.js          # کلاینت پرسرعت youtubei.js با ارتقای کاور به کیفیت 1200px
│   ├── ytdlp.js              # موتور yt-dlp با پایش خودکار باینری و کوکی‌ها
│   ├── invidious.js          # پروایدر سرورهای عمومی Invidious برای شرایط انسداد شبکه
│   └── chain.js              # سیستم پایش سلامت موتورها و مدیریت خودکار Cooldown
├── app.js                    # روتر کامل اکسپرس (شامل /play, /stream, /download, /api/search)
├── audio.js                  # موتور استریم صوت با هدرهای Range و پایپ آنی
├── browserCookies.js         # استخراج خودکار کوکی از کروم/اج/بریو برای عبور از بات دیتکشن
├── cookies.txt               # فایل کوکی Netscape آماده برای دسترسی بدون محدودیت
├── index.js                  # ورودی پکیج و اکسپورت توابع اصلی
├── net.js                    # تشخیص خودکار پراکسی سیستم و پشتیبانی از SOCKS5/HTTP
├── package.json              # مانیفست اختصاصی پکیج با وابستگی‌های کامل
├── render.js                 # پلیر تحت وب سبک داخلی برای تست مستقیم در مرورگر
├── server.js                 # سرور مستقل آماده اجرا با دستور npm start
├── test.js                   # اسکریپت تست سریع سلامت هسته و جستجو
└── README.md                 # راهنمای کامل فارسی و انگلیسی
```

---

## 🚀 روش ۱: اجرای سرور مستقل (Standalone Server)

اگر می‌خواهید این سرویس را مثل یک میکروسرویس مستقل اجرا کنید:

```bash
# وارد پوشه شوید
cd "haste strim"

# نصب وابستگی‌ها
npm install

# اجرای سرور
npm start
```

سرور به طور پیش‌فرض روی پورت `4000` (یا پورت مشخص شده در متغیر `PORT`) اجرا می‌شود:
* **پلیر تحت وب برای تست در مرورگر:** `http://localhost:4000/`
* **جستجوی موزیک:** `http://localhost:4000/api/search?q=Shadmehr`
* **استریم زنده آهنگ با ساپورت Seek:** `http://localhost:4000/play/<videoId>`
* **دانلود مستقیم فایل صوتی:** `http://localhost:4000/download/<videoId>?title=MySong`
* **ریدایرکت مستقیم CDN:** `http://localhost:4000/stream/<videoId>`
* **وضعیت سلامت موتورها:** `http://localhost:4000/api/status`

---

## 🔌 روش ۲: اتصال به پروژه دیگر (Express / Node.js)

کافیست کل پوشه `haste strim` را داخل پروژه مقصد کپی کنید و در کد سرور خود اضافه کنید:

```javascript
import express from 'express';
import { createYouTubeStreamer } from './haste strim/index.js';

const app = express();

// اتصال هسته استریم به پروژه روی مسیر /yt
const ytRouter = await createYouTubeStreamer({
  mode: 'auto',              // حالت‌های ممکن: 'auto' | 'proxy' | 'ytdlp'
  installSystemProxy: true   // شناسایی خودکار پراکسی‌های سیستم
});

app.use('/yt', ytRouter);

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

حالا در کلاینت خود می‌توانید از مسیرهای زیر استفاده کنید:
* استریم موزیک در تگ `<audio>`:
  `<audio src="/yt/play/dQw4w9WgXcQ" controls></audio>`
* جستجوی موزیک:
  `fetch('/yt/api/search?q=Adele')`
* دانلود فایل:
  `<a href="/yt/download/dQw4w9WgXcQ?title=SongName">دانلود</a>`

---

## 🛠️ توابع مستقیم (Direct Programmatic API)

شما همچنین می‌توانید توابع را بدون روت‌های Express مستقیماً در کدهای خود فراخوانی کنید:

```javascript
import { search, resolveStream, status, detectProxy } from './haste strim/index.js';

// ۱. جستجوی موزیک در یوتیوب موزیک
const songs = await search('Shadmehr Aghili', 10);
console.log(songs);
// خروجی: [{ videoId, title, artist, duration, thumbnail }, ...]

// ۲. دریافت لینک مستقیم استریم صوتی
const stream = await resolveStream('dQw4w9WgXcQ');
console.log(stream.url);        // لینک مستقیم CDN
console.log(stream.mimeType);   // مثلا audio/mp4 یا audio/webm
console.log(stream.via);        // موتور حل‌کننده (innertube, yt-dlp, invidious)

// ۳. بررسی سلامت موتورها
console.log(status());
```

---

## 📡 مشخصات کامل Endpoint ها (API Reference)

| مسیر | متد | پارامترها | توضیحات |
| :--- | :--- | :--- | :--- |
| `/api/search` | `GET` | `q` (متن جستجو) | جستجوی آهنگ در یوتیوب موزیک با کاورهای ارتقایافته |
| `/play/:videoId` | `GET` | `strict=true` (اختیاری) | استریم زنده صوت با هدرهای استاندارد `Accept-Ranges: bytes` |
| `/download/:videoId` | `GET` | `title` (نام دلخواه آهنگ) | ارسال هدر `Content-Disposition: attachment` برای دانلود تمیز |
| `/stream/:videoId` | `GET` | - | ریدایرکت ۳۰۲ مستقیم مرورگر به لینک CDN گوگل |
| `/api/status` | `GET` | - | وضعیت تک‌تک موتورها (innertube / yt-dlp / invidious) |
| `/healthz` | `GET` | - | پاسخ `{"ok": true}` جهت بررسی لایونس سرور |
| `/` | `GET` | `q` (اختیاری) | رابط کاربری گرافیکی پلیر تحت وب برای تست آسان |

---

## 🛡️ سیستم ۴ مرحله‌ای عبور از فیلترینگ و بات دیتکشن (Bypass & Anti-Bot)

این هسته مجهز به ۴ لایه هوشمند است:

1. **InnerTube (youtubei.js):** کلاینت نیتیو پرسرعت که کلاینت‌های مختلف (`YTMUSIC`, `IOS`, `ANDROID`, `WEB`) را برای دریافت بدون محدودیت تست می‌کند.
2. **yt-dlp Engine:** قدرتمندترین ابزار که به همراه باینری داخلی در پوشه `bin/` قرار دارد و با فلش‌های `--cookies` و شناسایی مرورگرهای سیستم کار می‌کند.
3. **Invidious Fallback:** در صورتی که دیتاسنتر یا شبکه مقصد یوتیوب را مسدود کرده باشد، از سرورهای واسط آزاد برای استخراج صوت بهره می‌برد.
4. **iTunes High-Res Fallback:** اگر دیتاسنتر ابری به طور کامل توسط یوتیوب محدود شود، به صورت نامحسوس نسخه باکیفیت رسمی از سرورهای اپل لود می‌شود تا پخش صدا هرگز قطع نشود.

### فعال‌سازی پراکسی در شبکه‌های مسدود (Proxy Configuration):
هسته به طور خودکار پراکسی‌های سیستم (V2Ray, Clash, Nekoray) را شناسایی می‌کند. همچنین می‌توانید دستی متغیر محیطی تنظیم کنید:
```bash
# نمونه پراکسی HTTP یا SOCKS5:
export PROXY_URL="socks5://127.0.0.1:10808"
# یا
export PROXY_URL="http://127.0.0.1:7890"
```

### کوکی‌های مرورگر برای سرورهای داخلی یا دسکتاپ:
اگر روی ویندوز، مک یا لینوکس اجرا می‌کنید، هسته به صورت خودکار کوکی‌های اکانت گوگل لاگین شده در مرورگر شما (Chrome, Edge, Brave, Firefox) را برای رفع محدودیت کپچا به کار می‌گیرد. برای سرورهای لینوکسی ابری نیز می‌توانید فایل `cookies.txt` را با اکستنشن [Get cookies.txt LOCALLY](https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc) خروجی بگیرید و درون همین پوشه قرار دهید.

---

## ⚙️ متغیرهای محیطی قابل تنظیم (Environment Variables)

| متغیر | پیش‌فرض | توضیحات |
| :--- | :--- | :--- |
| `PORT` | `4000` | پورت سرور مستقل |
| `HOST` | `0.0.0.0` | آی‌پی بایند سرور |
| `PROXY_URL` | خالی | آدرس سرور پراکسی مانند `socks5://127.0.0.1:10808` |
| `COOKIES_FILE` | `cookies.txt` | مسیر فایل کوکی اختصاصی |
| `STREAM_MODE` | `auto` | استراتژی استریم: `auto` یا `proxy` یا `ytdlp` |
| `ENGINE` | `auto` | انتخاب موتور انحصاری: `auto` یا `innertube` یا `ytdlp` یا `invidious` |
| `NO_BROWSER_COOKIES`| `false` | غیرفعال‌سازی خواندن کوکی‌های مرورگر محلی |

---

## 🧪 اجرای تست سلامت (Verification Test)

برای اطمینان از کارکرد صحیح بدون نیاز به اجرای سرور وب:

```bash
node test.js
```

تست به صورت خودکار پراکسی، باینری yt-dlp، جستجو و تفکیک استریم را امتحان کرده و زمان پاسخگویی را چاپ می‌کند.
