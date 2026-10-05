# Stamp system: 3 websites + 1 backend

| Part | Folder | Local address | Who uses it |
|---|---|---|---|
| Website 1 | `customer-site/` | http://localhost:3001 | customers: stamp card, camera scanner |
| Website 2 | `staff-site/` | http://localhost:3002 | staff: log in, choose cups, make QR |
| Website 3 | `admin-site/` | http://localhost:3003 | admin: QR log, create/remove staff accounts |
| Backend | `backend/server.js` | http://localhost:3000 | the one API all three call; owns the data and the rules |

## 1. Run on your computer
Install Node 18+ (nodejs.org), then in this folder: `node start.js`. Demo logins: `admin / admin123`, `staff / staff123`.
Test without a camera: copy the Code under a QR on the staff site and paste it into "Type the code" on the customer site.

## 2. How the pieces link (read this first)
```
customer-site --\
staff-site    ---+--- fetch(API + '/api/...') ---> backend (server.js) ---> data.json
admin-site    --/
```
- The three websites are plain files with no data in them. Each has a `config.js` with one line: `const API = ''`.
- `API` is the backend's address. `''` works only on your computer (start.js forwards `/api`). Live, you write the real address, for example `const API = 'https://stamp-api.onrender.com'`.
- The backend must know which websites may call it (CORS). That is the `ALLOW_ORIGIN` setting: the three website addresses, separated by commas.
- So linking = **(a) put the backend address into each site's `config.js`** and **(b) put the three site addresses into the backend's `ALLOW_ORIGIN`**.

## 3. Where to publish
| Part | What it is | Good places (check each one's current free plan) |
|---|---|---|
| Backend | a Node.js program | Render, Railway, Fly.io, or any VPS |
| 3 websites | static files | Netlify, Cloudflare Pages, GitHub Pages, Vercel |

Everything must be on https, which these hosts give you. That also makes the phone camera work.

## 4. Publish step by step (the order matters)
**Step 1. Put the project on GitHub.** Create a free GitHub account and a new repository. Click "Add file > Upload files", drag in everything from this folder, and commit.

**Step 2. Publish the backend (Render, as the example).**
1. render.com > New > Web Service > connect your GitHub repository.
2. Build command: leave empty (or `npm install`). Start command: `node backend/server.js`.
3. Environment variables: `SECRET` = a long random text; `ADMIN_PASSWORD` = the password you want for `admin`; leave `ALLOW_ORIGIN` for later.
4. Deploy. Copy the address it gives you, e.g. `https://stamp-api.onrender.com`. Open `.../api/card?customerId=test1234` in a browser; you should see `{"total":0}`.

**Step 3. Tell each website where the backend is.** Edit `config.js` in `customer-site`, `staff-site` and `admin-site`: `const API = 'https://stamp-api.onrender.com';` (your address, no trailing slash).

**Step 4. Publish the three websites (Netlify, as the example).**
1. Go to app.netlify.com/drop and sign in. Drag the `customer-site` folder onto the page. Do the same for `staff-site` and `admin-site`: that makes three separate sites.
2. In each site's settings you can rename it (e.g. `yourshop-stamps.netlify.app`). Write down all three addresses.

**Step 5. Tell the backend which websites may call it.** In Render > Environment, set
`ALLOW_ORIGIN` = `https://yourshop-stamps.netlify.app,https://yourshop-staff.netlify.app,https://yourshop-admin.netlify.app`
(exact addresses, no trailing slash). Save; Render redeploys.

**Step 6. Test in this order.** Admin site: log in as `admin`, Staff accounts > create a staff user. Staff site: log in as that user, make a QR for 2 cups. Customer site on your phone: Scan QR code, point at the staff screen; 2 stamps appear. Back on the admin site, the QR log shows the QR as Used.

**Step 7. Give customers the link.** Put the customer website address in your LINE Official Account (rich menu button or greeting message). Keep the staff and admin addresses private.

## 5. When something goes wrong
| What you see | Cause and fix |
|---|---|
| Red CORS error in the browser console | `ALLOW_ORIGIN` is missing or doesn't exactly match the site address (https, no trailing slash) |
| "Failed to fetch" or Unexpected token | `API` in `config.js` is wrong or still `''` |
| First request after a while is very slow | free backend plans may sleep when idle; upgrade or accept the delay |
| Stamps and accounts vanish after a redeploy | many hosts wipe files on redeploy, and `data.json` is a file. See below |
| Camera won't open | the site must be on https and the browser needs camera permission |

## 6. Before real customers (important)
- **Data storage.** `data.json` is fine for testing. For real use, either attach a persistent disk to the backend (if your host offers one) or replace the JSON file with a database (for example PostgreSQL or SQLite on a persistent disk). All data code is in the `db`/`save()` parts of `server.js`.
- Keep `SECRET` and `ADMIN_PASSWORD` private and never put them in a website file.
- The customer is identified by a random id saved in their browser. Anyone who clears their browser loses the card. Using LINE Login (LIFF) fixes that by tying the card to the LINE account.
- Add login rate limiting before opening the staff site to the public.

## Cloud deployment

This project is prepared for a single-server deployment. See `DEPLOY-TO-RENDER.md` for beginner-friendly Render instructions.
