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
| My list       | قائمتي                | `my-list.html`        | everyone |
| Sign up / in  | التسجيل / الدخول      | `signup.html`, `signin.html` | everyone |
| Admin         | لوحة الأدمن           | `admin.html`          | admins only |

Later: price alerts and notifications (Phase 6).

## On every page: navigation

Two parts: a **top bar** for the pages and search, and a **menu** (hamburger) that has the account and the same page links.

### Top bar (no account items)
- Logo (link to home), links to Parts, Build your PC and My list.
- **Search bar**: searches parts by name, brand or model and opens Parts with the results.
- Language switch (ar / en) and light/dark toggle, as small icon buttons.
- The hamburger button.
- On phones (375px) the page links are hidden from the bar (they are in the menu) and the search bar takes a full row under the logo, so nothing scrolls sideways.

### Menu (hamburger)
- **Account** at the top:
  - Guests: a **"تسجيل الدخول" / "Log in"** button, and Sign up under it.
  - Signed in: a **square profile picture** with the username next to it; admins get an **"أدمن" / "Admin"** badge beside the name. Under it: Admin (shown only to admins, with the offer alerts count), and Sign out.
  - Profile picture: for now a square with the first letter of the username (no upload). Uploading a real picture is a later task.
  - The Admin link and badge are only hidden for others; the admin page and its API are still protected on the server by `requireAdmin`.
- **Pages**: Home, Parts, Build your PC, My list (the same links as the bar).
- Opens as a side panel from the hamburger side (the inline end, so it flips between Arabic and English). Closes with the X button, the Escape key, or a click outside it.
- Accessible: a real `<button>` with `aria-expanded` and a label ("القائمة" / "Menu"); focus moves into the panel when it opens and back to the button when it closes.
- For admins with offer alerts, the hamburger button shows a small dot so the alert is seen without opening the menu.

## Home

- Short intro: what the site does (compare prices, build a PC).
- Two main buttons: "Compare prices" (Parts) and "Build your PC" (Build).
- Category shortcuts: one card per category (CPU, GPU, monitor, prebuilt PCs...) with a picture on top and the name under it; opens Parts filtered by that category. The pictures are line icons in `client/images/categories/<slug>.svg` (one file per category slug); a file can be replaced by a photo with the same name.
- **Most searched parts**: the parts people search for most. Needs search tracking (a count per part when it appears in search results or is opened), so it comes after the parts listing works.
- **Biggest price drops**: parts whose price fell the most recently. Needs `price_history`, so it comes in Phase 5.

## Parts

- Category tabs or select, filters for the chosen category (e.g. socket for CPUs, `chip_brand` and VRAM for GPUs, resolution and panel for monitors), and price range.
- Filters for every category: **brand** (ASUS, MSI, Gigabyte..., from the brands of the parts in that category) and **store** (show only parts with an offer in the chosen stores).
- **How the filters work**: a panel next to the results (a collapsible "Filters" box above them on phones). The API sends each part with its specs and the ids of the stores that have it in stock, and the page filters in the browser, so results change instantly. Options are the values found in the parts of the chosen category, so the list never offers something with no parts.
  - Every category: brand, store and price range (on the cheapest total).
  - By category (`client/js/filterConfig.js`): a pick-list for fields with fixed values (socket, chipset, RAM type, resolution, panel...), "at least" for numbers (cores, VRAM, RAM, capacity, refresh rate...), and yes/no for flags (Wi-Fi, wireless, microphone...). Prebuilt PCs: CPU, GPU chipset, RAM and storage. CPU names are compared ignoring case, spaces and the brand word.
  - A part that does not have a field cannot match a filter on it.
  - Changing the category clears the filters.
- Results as cards: image, name, brand, in how many stores it is available, and two prices:
  - **Cheapest**: the lowest total price (price + shipping) and its store.
  - **Most trusted**: the best offer from the most trusted seller (see "Most trusted offer" below) and its store. If it is also the cheapest, the card shows one price with both labels.
