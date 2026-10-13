# Categories and `specs` fields

This file defines every product category and the fields stored in `products.specs` (JSONB) for each one.
The schema, seed data, filters and compatibility checks all follow these definitions.

## Categories

| slug          | name_en     | name_ar        | kind         |
|---------------|-------------|----------------|--------------|
| `cpu`         | CPU         | المعالج        | `core`       |
| `motherboard` | Motherboard | اللوحة الأم    | `core`       |
| `ram`         | RAM         | الذاكرة        | `core`       |
| `gpu`         | GPU         | كرت الشاشة     | `core`       |
| `storage`     | Storage     | التخزين        | `core`       |
| `psu`         | Power Supply| مزود الطاقة    | `core`       |
| `case`        | Case        | الكيس          | `core`       |
| `cooler`      | CPU Cooler  | مبرد المعالج   | `core`       |
| `monitor`     | Monitor     | الشاشة         | `peripheral` |
| `mouse`       | Mouse       | الماوس         | `peripheral` |
| `keyboard`    | Keyboard    | لوحة المفاتيح  | `peripheral` |
| `headset`     | Headset     | السماعة        | `peripheral` |
| `prebuilt`    | Prebuilt PC | جهاز جاهز      | `prebuilt`   |

A build needs one of each core part, except storage (one or more) and the cooler (optional, because some CPUs come with one).
Peripherals are all optional.
Prebuilt PCs are not part of a build: they are listed and compared like any part, but the Build your PC page does not show them.

## Rules for `specs`

- Field names are `snake_case` English. Units go in the name (`_w`, `_mm`, `_gb`, `_mhz`, `_hz`, `_in`, `_g`), so values are plain numbers.
- Fields with a fixed set of values use the exact strings listed below. This keeps filters and compatibility checks simple string comparisons.
- **Required** fields must be present on every product in that category, because a compatibility rule or a main filter uses them. Optional fields can be left out.
- Brand, name, model and image are columns on `products`, not part of `specs`.

### Shared value lists

| list           | values |
|----------------|--------|
| socket         | `AM4`, `AM5`, `LGA1700`, `LGA1851` |
| ram_type       | `DDR4`, `DDR5` |
| form_factor    | `ATX`, `mATX`, `ITX` (motherboards and cases) |
| video port     | `HDMI 2.0`, `HDMI 2.1`, `DP`, `USB-C` (GPU outputs and monitor inputs) |

HDMI keeps its version because it matters (for example, 4K at 120Hz or more needs HDMI 2.1). DisplayPort is stored without a version (`DP`, not `DP 1.4a`) because the difference rarely matters in practice.

## Core parts

### `cpu`
| field            | type    | required | example | notes |
|------------------|---------|----------|---------|-------|
| `socket`         | string  | yes      | `"AM5"` | must match the motherboard |
| `cores`          | integer | yes      | `6`     | |
| `threads`        | integer | no       | `12`    | |
| `base_clock_ghz` | number  | no       | `4.7`   | |
| `boost_clock_ghz`| number  | no       | `5.3`   | |
| `tdp_w`          | integer | yes      | `65`    | used in the power estimate |
| `includes_cooler`| boolean | yes      | `false` | if false, the build needs a cooler |

### `motherboard`
| field         | type    | required | example  | notes |
|---------------|---------|----------|----------|-------|
| `socket`      | string  | yes      | `"AM5"`  | |
| `chipset`     | string  | no       | `"B650"` | one of the chipsets listed for its `socket` in `server/src/config/specFields.js` |
| `ram_type`    | string  | yes      | `"DDR5"` | must match the RAM |
| `form_factor` | string  | yes      | `"ATX"`  | must be supported by the case |
| `ram_slots`   | integer | yes      | `4`      | RAM modules must fit |
| `max_ram_gb`  | integer | no       | `192`    | |
| `m2_slots`    | integer | no       | `2`      | |
| `wifi`        | boolean | no       | `true`   | |

### `ram`
| field         | type    | required | example  | notes |
|---------------|---------|----------|----------|-------|
| `ram_type`    | string  | yes      | `"DDR5"` | |
| `capacity_gb` | integer | yes      | `32`     | total for the kit |
| `speed_mhz`   | integer | yes      | `6000`   | |
| `modules`     | integer | yes      | `2`      | sticks in the kit |
| `cas_latency` | integer | no       | `30`     | |

