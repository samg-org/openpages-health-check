# OpenPages Health Check – interview booking site

Static page on **GitHub Pages** ([`index.html`](index.html)) + **Google Apps Script** backend that stores bookings on a **monday.com board** ([`Code.gs`](Code.gs)).
Participants pick a 25-minute slot on Dec 8–9, 2026 (ET). The script rejects double-booking (script lock) and duplicate emails. Bookings appear as items on the monday board.

## 1. Backend (Apps Script + monday.com board)

1. Board: "OpenPages Health Check Bookings (Scotiabank)" (id in `CONFIG.BOARD_ID`; column ids in `CONFIG.COL`). Share it only with the IBM team.
2. Go to script.google.com, open the existing project (or create one). Replace `Code.gs` with this repo's [`Code.gs`](Code.gs). Save.
3. **Project Settings → Script Properties → Add**: key `MONDAY_TOKEN`, value = a monday API token. Never put the token in the code or the page.
4. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Authorize when prompted, then copy the web app URL (ends in `/exec`).
6. Open the URL in a browser; you should see JSON with `personas` and `slots`.

After any later edit to `Code.gs`, use **Deploy → Manage deployments → Edit → New version** (the URL stays the same).

## 2. Frontend (GitHub Pages)

1. In [`index.html`](index.html) set `API_URL` to the web app URL.
2. Push to a GitHub repo → **Settings → Pages** → deploy from branch/folder containing `index.html`.
3. The Pages URL is the link to share.

## Organizers

Open the monday board: each item is a booking (name, slot, email, group, senior flag, notes). Send calendar invites from there. Sort by Slot to build the interview schedule.

## Adjusting

Edit `CONFIG` at the top of `Code.gs` (`DAYS`, hours, `PERSONAS`) and redeploy a new version.

## Data handling

- The board holds names/emails — keep it private, share only with the IBM team, and delete it after the engagement.
- The monday token sits in Script Properties; use a token you can revoke after the engagement.
- The web app URL is public by design (it must be callable from the page); it only exposes slot availability and accepts bookings. Do not put anything else sensitive on that board.
- Repo and Pages site are public if the repo is public. Never commit exported bookings.
