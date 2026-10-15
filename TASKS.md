# Project Tasks

Work on one task at a time, in order. When a task is done and tested, change `[ ]` to `[x]` and commit.
Deployment happens right after Phase 4. Later phases are improvements on a live project.

## Phase 0: Planning
- [x] Create GitHub repo, npm project and full folder structure (see CLAUDE.md), with a minimal Express server and `GET /api/health`
- [x] Define categories (core parts and peripherals) and the `specs` fields for each category
- [x] Write the list of compatibility rules (socket, RAM type, wattage, motherboard and case size, GPU length)
- [x] Define the pages and what each page shows
- [x] Design the database and write `server/db/schema.sql`, then create the tables in PostgreSQL

## Phase 1: Foundation
- [x] Connect Express to PostgreSQL (`pg` Pool, `.env`)
- [x] API for stores and categories
- [x] API for products and offers
- [x] `client/css/base.css`: design tokens (colors, fonts, spacing) for light and dark mode, and shared components (buttons, cards, tables, form fields)
- [x] Language and theme: `i18n.js` with `ar.json` / `en.json` (RTL/LTR switching) and `theme.js` (light/dark), both saved in localStorage
- [x] Simple admin page to add parts and offers
- [x] Prebuilt PCs category: ready-made PCs sold by stores, with short specs (CPU, GPU, RAM, storage) and offers like any part
- [ ] Seed data: 30 to 50 parts from the stores in `seed.sql` (Amazon.sa, Noon, AliExpress, Newegg and local PC stores) (`server/db/seed.sql`)

## Phase 2: Compare
- [x] Home page and navigation: top bar (page links, search bar, language switch, light/dark toggle) and a hamburger menu (account and the same page links)
- [x] Parts listing page with search results (by name, brand or model)
- [x] Category-specific filters (Prebuilt PCs: CPU name, GPU chipset, RAM and storage, also set from the link `parts.html?category=prebuilt&cpu_name=...&gpu_chipset=...`)
- [x] Sort parts by newest or oldest, "Added" filter (today, last 2 days, last 3 days) and an "Added today" badge on parts added today
- [x] Part page: offers from all stores grouped by store (up to two trusted sellers per store, price range and best offer per store, total with shipping), sortable by total price, delivery time or trust score; highlight the best offer

## Phase 3: Accounts
- [x] Sign-up and sign-in pages (username + email + password; sign in with username or email; show/hide password)
- [x] Account in the menu: "Log in" for guests; for signed-in users a square profile picture (first letter of the username), the username, an "Admin" badge for admins, and the Admin link only for admins
- [x] bcrypt password hashing, JWT in an httpOnly cookie
- [ ] Auth middleware to protect routes, and `requireAdmin` for admin-only routes (user roles: `user` / `admin`)
- [ ] Protect the admin page and all admin API routes with `requireAdmin`; users list in the admin page to give or remove admin access

## Phase 4: Build your PC and My list
- [ ] UI for picking core parts: interactive SVG PC case (a line and a clickable circle for each part, colored by status) and the parts list under it; clicking a circle or "Choose" opens a part picker dropdown for that category (scrollable list, search box, price filter, compatible parts only, and each part's prices in every store to pick the offer)
- [ ] Compatibility checks (`server/src/services/compatibility.js`) and showing errors and warnings
- [ ] Peripherals section and its warnings (monitor vs GPU, ports)
- [ ] Ready-made PC suggestion in the Build page: when the build has a CPU and a GPU, show a card with the cheapest prebuilt PC price with the same CPU and GPU (and at least the same RAM and storage) and the difference from the build total; clicking it opens the Parts page on the Prebuilt PCs category filtered by that CPU and GPU
- [ ] Live build total (sticky bar) that updates instantly when a part is added, removed or changed; the cheapest offer is used unless the user picked another
- [ ] Builds bar in the Build page (no separate "My builds" page): a tab per build, "+" for a new build, rename, duplicate and delete (only by the user, with a confirmation); every change saved right away, guests in localStorage moved to the account after sign-in
- [ ] My list ("قائمتي", separate from builds): add single offers from the part page or a whole build, links grouped by store, total cost, longest delivery time; guests in localStorage, moved to the account after sign-in

## Deploy (right after Phase 4)
- [ ] Test every page on mobile and fix responsive issues
- [ ] Input validation, rate limiting, check all queries are parameterized
- [ ] Deploy on free plans: the server on Render and the database on Neon or Supabase
- [ ] README with screenshots, project description and how to run it
- [ ] Add the project and its link to the CV and LinkedIn

## Teaser (right after the first deploy)
- [ ] Choose the site name, and create X and TikTok accounts with that name
- [ ] Short teaser posts and videos: screen recordings of the interactive PC case, compatibility errors and price comparison ("coming soon")
- [ ] Build-in-public updates while working on Phase 5 (what was added this week)

## Phase 5: Price updates
- [ ] "Paste link" tool in the admin page (read JSON-LD from the product page)
- [ ] Scheduled update job with node-cron for at least one store, running every 3 days; plus an "update now" button in the admin page to refresh one offer or all offers manually
- [ ] Mark an offer as "broken link" when the update job fails to read its price 3 times in a row; hide broken offers from users and list them in the admin page for review
- [ ] Offer alerts in the admin page: old offers (not checked for 7+ days), changed offers (different product name or out of stock) and offers hidden automatically, with actions to clear, edit, show again or delete
- [ ] `price_history`, a price chart on the part page, and the lowest and highest price in the last 30 days for each store

## Public launch (after Phase 5)
- [ ] Free site address: the free Render subdomain (e.g. `site-name.onrender.com`) named after the site; no paid domain
- [ ] Open Graph and Twitter card tags (title, description, image) so links show a preview card on X
- [ ] Real data: enough parts with real prices and product links across the stores
- [ ] Privacy policy, terms and a disclaimer (prices can change; not affiliated with the stores), and a contact page
- [ ] Visit analytics (to see how many people come from X and TikTok)
- [ ] Check hosting speed and limits for real visitors (free plans sleep and are slow on the first visit)
- [ ] Launch posts on X and TikTok

## Phase 6: Price alerts
- [ ] Turn on an alert for a part (any drop, or a target price)
- [ ] Check alerts after each price update, with a minimum drop and at most one alert per day
- [ ] In-site notifications and email with Nodemailer
- [ ] "Forgot password": email a reset link (one-time token that expires) with Nodemailer

## Phase 7: Smart features
- [ ] Suggest a build from a budget and purpose (rules in code, no AI)
- [ ] Store trust score with the reasons shown (rules in code)

## Phase 8: Tests and polish
- [ ] Profile picture upload (square, small size limit), shown in the menu instead of the letter
- [ ] API tests with Jest and Supertest
- [ ] Run tests automatically with GitHub Actions
- [ ] Update README and CV with the new features