### `gpu`
| field                | type     | required | example            | notes |
|----------------------|----------|----------|--------------------|-------|
| `chip_brand`         | string   | yes      | `"NVIDIA"`         | `NVIDIA`, `AMD`; main filter. The card maker (ASUS, MSI, Gigabyte...) is the `brand` column |
| `chipset`            | string   | yes      | `"RTX 4060"`       | |
| `vram_gb`            | integer  | yes      | `8`                | |
| `tdp_w`              | integer  | yes      | `115`              | used in the power estimate |
| `length_mm`          | integer  | yes      | `240`              | must fit the case |
| `slots`              | number   | no       | `2.5`              | card thickness in expansion slots; must fit the case |
| `outputs`            | string[] | yes      | `["HDMI 2.1", "DP"]`| video port list |
| `perf_1080p`         | string   | yes      | `"excellent"`      | performance in demanding games at Full HD; see levels below |
| `perf_1440p`         | string   | yes      | `"good"`           | at 2K (1440p) |
| `perf_4k`            | string   | yes      | `"weak"`           | at 4K; the three levels are set by the admin and used for the monitor warning |
| `recommended_psu_w`  | integer  | no       | `550`              | |

`chipset` must be one of the models listed for its `chip_brand` in `server/src/config/specFields.js` (e.g. `RTX 4070 SUPER` for NVIDIA, `RX 9070 XT` for AMD). New models are added to that list when they come out.

Performance levels, from lowest to highest (shown on the site as words, e.g. ضعيف / مقبول / جيد / ممتاز):

| value       | meaning in demanding games |
|-------------|----------------------------|
| `weak`      | struggles even on low settings |
| `ok`        | playable, around 60 FPS on medium settings |
| `good`      | around 60 FPS or more on high settings |
| `excellent` | high frame rates (100+ FPS) on high settings |

### `storage`
| field         | type    | required | example   | notes |
|---------------|---------|----------|-----------|-------|
| `type`        | string  | yes      | `"nvme"`  | `nvme`, `sata_ssd`, `hdd` |
| `capacity_gb` | integer | yes      | `1000`    | |
| `form_factor` | string  | yes      | `"M.2"`   | `M.2`, `2.5in`, `3.5in` |
| `read_mb_s`   | integer | no       | `7000`    | |
| `write_mb_s`  | integer | no       | `5000`    | |

### `psu`
| field         | type    | required | example       | notes |
|---------------|---------|----------|---------------|-------|
| `wattage`     | integer | yes      | `650`         | compared with the power estimate |
| `rating`      | string  | yes      | `"80+ Gold"`  | `80+`, `80+ Bronze`, `80+ Gold`, `80+ Platinum`, `80+ Titanium` |
| `modular`     | string  | no       | `"full"`      | `full`, `semi`, `none` |
| `form_factor` | string  | no       | `"ATX"`       | `ATX`, `SFX` |

### `case`
| field                    | type     | required | example                   | notes |
|--------------------------|----------|----------|---------------------------|-------|
| `supported_form_factors` | string[] | yes      | `["ATX", "mATX", "ITX"]`  | |
| `max_gpu_length_mm`      | integer  | yes      | `330`                     | the GPU `length_mm` must be less than or equal to this |
| `max_gpu_slots`          | number   | no       | `2`                       | the GPU `slots` must be less than or equal to this; check only when both are set |
| `max_cooler_height_mm`   | integer  | no       | `165`                     | the cooler `height_mm` must be less than or equal to this; check only when both are set |
| `side_panel`             | string   | no       | `"glass"`                 | `glass`, `solid`, `mesh` |
| `color`                  | string   | no       | `"black"`                 | |

### `cooler`
| field               | type     | required | example              | notes |
|---------------------|----------|----------|----------------------|-------|
| `type`              | string   | yes      | `"air"`              | `air`, `aio` |
| `supported_sockets` | string[] | yes      | `["AM5", "LGA1700"]` | must include the CPU socket |
| `height_mm`         | integer  | no       | `155`                | air coolers; must fit the case |
| `radiator_mm`       | integer  | no       | `240`                | AIO only: `120`, `240`, `280`, `360` |

