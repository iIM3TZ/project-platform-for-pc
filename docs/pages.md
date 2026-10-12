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
- Results as cards: image, name, brand, in how many stores it is available, and two prices:
  - **Cheapest**: the lowest total price (price + shipping) and its store.
  - **Most trusted**: the best offer from the most trusted seller (see "Most trusted offer" below) and its store. If it is also the cheapest, the card shows one price with both labels.
- Sort by lowest price or name.
- Loading, empty ("no parts match") and error states.

## Part

- Image, name, brand, model, and the specs table for its category (panel types show their help text).
- Under the specs, the **cheapest** offer and the **most trusted** offer (price and store for each), and an **"Explore prices in stores"** button.
- The button opens a dropdown list of stores. Each store shows its best price; the cheapest store is highlighted. Clicking the button again closes the list.
- **Inside each store** (expand the store row): the store's price range and up to two sellers: its **cheapest** seller and its **most trusted** seller, each with a badge. If one seller is both, it shows once with both badges.
- Each offer row: seller (and "official" badge), price, shipping, total, delivery days, in stock, "last updated", and three actions:
  - **"Go to store"**: a clear button with the store logo and name and an ↗ icon, opens the store page in a new tab. The part image itself links to the part page on our site, not to the store.
  - **"Add to build"**: adds the part to the current build with this offer, so it goes through the compatibility checks.
  - **"Add to shopping list"**: adds only this link to the shopping list, without a build.
- Sort offers by total price, delivery time or store trust score; the cheapest and the most trusted offers each get a badge.
- International stores (e.g. Newegg, AliExpress) show the customs/VAT note.
- A quick **"Add to build"** button outside the list adds the part with the cheapest offer.
- Adding to the build replaces the part in that category, except storage which can have several.
- The build and the shopping list are **separate**: the build is for a full PC with compatibility checks; the shopping list is any parts the user wants to buy, with or without a build.
- Later: price chart and the lowest and highest price in the last 30 days (Phase 5).

## Build

- **Interactive PC case** at the top: an SVG drawing of an open case in a 3D-looking (isometric) view, no libraries. A line comes out of each core part (CPU, motherboard, RAM, GPU, storage, PSU, case, cooler) and ends in a small circle. **Hovering** a circle (or focusing it with the keyboard) shows a small tooltip with the category name, e.g. "GPU / كرت الشاشة", and the chosen part if there is one, e.g. "GPU: RTX 4060 Dual". **Clicking** it opens the **part picker** for that category. On touch screens there is no hover, so a tap opens the picker directly. Circle color: grey = not chosen, green = chosen, red = has a compatibility error. Circles are real `<button>` elements with labels, so they work with the keyboard and screen readers.
- Under the drawing, the same parts as a list (always shown, and the main view on small phones). One row per category: core parts first (CPU, motherboard, RAM, GPU, storage, PSU, case, cooler), then peripherals.
- Each row: the chosen part with its best total price, or a "Choose" button that opens the part picker for that category; buttons to change or remove.
- **Part picker** (a dropdown panel next to the circle or row, without leaving the page; full width on phones):
  - A scrollable list of parts of that category only (e.g. all GPUs). Each item: image, name, brand and best total price.
  - A search box at the top to find a part by name, brand or model.
  - A price filter (min and max).
  - Shows **only parts compatible** with the parts already in the build (e.g. only AM5 motherboards after an AM5 CPU), with a "Show all" switch.
  - Clicking a part shows two buttons: **"Add to build"** (puts it in the build with its cheapest offer and closes the panel) and **"Add to shopping list"** (adds only this part to the shopping list, without changing the build). A small "Details" link opens its part page.
  - Closes with Escape, a close button, or a click outside; works with the keyboard.
