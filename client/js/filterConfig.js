// The filters each category shows on the Parts page, besides brand, store and price
// (every category has those three). The key is a field of the category's specs
// (docs/categories.md); its label comes from the `specs` section of the locale files.
//
// type:
//   multi: pick one or more values (the values found in the parts of that category)
//   min:   a number, "at least" (e.g. RAM of 32 GB or more)
//   bool:  yes / no
// array: the spec is a list (e.g. supported sockets): a part matches when any chosen value is in it
// labelKey: a shorter label than the one in `specs` (which has examples for the admin form)
// normalize: 'cpu' ignores the brand word, so "AMD Ryzen 7 7800X3D" and "Ryzen 7 7800X3D" match

const multi = (key, extra = {}) => ({ key, type: 'multi', ...extra });
const min = (key) => ({ key, type: 'min' });
const bool = (key) => ({ key, type: 'bool' });

const CHIPSET = { labelKey: 'filters.chipset' };

export const SPEC_FILTERS = {
  cpu: [multi('socket'), min('cores'), bool('includes_cooler')],
  motherboard: [multi('socket'), multi('chipset', CHIPSET), multi('ram_type'), multi('form_factor'), bool('wifi')],
  ram: [multi('ram_type'), min('capacity_gb'), min('speed_mhz')],
  gpu: [multi('chip_brand'), multi('chipset', CHIPSET), min('vram_gb')],
  storage: [multi('type'), min('capacity_gb'), multi('form_factor')],
  psu: [min('wattage'), multi('rating'), multi('modular')],
  case: [multi('supported_form_factors', { array: true }), multi('side_panel')],
  cooler: [multi('type'), multi('supported_sockets', { array: true })],
  monitor: [multi('resolution'), multi('panel'), min('refresh_hz'), min('size_in')],
  mouse: [bool('wireless')],
  keyboard: [multi('layout'), multi('switch_type'), bool('wireless'), bool('arabic_letters')],
  headset: [bool('wireless'), multi('connection', { array: true }), bool('microphone')],
  prebuilt: [
    multi('cpu_name', { labelKey: 'filters.cpuName', normalize: 'cpu' }),
    multi('gpu_chipset'),
    min('ram_gb'),
    min('storage_gb'),
  ],
};
