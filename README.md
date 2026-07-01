# พระโอวาท — Web App

A React implementation of the Claude Design "พระโอวาท" (dharma-quote) prototypes.
Warm gold-on-dark theme, Thai UI, Sarabun typography.

## Stack

- **React 18** + **TypeScript**
- **Vite** (dev server / build)
- **React Router** for page navigation

## Pages

| Route     | Page                       | Source prototype                   |
| --------- | -------------------------- | ----------------------------------- |
| `/`       | Home (หน้าหลัก)             | `project/หน้าหลัก.dc.html`          |
| `/search` | Search (หน้าค้นหา)          | `project/หน้าค้นหา.dc.html`         |
| `/full`   | Full text (พระโอวาทฉบับเต็ม) | `project/พระโอวาทฉบับเต็ม.dc.html`  |
| `/login`  | Login (เข้าสู่ระบบ)         | `project/เข้าสู่ระบบ.dc.html`       |

The home page's search bar links to `/search`; the "เปิดรับพระโอวาทชี้แนะวันนี้"
button opens the daily-quote modal, whose "อ่านพระโอวาทต้นฉบับ" button links to
`/full`. Every page's "พระโอวาท" wordmark returns home. `/login` is reachable
directly and isn't linked from the home nav, matching the source design.

## Develop

```bash
npm install
npm run dev      # start the dev server
npm run build    # type-check + production build
npm run preview  # preview the production build
```