## Peripherals

### `monitor`
| field         | type     | required | example         | notes |
|---------------|----------|----------|-----------------|-------|
| `size_in`     | number   | yes      | `27`            | |
| `resolution`  | string   | yes      | `"2560x1440"`   | `1920x1080`, `2560x1440`, `3440x1440`, `3840x2160` |
| `refresh_hz`  | integer  | yes      | `165`           | |
| `panel`       | string   | yes      | `"IPS"`         | `IPS`, `VA`, `TN`, `OLED` |
| `inputs`      | string[] | yes      | `["HDMI 2.1", "DP"]`| video port list |
| `response_ms` | number   | no       | `1`             | |

The monitor maker (Samsung, LG, ASUS...) is the `brand` column.

Panel types, shown as help text next to the panel filter and on the part page:

| value  | description_en | description_ar |
|--------|----------------|----------------|
| `IPS`  | Accurate colors and wide viewing angles. A good all-round choice. | ألوان دقيقة وزوايا رؤية واسعة. خيار متوازن لأغلب الاستخدامات. |
| `VA`   | Deep blacks and high contrast, good for movies. Can show slight blur in fast motion. | أسود عميق وتباين عالي، ممتازة للأفلام. ممكن يظهر تشويش بسيط في الحركة السريعة. |
| `TN`   | Fastest response and lowest price, but weaker colors and narrow viewing angles. | أسرع استجابة وأرخص سعر، لكن ألوانها أضعف وزوايا الرؤية ضيقة. |
| `OLED` | Each pixel makes its own light: perfect blacks, very fast response, best image. Highest price. | كل بكسل يضيء بنفسه: أسود مثالي واستجابة سريعة جداً وأفضل صورة. أغلى نوع. |

### `mouse`
| field      | type    | required | example | notes |
|------------|---------|----------|---------|-------|
| `wireless` | boolean | yes      | `true`  | |
| `weight_g` | integer | no       | `60`    | |
| `dpi`      | integer | no       | `26000` | max DPI |

### `keyboard`
| field            | type    | required | example    | notes |
|------------------|---------|----------|------------|-------|
| `layout`         | string  | yes      | `"75%"`    | `full`, `TKL`, `75%`, `65%`, `60%` |
| `switch_type`    | string  | yes      | `"linear"` | `linear`, `tactile`, `clicky`, `membrane` |
| `wireless`       | boolean | yes      | `false`    | |
| `arabic_letters` | boolean | yes      | `true`     | Arabic letters printed on the keys |

### `headset`
| field        | type     | required | example                 | notes |
|--------------|----------|----------|-------------------------|-------|
| `wireless`   | boolean  | yes      | `true`                  | |
| `connection` | string[] | yes      | `["USB", "Bluetooth"]`  | `USB`, `3.5mm`, `Bluetooth` |
| `microphone` | boolean  | yes      | `true`                  | |
| `surround`   | boolean  | no       | `false`                 | |

## Prebuilt PCs

### `prebuilt`
A ready-made PC sold by a store. Only the main parts are stored, by name, without their details (no compatibility rules use them).

| field          | type    | required | example              | notes |
|----------------|---------|----------|----------------------|-------|
| `cpu_name`     | string  | yes      | `"Ryzen 7 7800X3D"`  | write it exactly like the CPU part's name in our catalog (e.g. `Ryzen 7 7800X3D`), because the Build page uses it to suggest this PC when a user picks the same CPU |
| `gpu_brand`    | string  | yes      | `"NVIDIA"`           | `NVIDIA`, `AMD` |
| `gpu_chipset`  | string  | yes      | `"RTX 4060"`         | same list as the GPU `chipset` for that brand |
| `ram_gb`       | integer | yes      | `32`                 | total |
| `ram_type`     | string  | no       | `"DDR5"`             | |
| `storage_gb`   | integer | yes      | `1000`               | total |
| `storage_type` | string  | no       | `"nvme"`             | `nvme`, `sata_ssd`, `hdd` |
| `psu_w`        | integer | no       | `650`                | |
| `wifi`         | boolean | no       | `true`               | |

`brand` is the PC maker (e.g. MSI) or the store's own PC line.