- **Filters from a link**: the page reads its filters from the address (`category`, `q`, and the category filters such as `cpu_name` and `gpu_chipset`), so a link from the Build suggestion opens the Prebuilt PCs list already filtered. The chosen filters are shown as small chips above the results (e.g. "Ryzen 7 7800X3D", "RTX 4060"), each with an X to remove it, and a "Clear all filters" button, so the user can widen the list if there is no match.
- Sort by lowest price, name, **newest** or **oldest** (by the date the part was added to our site, `products.created_at`).
- **Added** filter: any time (default), today, last 2 days, last 3 days.
- **"Added today" badge**: a small label at the top of the card ("أُضيف اليوم" / "Added today") on parts added to our site today. It shows on the day of adding only, by Saudi time (Asia/Riyadh), and also on the part page.
- Loading, empty ("no parts match") and error states.

## Part

- Image, name, brand, model, and the specs table for its category (panel types show their help text).
- Under the specs, the **cheapest** offer and the **most trusted** offer (price and store for each), and an **"Explore prices in stores"** button.
- The button opens a dropdown list of stores. Each store shows its best price; the cheapest store is highlighted. Clicking the button again closes the list.
- **Inside each store** (expand the store row): the store's price range and up to two sellers: its **cheapest** seller and its **most trusted** seller, each with a badge. If one seller is both, it shows once with both badges.
- Each offer row: seller (and "official" badge), price, shipping, total, delivery days, in stock, "last updated", and three actions:
  - **"Go to store"**: a clear button with the store logo and name and an ↗ icon, opens the store page in a new tab. The part image itself links to the part page on our site, not to the store.
  - **"Add to build"**: adds the part to the current build with this offer, so it goes through the compatibility checks.
  - **"Add to My list"** ("أضف لقائمتي"): adds only this link to My list, without a build.
- Sort offers by total price, delivery time or store trust score; the cheapest and the most trusted offers each get a badge.
- International stores (e.g. Newegg, AliExpress) show the customs/VAT note.
- A quick **"Add to build"** button outside the list adds the part with the cheapest offer.
- Adding to the build replaces the part in that category, except storage which can have several. Prebuilt PCs have no "Add to build" button (only My list).
- The build and My list are **separate**: the build is for a full PC with compatibility checks; My list is any parts the user wants to keep, with or without a build.
- Later: price chart and the lowest and highest price in the last 30 days (Phase 5).

## Build

- **Interactive PC case** at the top: an SVG drawing of an open case in a 3D-looking (isometric) view, no libraries. A line comes out of each core part (CPU, motherboard, RAM, GPU, storage, PSU, case, cooler) and ends in a small circle. **Hovering** a circle (or focusing it with the keyboard) shows a small tooltip with the category name, e.g. "GPU / كرت الشاشة", and the chosen part if there is one, e.g. "GPU: RTX 4060 Dual". **Clicking** it opens the **part picker** for that category. On touch screens there is no hover, so a tap opens the picker directly. Circle color: grey = not chosen, green = chosen, red = has a compatibility error. Circles are real `<button>` elements with labels, so they work with the keyboard and screen readers.
- Under the drawing, the same parts as a list (always shown, and the main view on small phones). One row per category: core parts first (CPU, motherboard, RAM, GPU, storage, PSU, case, cooler), then peripherals.
- Each row: the chosen part with its best total price, or a "Choose" button that opens the part picker for that category; buttons to change or remove.
- **Part picker** (a dropdown panel next to the circle or row, without leaving the page; full width on phones):
  - A scrollable list of parts of that category only (e.g. all GPUs). Each item: image, name, brand, and its cheapest and most trusted price.
  - A search box at the top to find a part by name, brand or model.
  - A price filter (min and max).
  - Shows **only parts compatible** with the parts already in the build (e.g. only AM5 motherboards after an AM5 CPU), with a "Show all" switch.
  - Clicking a part expands it **inside the same panel** to show its **prices in every store**: one row per store with its best total price (cheapest and most trusted badges), and the store's sellers when the row is opened.
  - The user picks the store and seller they want (the cheapest is selected by default), then: **"Add to build"** (puts the part in the build with that offer and closes the panel) or **"Add to My list"** (adds only this offer to My list, without changing the build). A small "Details" link opens its part page.
  - Closes with Escape, a close button, or a click outside; works with the keyboard.