- **Compatibility results** at the top: errors in red, warnings in yellow, each linked to the parts involved.
- Estimated power draw next to the PSU.
- Total price and build status: ready, or what is missing or not compatible.
- **Budget bar** when the build has a budget: spent and remaining, and a warning when the total goes over the budget.
- **"Share"** button: copies a link to the build. The link holds the chosen parts and offers (e.g. `build.html?parts=12:40,15:52`), so it works for guests too and opens a read-only copy that the visitor can save as their own.
- Save button: guests save in localStorage; signed-in users save to their account (name, budget, purpose).
- **"Add all to shopping list"** button: adds every part in the build, with its chosen offer, to the shopping list. Works for a full build or a partial one (only the parts chosen so far).

## Shopping list

- Everything the user added (single parts from the part page, or a whole build), grouped by store, each with the offer the user chose.
- Each part can switch to another store or seller from a dropdown.
- Each part: name, seller, price, shipping, quantity, a **"Go to store"** link, and a remove button.
- Guests keep the list in localStorage; signed-in users save it to their account (moved after sign-in, like builds).
- Per store: subtotal and delivery days.
- Grand total and the longest delivery time.
- No payment on the site; users buy from each store through the links.

## Sign up / Sign in

- Sign up: **username**, email, password (with password rules shown, e.g. at least 8 characters).
  - Username: unique, 3 to 20 characters, English letters, numbers and `_` only. It is the name shown on the site.
  - Email is still needed for password reset and price alert emails.
- Sign in: username **or** email, and password.
- Show/hide password button (eye icon) on every password field.
- Clear error messages: username already taken, email already used, and one message for a wrong sign-in ("wrong username/email or password"), without saying which part was wrong.
- After sign-in, a guest build and shopping list in localStorage move to the account.
- Later (Phase 6): "Forgot password" link that emails a reset link.

## My builds

- List of saved builds: name, purpose, total price, status (ready or not), last updated.
- Open a build (goes to Build), rename it, **duplicate it** (a copy to try other parts without changing the original), or delete it.
- Empty state with a link to Build.

## Admin

- **Dashboard**: number of parts, offers, stores and users, and offers not updated for a long time.
- **Parts**: add or edit a part (category, brand, name, model, image, and the specs fields for that category; the specs form changes with the category).
- **Offers**: add or edit an offer for a part (store, seller, official, rating, reviews, price, currency, shipping, delivery days, link, in stock).
  - If the seller is not official and is rated below 4.5 or has fewer than 100 reviews, the form shows a warning; the admin must tick "I checked this seller" to save.
- **Hide or delete** parts and offers:
  - **Hide** (the main option): the item disappears from the site but stays in the admin page and can be shown again. Saved builds and shopping lists keep it and show "no longer available".
  - **Delete** (permanent): asks for confirmation first. If the item is used in saved builds or shopping lists, the confirmation shows how many and suggests hiding instead. If the admin still deletes it: a deleted part is removed from those builds and lists; a deleted offer is replaced by the cheapest other offer for that part.
  - **Users are told**: each affected user gets a notification (e.g. "RTX 4060 ASUS Dual was removed from your build \"Gaming PC\" because it is no longer available"). It shows as a banner on Build or Shopping list until they close it.
  - Guests (build in localStorage): when the build loads and a part no longer exists, the page removes it and shows the same kind of banner.
- **Stores**: add or edit a store (name, website, ships from, delivery, warranty, returns, trust score).
- **Users**: list of users; give or remove admin access (an admin cannot remove their own).
- Later (Phase 5): "paste link" tool, "update now" button, and the list of broken links.

## Most trusted offer

Every offer on the site is already from a trusted seller (official, or rated 4.5+ with 100+ reviews). Among them, the "most trusted" offer is picked in this order:

1. Official sellers (sold by the store itself) come first.
2. Then the store with the higher `trust_score`.
3. Then the seller with the higher rating, then more reviews.
4. If still tied, the cheaper total price wins.

Only offers that are in stock and not hidden count, for both "cheapest" and "most trusted".
