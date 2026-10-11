# Pages

Every page the site has, who can open it, and what it shows.
Design details come later (Phase 2); this file is about content and actions.

## Pages

| page          | name_ar               | file                  | who can open it |
|---------------|-----------------------|-----------------------|-----------------|
| Home          | الرئيسية              | `index.html`          | everyone |
| Parts         | القطع                 | `parts.html`          | everyone |
| Part          | صفحة القطعة           | `part.html?id=...`    | everyone |
| Build         | جمّع جهازك            | `build.html`          | everyone (guests save in localStorage) |
| Shopping list | قائمة الشراء          | `shopping-list.html`  | everyone |
| Sign up / in  | التسجيل / الدخول      | `signup.html`, `signin.html` | everyone |
| My builds     | تجميعاتي              | `my-builds.html`      | signed-in users |
| Admin         | لوحة الأدمن           | `admin.html`          | admins only |

Later: price alerts and notifications (Phase 6).

## On every page: navigation bar

- Logo (link to home), links to Parts, Build, Shopping list.
- **Search bar**: searches parts by name, brand or model and opens Parts with the results.
- Language switch (ar / en) and light/dark toggle.
- Sign in / sign up, or the user's name with My builds and sign out. Admins also see Admin.

## Home

- Short intro: what the site does (compare prices, build a PC).
- Two main buttons: "Compare prices" (Parts) and "Build your PC" (Build).
- Category shortcuts: one card per category (CPU, GPU, monitor...), opens Parts filtered by that category.
- **Most searched parts**: the parts people search for most. Needs search tracking (a count per part when it appears in search results or is opened), so it comes after the parts listing works.
- **Biggest price drops**: parts whose price fell the most recently. Needs `price_history`, so it comes in Phase 5.

## Parts

- Category tabs or select, filters for the chosen category (e.g. socket for CPUs, `chip_brand` and VRAM for GPUs, resolution and panel for monitors), and price range.
- Filters for every category: **brand** (ASUS, MSI, Gigabyte..., from the brands of the parts in that category) and **store** (show only parts with an offer in the chosen stores).
- Results as cards: image, name, brand, lowest total price (price + shipping) and in how many stores it is available.
- Sort by lowest price or name.
- Loading, empty ("no parts match") and error states.

## Part

- Image, name, brand, model, and the specs table for its category (panel types show their help text).
- Under the specs, the lowest total price and the store it comes from, and an **"Explore prices in stores"** button.
- The button opens a dropdown list of stores. Each store shows its best price; the cheapest store is highlighted. Clicking the button again closes the list.
- **Inside each store** (expand the store row): up to two trusted sellers and the store's price range.
- Each offer row: seller (and "official" badge), price, shipping, total, delivery days, in stock, "last updated", and three actions:
  - **"Buy from store"**: opens the store page in a new tab.
  - **"Add to build"**: adds the part to the current build with this offer, so it goes through the compatibility checks.
  - **"Add to shopping list"**: adds only this link to the shopping list, without a build.
- Sort offers by total price, delivery time or store trust score; the best place to buy is highlighted.
- International stores (e.g. Newegg, AliExpress) show the customs/VAT note.
- A quick **"Add to build"** button outside the list adds the part with the cheapest offer.
- Adding to the build replaces the part in that category, except storage which can have several.
- The build and the shopping list are **separate**: the build is for a full PC with compatibility checks; the shopping list is any parts the user wants to buy, with or without a build.
- Later: price chart and the lowest and highest price in the last 30 days (Phase 5).

## Build

- One row per category: core parts first (CPU, motherboard, RAM, GPU, storage, PSU, case, cooler), then peripherals.
- Each row: the chosen part with its best total price, or a "Choose" button that opens Parts for that category; buttons to change or remove.
- **Compatibility results** at the top: errors in red, warnings in yellow, each linked to the parts involved.
- Estimated power draw next to the PSU.
- Total price and build status: ready, or what is missing or not compatible.
- Save button: guests save in localStorage; signed-in users save to their account (name, budget, purpose).
- **"Move all to shopping list"** button: adds every part of the build, with its chosen offer, to the shopping list.

## Shopping list

- Everything the user added (single parts from the part page, or a whole build), grouped by store, each with the offer the user chose.
- Each part can switch to another store or seller from a dropdown.
- Each part: name, seller, price, shipping, quantity, a **"Buy from store"** link, and a remove button.
- Guests keep the list in localStorage; signed-in users save it to their account (moved after sign-in, like builds).
- Per store: subtotal and delivery days.
- Grand total and the longest delivery time.
- No payment on the site; users buy from each store through the links.

## Sign up / Sign in

- Sign up: name, email, password (with password rules shown).
- Sign in: email and password.
- Clear error messages (email already used, wrong email or password).
- After sign-in, a guest build in localStorage moves to the account.

## My builds

- List of saved builds: name, purpose, total price, status (ready or not), last updated.
- Open a build (goes to Build), rename it, or delete it.
- Empty state with a link to Build.

## Admin

- **Parts**: add or edit a part (category, brand, name, model, image, and the specs fields for that category).
- **Offers**: add or edit an offer for a part (store, seller, official, rating, reviews, price, currency, shipping, delivery days, link, in stock).
- **Stores**: add or edit a store (name, website, ships from, delivery, warranty, returns, trust score).
- **Users**: list of users; give or remove admin access (an admin cannot remove their own).
- Later (Phase 5): "paste link" tool, "update now" button, and the list of broken links.
