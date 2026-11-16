# OpenPages Health Check – interview booking site

Static page on **GitHub Pages** ([`index.html`](index.html)) + **Google Apps Script / Google Sheet** backend ([`Code.gs`](Code.gs)).
Participants pick a 25-minute slot on Dec 8–9, 2026 (ET). The script rejects double-booking (script lock) and duplicate emails. Bookings appear as rows in the Sheet.

## 1. Backend (Google Sheet + Apps Script)

1. Create a new Google Sheet (e.g. "OpenPages Health Check bookings"). Share it only with the IBM team.
2. **Extensions → Apps Script**. Replace the contents of `Code.gs` with this repo's [`Code.gs`](Code.gs). Save.
3. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Authorize when prompted, then copy the web app URL (ends in `/exec`).
5. Open the URL in a browser; you should see JSON with `personas` and `slots`.

After any later edit to `Code.gs`, use **Deploy → Manage deployments → Edit → New version** (the URL stays the same).

## 2. Frontend (GitHub Pages)

1. In [`index.html`](index.html) set `API_URL` to the web app URL.
2. Push to a GitHub repo → **Settings → Pages** → deploy from branch/folder containing `index.html`.
3. The Pages URL is the link to share.

## Organizers

Open the Sheet: tab **Bookings** has slot, name, email, group, senior flag and notes. Send calendar invites from there. Sort by Slot to build the interview schedule.

## Adjusting

Edit `CONFIG` at the top of `Code.gs` (`DAYS`, hours, `PERSONAS`) and redeploy a new version.

## Data handling

- The Sheet holds names/emails — restrict sharing and delete it after the engagement.
- The web app URL is public by design (it must be callable from the page); it only exposes slot availability and accepts bookings. Do not put anything else sensitive in that spreadsheet.
- Repo and Pages site are public if the repo is public. Never commit exported bookings.
