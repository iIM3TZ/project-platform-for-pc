# Compatibility rules

This file lists every check that `server/src/services/compatibility.js` runs on a build.
Field names come from [categories.md](categories.md).

## How the rules run

- The service takes the parts chosen so far and returns a list of results. An empty list means no problems.
- Each result is `{ level: "error" | "warning", message_ar: "...", message_en: "...", parts: [ids] }`. `parts` holds the product ids involved, so the page can mark them.
- A rule runs only when all the parts it compares are chosen. Example: the socket rule is skipped until both a CPU and a motherboard are picked.
- If an optional field is missing on either part, the rule is skipped (no error, no warning).
- **error**: the parts cannot work together. The build can still be saved as a draft, but it is not marked as ready.
- **warning**: the build works, but something is worth knowing. Never blocks anything.
- Messages use placeholders in `{braces}`, filled with values from the parts.

## Core parts (errors)

### 1. CPU and motherboard socket
- **Check**: `cpu.socket` equals `motherboard.socket`.
- **ar**: المعالج ({cpu_socket}) لا يركب على اللوحة الأم ({motherboard_socket}).
- **en**: The CPU ({cpu_socket}) does not fit the motherboard socket ({motherboard_socket}).

### 2. RAM type
- **Check**: `ram.ram_type` equals `motherboard.ram_type`.
- **ar**: الذاكرة من نوع {ram_type} واللوحة الأم تدعم {motherboard_ram_type} فقط.
- **en**: The RAM is {ram_type}, but the motherboard only supports {motherboard_ram_type}.

### 3. RAM modules and slots
- **Check**: `ram.modules` × quantity is less than or equal to `motherboard.ram_slots`.
- **ar**: عدد شرائح الذاكرة ({modules}) أكثر من منافذ اللوحة الأم ({ram_slots}).
- **en**: The RAM has {modules} sticks, but the motherboard has only {ram_slots} slots.

### 4. Maximum RAM
- **Check**: `ram.capacity_gb` × quantity is less than or equal to `motherboard.max_ram_gb` (optional field).
- **ar**: حجم الذاكرة ({capacity_gb} جيجا) أكبر من أقصى حجم تدعمه اللوحة الأم ({max_ram_gb} جيجا).
- **en**: The RAM ({capacity_gb} GB) is more than the motherboard supports ({max_ram_gb} GB).

### 5. M.2 drives and slots
- **Check**: the number of storage drives with `form_factor = "M.2"` is less than or equal to `motherboard.m2_slots` (optional field).
- **ar**: عدد أقراص M.2 ({m2_count}) أكثر من منافذ M.2 في اللوحة الأم ({m2_slots}).
- **en**: You picked {m2_count} M.2 drives, but the motherboard has only {m2_slots} M.2 slots.

### 6. Motherboard size and case
- **Check**: `case.supported_form_factors` includes `motherboard.form_factor`.
- **ar**: اللوحة الأم بحجم {form_factor} لا تركب في هذا الكيس.
- **en**: The {form_factor} motherboard does not fit this case.

### 7. GPU length
- **Check**: `gpu.length_mm` is less than or equal to `case.max_gpu_length_mm`.
- **ar**: كرت الشاشة أطول ({length_mm} ملم) من أقصى طول يدعمه الكيس ({max_gpu_length_mm} ملم).
- **en**: The GPU ({length_mm} mm) is longer than the case allows ({max_gpu_length_mm} mm).

### 8. GPU thickness
- **Check**: `gpu.slots` is less than or equal to `case.max_gpu_slots` (both optional).
- **ar**: كرت الشاشة أسمك ({slots} فتحات) من المساحة المتوفرة في الكيس ({max_gpu_slots} فتحات).
- **en**: The GPU is {slots} slots thick, but the case only has room for {max_gpu_slots}.

### 9. Cooler needed
- **Check**: if `cpu.includes_cooler` is `false`, the build has a cooler.
- Runs as soon as a CPU is chosen, so the user knows early that a cooler is needed.
- **ar**: هذا المعالج لا يأتي مع مبرد، أضف مبرد معالج.
- **en**: This CPU does not come with a cooler. Add a CPU cooler.

