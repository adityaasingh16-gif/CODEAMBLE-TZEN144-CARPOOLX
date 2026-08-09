# CarpoolX

## What changed from the original zip

**Backend/** was not runnable — no `package.json`, no `.env`, and every
route/controller `require()`d files under different folder/file names than
what existed (e.g. `./config/db` vs `Backend/DataBase/DB.js`). It's now
restructured to conventional lowercase folders (`config/`, `middleware/`,
`controllers/`, `routes/`, `models/`, `utils/`) with all requires fixed,
missing files added (`generateToken.js`, `generateOTP.js`,
`sendNotification.js`, `errorMiddleware.js`, `rideRoutes.js`), the
`Mailer.js` syntax bug fixed, and the `User` model given password hashing +
a `matchPassword` method it was missing. All modules load cleanly now.

**Frontend/** — kept the plain HTML/CSS/JS pages. Removed the old
`server.js`'s fake sqlite+bcrypt auth (it wasn't even connected to the
`login.html` you actually see — that page had its own separate, third,
in-memory mock `db.users` object that reset on every page load). `login.html`
now calls the real Backend through `api-client.js`. `dashboard.js` needed no
changes — it already reads the session from `localStorage` and degrades
gracefully, which `api-client.js` now feeds real data into.

`Frontend/login.js` is still in the folder but **isn't loaded by any page**
— it was already dead code in the original zip (references form IDs that
don't exist in `login.html`). Safe to ignore or delete.

`Frontend/profile 1` is a stray Flutter/Dart file, unrelated to this web
app — looks like a leftover from a separate mobile attempt. Not wired into
anything; ignore or delete it.

## Known external-service limitations

- **File uploads** (profile photo, driving licence, RC book, vehicle
  photos, PAN/Aadhaar in the driver signup flow) are collected in the UI
  but never sent anywhere — the Backend has no upload endpoint. Needs
  `multer` + storage (S3/Cloudinary) if you want that to actually work.
- **Google login** and **forgot/reset password** on `login.html` are now
  disabled with an honest message instead of silently failing — neither
  has a real backend endpoint yet.
- **`Frontend/SRC/`** (the separate React component files —
  `EmergencySOS.js`, `RealTimeChat.js`, `Search&Book.js`) wasn't touched.
  It's not a working app (no `package.json`, no build setup) — if you want
  those features, they'd need to be built into pages inside `Frontend/` or
  turned into a real React app.
- The live pages now use the backend for profile data, ride history, ride chat,
  notifications, and post-ride reviews. `localStorage` is retained only as a
  cache/session fallback when the backend is unavailable.
- Google Maps is not configured with a hardcoded key. Address lookup uses the
  no-key OpenStreetMap geocoder and the application keeps its safe map-link
  fallback.

## Newer files merged in from a later upload (2026-08-04)

A follow-up zip added several new files. Here's what happened with each:

- **`login.html`** — the new upload still had the *pre-fix* fake `db.users`
  auth (i.e. it wasn't based on the fixed version). I re-applied the same
  real-backend wiring on top of it, and kept two genuine improvements it
  had: the driver mobile number field now uses `type="tel"` with
  `autocomplete="tel"`, and driver-signup mobile numbers go through
  `normalizePhone()` so the display mask (`98765 43210`) doesn't fail
  validation.
- **`index.html`, `Final_Dash_sidebar.html`, `driver's dashboard.html`** —
  three draft/experimental dashboard pages that came in the new upload.
  **None of them are linked from anywhere** — `login.html` still redirects
  to `index final 1.html` (the one already fixed to book real rides), so
  that's the live dashboard. These three are kept in the folder for
  reference but aren't wired into navigation. If you want to switch to one
  of them as the real dashboard, flag it — `index.html` and
  `driver's dashboard.html` both still have the same "always finds a fake
  driver" bug that was fixed in `index final 1.html` (hardcoded
  `availableRides` array / `triggerSimulatedRideRequest()`), so it'd need
  the same fix applied.
- **`chat.html`, `chat.js`, `carpool-tools.js`** — an AI chatbot feature
  (driver Q&A + "track a driver" demo). **Not wired into `server.js`** —
  the version of `server.js` in the new upload required
  `./ollama-mcp-chatbot`, a file that doesn't exist anywhere in either
  upload, so that server would crash on startup. Our `server.js` stays a
  plain static file server; it doesn't serve `/api/chat` or `/api/track`.
  `carpool-tools.js` also has its own hardcoded fake driver catalog (Aarav
  Kumar, Neha Singh, Rohan Deshpande) behind a `/api/track` demo endpoint —
  same fake-data pattern as before, though the chat UI does honestly label
  it "demo tracking" rather than pretending it's real. If you want this
  chatbot working for real, it needs `ollama-mcp-chatbot.js` built (a local
  Ollama model + MCP tool-calling setup) — that's a separate, sizable piece
  of work, not something that can be inferred from what's here.
- Dropped an `edited js files.zip` (12.7MB, contained a full
  `node_modules`) that was sitting inside the project folder itself in the
  new upload — that shouldn't be zipped up as part of the source.



## Run it locally

**1. Backend**
```bash
cd Backend
cp .env.example .env
# edit .env: set MONGO_URI (see MongoDB Atlas steps below) and JWT_SECRET
npm install
npm run dev        # or: npm start
```
Runs on `http://localhost:5000`. Check `http://localhost:5000/health`.

**2. Frontend**
```bash
cd Frontend
npm install
npm start
```
Runs on `http://localhost:5500`. Open `http://localhost:5500/login.html`.

Frontend's `api-client.js` points at `http://localhost:5000/api` by default
— that only needs to change when you deploy (see below).

## Tests

Run the backend unit/regression suite without MongoDB or external services:

```bash
cd Backend
npm test
```

The suite covers route matching and ordering, detour fare rules, payload
validation, and source-level checks for atomic booking and token-protected SOS
invariants. Database-backed integration tests should be added when a test
MongoDB environment is available.

## Driver verification (edit vehicle/license + admin approval)

Added `Frontend/vehicle-details.html` (driver-facing — edit vehicle and
license number/expiry, submit for review) and
`Frontend/admin-verification.html` (admin-facing — approve/reject
submissions). Backend additions in `Backend/models/User.js`,
`controllers/authController.js`, `routes/authRoutes.js`,
`middleware/authMiddleware.js`:

- `User.drivingLicense: { number, expiryDate }` — didn't exist before,
  only a `drivingLicenseVerified` boolean with nothing underneath it
- `User.verificationStatus` — `not_submitted` / `pending` / `approved` /
  `rejected`, plus `verificationNote` for rejection reasons
- `User.isAdmin` — didn't exist at all before; **to make an account an
  admin, set `isAdmin: true` on that user's document directly in MongoDB
  Atlas** (Browse Collections → `users` → edit the document). There's no
  in-app way to grant admin — that's intentional, so a driver can't just
  approve themselves.
- Editing vehicle/license details resets `verificationStatus` back to
  `pending` automatically — an approval doesn't silently carry over to
  edited details.
- `GET /api/auth/admin/drivers?status=pending` and
  `PUT /api/auth/admin/drivers/:id/review` — admin-only (blocked by the
  new `adminOnly` middleware).

**Also added** `Frontend/admin-users.html` — general list/search across
*all* passengers and drivers (not just ones pending review), with a search
box (name/email/phone) and role filter, plus a dropdown per row to set
`accountStatus` (active/suspended/blocked). Backed by
`GET /api/auth/admin/users?search=&role=` and
`PUT /api/auth/admin/users/:id/status` — same `adminOnly` gate as above.
The two admin pages cross-link to each other.

Not done: uploading the actual license/RC photo files — this only
covers structured fields (license number, expiry, plate number, etc.),
same file-upload gap noted earlier in this README.

## Deploying

**Database — MongoDB Atlas (free tier is fine)**
1. Create a free cluster at https://www.mongodb.com/cloud/atlas
2. Database Access → add a user with a password
3. Network Access → add `0.0.0.0/0` (or your host's IP) so your deployed
   backend can reach it
4. Connect → Drivers → copy the connection string, put it in `MONGO_URI`

**Backend — Render (or Railway, both have simple free/low-cost tiers)**
1. Push this repo to GitHub
2. New Web Service → connect the repo → root directory `Backend`
3. Build command: `npm install` — Start command: `npm start`
4. Add environment variables: `MONGO_URI`, `JWT_SECRET`, `EMAIL_USER`,
   `EMAIL_PASSWORD`, `NODE_ENV=production`
5. Deploy — note the resulting URL, e.g. `https://carpoolx-api.onrender.com`

**Frontend — same host or a static host (Netlify/Vercel/Render static site)**
1. Easiest: another Render Web Service, root directory `Frontend`,
   build `npm install`, start `npm start`
2. Before/after deploying, tell the frontend where the backend lives by
   adding this to the `<head>` of `login.html` (and any other page that
   loads `api-client.js`):
   ```html
   <meta name="carpoolx-api-base" content="https://carpoolx-api.onrender.com/api">
   ```
3. In `Backend/server.js`, lock CORS down from `origin: '*'` to your actual
   frontend URL once you know it, e.g.
   `cors: { origin: 'https://carpoolx.onrender.com' }`

**Free-tier note:** Render's free web services spin down after inactivity —
first request after idle can take ~30-50s to wake up. Fine for a project
demo, worth mentioning if a professor is testing it live.

## Changes from this round (2026-08-08 requested edits)

1. **About vs. Help were pointing to the same page.** Sidebar "About" used
   to route to `help.html`. Added a real `Frontend/about.html` (what
   CarpoolX is, route matching / fare / safety blurb) and pointed
   `navigate('About')` at it. The "Help" bottom-nav item and the
   Settings modal's "Help & Support" link were already correctly wired to
   `help.html` — nothing was broken there.
2. **Emergency Contacts card on `profile2.html`** was navigating to
   `history.html` (ride history) when tapped — an unrelated leftover link.
   It now opens the existing "Edit Profile Details" modal, focused on the
   Emergency Contacts field, since that's where it's actually editable.
3. **"Failed to fetch" on login/signup.** `api-client.js`'s `apiRequest()`
   didn't catch network-level fetch failures (backend not running, wrong
   `CARPOOLX_API_BASE`, CORS rejection) — those surfaced as a raw
   `TypeError: Failed to fetch`, which every caller then displayed verbatim
   as `error.message`. It now catches that case and shows a plain-English
   message telling the person the server can't be reached, instead of a
   cryptic error. If login/signup is still failing after this, it means
   the Backend genuinely isn't reachable from wherever the Frontend is
   hosted — check `CARPOOLX_API_BASE` / that the Backend is running / CORS
   `FRONTEND_ORIGIN`.
4. **`postride.html` rewritten.** The rating screen is now the page shown
   on load (no more landing on a "Congratulations" screen first), and
   every field on it — date, route, driver name, vehicle, fare, OTP — is
   pulled from a real booking via the new `apiGetBookingById` /
   `apiGetMyBookings` calls, not hardcoded. If a `rideId`/`bookingId`/
   `targetUserId` are in the URL (see point 5) those are used directly;
   otherwise it falls back to the person's most recently completed
   booking. If there's genuinely no completed ride yet, it says so
   honestly instead of showing fake data.
5. **Submit rating now actually works.** The old page required
   `rideId`/`bookingId`/`targetUserId` in the URL or `localStorage`, but
   nothing in the app ever set them — so the button always hit "open this
   page from a completed ride" and never called the API. Fixed two ways:
   the fallback in point 4 means it works even with no params, and
   `history.html` now shows a "Rate This Ride" button on completed ride
   cards that links to `postride.html?rideId=...&bookingId=...&targetUserId=...`
   with the real driver's id, so a rating always lands against the right
   ride/driver via `POST /api/reviews`.
6. **Submit and Next Ride are now two separate, independent buttons**
   (previously one combined "Submit & Book Next Ride" button). "Next Ride"
   always goes straight to the dashboard (`index final 1.html`), rating
   submitted or not. "Submit" posts the review, then shows a "Thank You"
   confirmation screen (with a "Continue to Dashboard" button) — it
   doesn't silently redirect.
7. **Removed the old "post ride" landing screen.** What used to be the
   default first screen (Congratulations / CO₂-saved / co-riders banner
   with fabricated numbers) is gone as a landing page. Its "thank you"
   framing is reused, but only after a rating is actually submitted, and
   without the made-up CO₂/co-rider stats — it now shows the star rating
   just given and the real co-rider count when that data is available.
8. **New `Frontend/driver-dashboard.html`.** There was no real driver page
   before — `Frontend/driver's dashboard.html` (kept, unlinked, for
   reference) was a fully fake mockup: hardcoded name/rating ("Rajesh",
   "Gold Captain"), a wallet + payout flow, an "eco score", and a
   "Simulate Incoming Ride Request" button, none of which have any backend
   behind them. The new page instead:
   - Gates on login + `isDriver`, with an honest message either way
     (nudges non-drivers back to the passenger app rather than pretending
     to work).
   - Shows the driver's real name/rating/verification status via
     `apiGetProfile`.
   - Lists the driver's actually-posted rides via the new `apiGetMyRides()`
     (`GET /api/rides/mine`), including real booked passengers per ride.
   - "Post a New Ride" reuses the exact working create-ride flow already
     built into `index final 1.html` (geocode → `apiCreateRide`).
   - Per-ride actions call the new `apiUpdateRideStatus()`
     (`PUT /api/rides/:id/status`) to move a ride scheduled → in-progress →
     completed, or cancel it — no accept/reject step needed since
     `bookRide` already auto-accepts bookings.
   - Linked in from `index final 1.html`'s sidebar ("Driver Dashboard").
   - Not built (no backend support exists for these, so they're left out
     rather than faked): wallet/earnings, payouts, an "eco score",
     in-app chat, and live map/location tracking for the driver.
