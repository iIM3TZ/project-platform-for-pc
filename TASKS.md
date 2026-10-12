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
- [ ] API for stores and categories
- [ ] API for products and offers
- [ ] `client/css/base.css`: design tokens (colors, fonts, spacing) for light and dark mode, and shared components (buttons, cards, tables, form fields)
- [ ] Language and theme: `i18n.js` with `ar.json` / `en.json` (RTL/LTR switching) and `theme.js` (light/dark), both saved in localStorage
- [ ] Simple admin page to add parts and offers
- [ ] Seed data: 30 to 50 parts from 5 stores: Amazon.sa, Noon, AliExpress, Newegg and one local PC store (`server/db/seed.sql`)

## Phase 2: Compare
- [ ] Home page and navigation bar (with the search bar, the language switch and the light/dark toggle)
- [ ] Parts listing page with search results (by name, brand or model)
- [ ] Category-specific filters
- [ ] Part page: offers from all stores grouped by store (up to two trusted sellers per store, price range and best offer per store, total with shipping), sortable by total price, delivery time or trust score; highlight the best place to buy

## Phase 3: Accounts
- [ ] Sign-up and sign-in pages (username + email + password; sign in with username or email; show/hide password)
- [ ] bcrypt password hashing, JWT in an httpOnly cookie
- [ ] Auth middleware to protect routes, and `requireAdmin` for admin-only routes (user roles: `user` / `admin`)
- [ ] Protect the admin page and all admin API routes with `requireAdmin`; users list in the admin page to give or remove admin access

## Phase 4: Build your PC and shopping list
- [ ] UI for picking core parts: interactive SVG PC case (a line and a clickable circle for each part, colored by status) and the parts list under it; clicking a circle or "Choose" opens a part picker dropdown for that category (scrollable list, search box, price filter, compatible parts only)
- [ ] Compatibility checks (`server/src/services/compatibility.js`) and showing errors and warnings
- [ ] Peripherals section and its warnings (monitor vs GPU, ports)
- [ ] Totals and the cheapest offer for each part
- [ ] Saving builds; guest builds in localStorage moved to the account after sign-in
- [ ] Shopping list (separate from builds): add single offers from the part page or a whole build, links grouped by store, total cost, longest delivery time; guests in localStorage, moved to the account after sign-in

## Deploy (right after Phase 4)
- [ ] Test every page on mobile and fix responsive issues
- [ ] Input validation, rate limiting, check all queries are parameterized
- [ ] Deploy the server (Render or Railway) and the database (Neon or Supabase)
- [ ] README with screenshots, project description and how to run it
- [ ] Add the project and its link to the CV and LinkedIn

## Phase 5: Price updates
- [ ] "Paste link" tool in the admin page (read JSON-LD from the product page)
- [ ] Scheduled update job with node-cron for at least one store, running every 3 days; plus an "update now" button in the admin page to refresh one offer or all offers manually
- [ ] Mark an offer as "broken link" when the update job fails to read its price 3 times in a row; hide broken offers from users and list them in the admin page for review
- [ ] `price_history`, a price chart on the part page, and the lowest and highest price in the last 30 days for each store

## Phase 6: Price alerts
- [ ] Turn on an alert for a part (any drop, or a target price)
- [ ] Check alerts after each price update, with a minimum drop and at most one alert per day
- [ ] In-site notifications and email with Nodemailer
- [ ] "Forgot password": email a reset link (one-time token that expires) with Nodemailer

## Phase 7: Smart features
- [ ] Extract specs from product descriptions with AI, reviewed before saving
- [ ] Suggest a build from a budget and purpose
- [ ] Store trust score with the reasons shown

## Phase 8: Tests and polish
- [ ] API tests with Jest and Supertest
- [ ] Run tests automatically with GitHub Actions
- [ ] Update README and CV with the new features