- **Compatibility results** at the top: errors in red, warnings in yellow, each linked to the parts involved.
- Estimated power draw next to the PSU.
- **Live build total**: a bar that stays visible while scrolling (at the bottom on phones, beside the parts on wide screens) with the total price of the build (price + shipping of each chosen offer, in SAR), the number of parts, and the build status (ready, or what is missing or not compatible).
  - It updates **instantly** when a part is added, removed, or changed to another part or another store; the new total briefly highlights so the change is noticed.
  - The total is also announced to screen readers when it changes.
- **Ready-made PC suggestion**: when the build has a **CPU and a GPU**, a card under the compatibility results says a store sells a ready-made PC with the same CPU and GPU (e.g. "Amazon.sa sells a PC with the same Ryzen 7 7800X3D and RTX 4060 for 3,899 SAR"), so the user can compare it with building their own. Rules:
  - It looks in the `prebuilt` parts that have a visible offer in stock. A prebuilt matches when its `gpu_chipset` equals the build GPU's `chipset` **and** its `cpu_name` equals the build CPU's name (same text, ignoring case, spaces and the brand word "AMD" or "Intel").
  - If the build also has RAM or storage, the prebuilt must have at least as much (`ram_gb` and `storage_gb` are compared with the build's RAM total and storage total).
  - The card shows the **cheapest matching price** (price + shipping, in SAR) and its store, and how many matching PCs there are, e.g. "from 3,899 SAR at Amazon.sa, 3 PCs". When the whole build has a total, it also shows the difference: "X SAR cheaper than your build" or "X SAR more than your build".
  - **Clicking the card opens the Parts page on the Prebuilt PCs category, already filtered** by the build's CPU and GPU (e.g. `parts.html?category=prebuilt&cpu_name=Ryzen%207%207800X3D&gpu_chipset=RTX%204060`), not the store or one product. The user sees all the matching PCs and picks one, and an offer that was removed in the meantime does not lead to a dead page.
  - A note under it: the ready-made PC comes with its own case, power supply and motherboard, which can be different from the parts the user picked.
  - Nothing shows when no prebuilt matches. The card can be closed and stays closed until the build's CPU or GPU changes.
- **Budget bar** when the build has a budget: spent and remaining, and a warning when the total goes over the budget.
- **"Share"** button: copies a link to the build. The link holds the chosen parts and offers (e.g. `build.html?parts=12:40,15:52`), so it works for guests too and opens a read-only copy that the visitor can save as their own.
- **Builds bar** at the top of the page (there is no separate "My builds" page): one tab per build the user has, e.g. "Gaming PC", "Cheaper version".
  - The open tab is the **current build**; clicking another tab opens that build.
  - A **"+"** button starts a new, empty build in a new tab. The other builds stay as they are.
  - Each tab can be **renamed** (e.g. "Build 1" -> "Gaming PC"), **duplicated** (a copy in a new tab, to try other parts without changing the original) and **deleted**. A build is never removed by the site: it stays until the user deletes it, and deleting asks for confirmation first.
  - Every change is saved to the current build right away (no save button): guests in localStorage, signed-in users in their account (name, budget, purpose, parts). After sign-in, a guest's builds move to the account.
  - Each tab shows a small status dot: green when the build is ready, red when it has a compatibility error.
- **"Add all to My list"** button: adds every part in the build, with its chosen offer, to My list. Works for a full build or a partial one (only the parts chosen so far).

## My list

- Everything the user added (single parts from the part page, or a whole build), grouped by store, each with the offer the user chose.
- Each part can switch to another store or seller from a dropdown.
- Each part: name, seller, price, shipping, quantity, a **"Go to store"** link, and a remove button.
- Guests keep the list in localStorage; signed-in users save it to their account (moved after sign-in, like builds).
- Per store: subtotal and delivery days.
- Grand total and the longest delivery time.
- The site sells nothing: each part only links to its store.

## Sign up / Sign in

- Sign up: **username**, email, password (with password rules shown, e.g. at least 8 characters).
  - Username: unique, 2 to 20 characters, English letters, numbers and `_` only. It is the name shown on the site.
  - Email is still needed for password reset and price alert emails.
- Sign in: username **or** email, and password.
- Show/hide password button (eye icon) on every password field.
- Clear error messages: username already taken, email already used, and one message for a wrong sign-in ("wrong username/email or password"), without saying which part was wrong.
- After sign-in, a guest build and My list in localStorage move to the account.
- Later (Phase 6): "Forgot password" link that emails a reset link.

## Admin

- **Dashboard**: number of parts, offers, stores and users, and offers not updated for a long time.
- **Offer alerts** (Phase 5): a list at the top of the admin page, with a count badge on the Admin link in the menu, of offers that need a look:
  - **Old**: the offer was not checked successfully for more than 7 days.
  - **Changed**: the last check found a different product name, or the item became out of stock.
  - **Hidden automatically**: the check failed 3 times in a row (broken link or product removed), so the offer was hidden from users.
  - Each alert has: open the link, "still correct" (clears the alert), edit, show again, or delete. Offers are hidden automatically, never deleted, so builds and lists keep working (see Hide or delete below).
- Tabs: **Parts** (add or edit manually) and **Offers**. Parts can also be added in bulk through `seed.sql` from maker links (see CLAUDE.md).
- **Parts**: add or edit a part (category, brand, name, model, image, and the specs fields for that category; the specs form changes with the category).
- **Offers**: add or edit an offer for a part (store, seller, official, rating, reviews, price, currency, shipping, delivery days, link, in stock).
  - If the seller is not official and is rated below 4.5 or has fewer than 100 reviews, the form shows a warning; the admin must tick "I checked this seller" to save.
- **Hide or delete** parts and offers:
  - **Hide** (the main option): the item disappears from the site but stays in the admin page and can be shown again. Saved builds and lists keep it and show "no longer available".
  - **Delete** (permanent): asks for confirmation first. If the item is used in saved builds or lists, the confirmation shows how many and suggests hiding instead. If the admin still deletes it: a deleted part is removed from those builds and lists; a deleted offer is replaced by the cheapest other offer for that part.
  - **Users are told**: each affected user gets a notification (e.g. "RTX 4060 ASUS Dual was removed from your build \"Gaming PC\" because it is no longer available"). It shows as a banner on Build or My list until they close it.
  - Guests (build in localStorage): when the build loads and a part no longer exists, the page removes it and shows the same kind of banner.
- **Stores**: add or edit a store (name, website, ships from, delivery, warranty, returns, trust score).
- **Users**: list of users; give or remove admin access (an admin cannot remove their own).
- Later (Phase 5): "paste link" tool, "update now" button, and the offer alerts above.
- **Offer checks** (Phase 5): every 3 days a job opens each offer link and reads the price and stock from the page (JSON-LD, free, no AI). A new price updates the offer (normal, no alert); the cases above create alerts.

## Most trusted offer

Every offer on the site is already from a trusted seller (official, or rated 4.5+ with 100+ reviews). Among them, the "most trusted" offer is picked in this order:

1. Official sellers (sold by the store itself) come first.
2. Then the store with the higher `trust_score`.
3. Then the seller with the higher rating, then more reviews.
4. If still tied, the cheaper total price wins.

Only offers that are in stock and not hidden count, for both "cheapest" and "most trusted".