### 10. Cooler socket
- **Check**: `cooler.supported_sockets` includes `cpu.socket`.
- **ar**: المبرد لا يدعم مقبس المعالج ({cpu_socket}).
- **en**: The cooler does not support the CPU socket ({cpu_socket}).

### 11. Cooler height
- **Check**: only for `cooler.type = "air"`: `cooler.height_mm` is less than or equal to `case.max_cooler_height_mm` (both optional).
- **ar**: المبرد أطول ({height_mm} ملم) من أقصى ارتفاع يدعمه الكيس ({max_cooler_height_mm} ملم).
- **en**: The cooler ({height_mm} mm) is taller than the case allows ({max_cooler_height_mm} mm).

### 12. Power supply
- **Estimate**: `cpu.tdp_w` + `gpu.tdp_w` + 100 W for the rest of the parts (motherboard, RAM, storage, fans).
- **Needs**: a CPU, a GPU and a PSU.
- **error** when `psu.wattage` is less than the estimate:
  - **ar**: مزود الطاقة ({wattage} واط) أقل من الاستهلاك المتوقع ({estimate} واط).
  - **en**: The power supply ({wattage} W) is below the estimated power draw ({estimate} W).
- **warning** when `psu.wattage` is at least the estimate but less than estimate × 1.2 (20% headroom):
  - **ar**: مزود الطاقة يكفي بالكاد. ننصح بقدرة {recommended} واط أو أكثر.
  - **en**: The power supply is barely enough. We recommend {recommended} W or more.
- **warning** when `gpu.recommended_psu_w` is set and `psu.wattage` is below it:
  - **ar**: الشركة المصنعة لكرت الشاشة تنصح بمزود طاقة {recommended_psu_w} واط على الأقل.
  - **en**: The GPU maker recommends at least a {recommended_psu_w} W power supply.
- `{recommended}` is estimate × 1.2, rounded up to the next 50 W.

## Peripherals (warnings)

### 13. Monitor and GPU power
The GPU has a performance level for each resolution (`perf_1080p`, `perf_1440p`, `perf_4k`; levels in order: `weak`, `ok`, `good`, `excellent`). The rule reads the level for the monitor's resolution and compares it with the level the monitor needs:

| monitor resolution | GPU field read | below 120 Hz needs | 120 Hz or more needs |
|--------------------|----------------|--------------------|----------------------|
| `1920x1080`        | `perf_1080p`   | `good`             | `excellent`          |
| `2560x1440`        | `perf_1440p`   | `good`             | `excellent`          |
| `3440x1440`        | `perf_1440p`   | `excellent`        | `excellent`          |
| `3840x2160`        | `perf_4k`      | `good`             | `excellent`          |

Ultrawide (`3440x1440`) has about a third more pixels than 2K, so it needs the top level even below 120 Hz.

- **Check**: the GPU level is at least the level the monitor needs.
- **ar**: كرت الشاشة قد لا يستغل الشاشة بالكامل ({resolution} بتردد {refresh_hz} هرتز) في الألعاب الثقيلة.
- **en**: The GPU may not get the most out of this monitor ({resolution} at {refresh_hz} Hz) in demanding games.

### 14. Monitor and GPU ports
Ports connect when they share a type: `DP` with `DP`, `USB-C` with `USB-C`, and any HDMI with any HDMI (HDMI 2.1 works with HDMI 2.0 at the lower speed).

- **Check A**: at least one `monitor.inputs` port connects to a `gpu.outputs` port.
  - **ar**: لا يوجد منفذ مشترك بين كرت الشاشة والشاشة، ستحتاج محول.
  - **en**: The GPU and the monitor have no matching port. You will need an adapter.
- **Check B**: for 4K at 120 Hz or more, the shared ports must include `DP`, or `HDMI 2.1` on both sides.
  - **ar**: للحصول على {refresh_hz} هرتز بدقة 4K تحتاج منفذ DP أو HDMI 2.1 في الكرت والشاشة.
  - **en**: To get {refresh_hz} Hz at 4K you need DP, or HDMI 2.1 on both the GPU and the monitor.

Mouse, keyboard and headset have no compatibility rules.

## Not checked (for now)

- AIO radiator size against the case (the case has no radiator field yet).
- PSU size (`ATX` / `SFX`) against the case.
- Number of SATA ports on the motherboard.
- CPU support on older motherboard chipsets (BIOS updates).
