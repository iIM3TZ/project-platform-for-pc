// The specs fields of every category (docs/categories.md).
// The server validates products with this list, and the admin form is built from it.
//
// type: 'string' | 'integer' | 'number' | 'boolean' | 'string[]'
// options: the only allowed values (for strings, string lists and some integers)
// optionsBy + optionGroups: the allowed values depend on another field, e.g. the GPU chipsets
//   depend on chip_brand. Add new models to these lists when they come out.
// translateOptions: the form shows the options as words (e.g. "excellent" -> "ممتاز")
// min / max: allowed range for numbers

const SOCKETS = ['AM4', 'AM5', 'LGA1700', 'LGA1851'];
const RAM_TYPES = ['DDR4', 'DDR5'];
const FORM_FACTORS = ['ATX', 'mATX', 'ITX'];
const VIDEO_PORTS = ['HDMI 2.0', 'HDMI 2.1', 'DP', 'USB-C'];

// How well a GPU runs demanding games at one resolution (docs/categories.md)
const PERFORMANCE_LEVELS = ['weak', 'ok', 'good', 'excellent'];

const GPU_CHIPSETS = {
  NVIDIA: [
    'RTX 3050', 'RTX 3060', 'RTX 3060 Ti', 'RTX 3070', 'RTX 3080',
    'RTX 4060', 'RTX 4060 Ti', 'RTX 4070', 'RTX 4070 SUPER', 'RTX 4070 Ti', 'RTX 4070 Ti SUPER',
    'RTX 4080', 'RTX 4080 SUPER', 'RTX 4090',
    'RTX 5050', 'RTX 5060', 'RTX 5060 Ti', 'RTX 5070', 'RTX 5070 Ti', 'RTX 5080', 'RTX 5090',
  ],
  AMD: [
    'RX 6600', 'RX 6650 XT', 'RX 6700 XT', 'RX 6750 XT', 'RX 6800', 'RX 6800 XT',
    'RX 7600', 'RX 7600 XT', 'RX 7700 XT', 'RX 7800 XT', 'RX 7900 GRE', 'RX 7900 XT', 'RX 7900 XTX',
    'RX 9060 XT', 'RX 9070', 'RX 9070 XT',
  ],
};

const MOTHERBOARD_CHIPSETS = {
  AM4: ['A520', 'B450', 'B550', 'X570'],
  AM5: ['A620', 'B650', 'B650E', 'X670', 'X670E', 'B850', 'X870', 'X870E'],
  LGA1700: ['H610', 'B660', 'H670', 'Z690', 'B760', 'Z790'],
  LGA1851: ['H810', 'B860', 'Z890'],
};

const SPEC_FIELDS = {
  cpu: [
    { key: 'socket', type: 'string', required: true, options: SOCKETS },
    { key: 'cores', type: 'integer', required: true, min: 1 },
    { key: 'threads', type: 'integer', required: false, min: 1 },
    { key: 'base_clock_ghz', type: 'number', required: false, min: 0 },
    { key: 'boost_clock_ghz', type: 'number', required: false, min: 0 },
    { key: 'tdp_w', type: 'integer', required: true, min: 1 },
    { key: 'includes_cooler', type: 'boolean', required: true },
  ],
  motherboard: [
    { key: 'socket', type: 'string', required: true, options: SOCKETS },
    { key: 'chipset', type: 'string', required: false, optionsBy: 'socket', optionGroups: MOTHERBOARD_CHIPSETS },
    { key: 'ram_type', type: 'string', required: true, options: RAM_TYPES },
    { key: 'form_factor', type: 'string', required: true, options: FORM_FACTORS },
    { key: 'ram_slots', type: 'integer', required: true, min: 1 },
    { key: 'max_ram_gb', type: 'integer', required: false, min: 1 },
    { key: 'm2_slots', type: 'integer', required: false, min: 0 },
    { key: 'wifi', type: 'boolean', required: false },
  ],
  ram: [
    { key: 'ram_type', type: 'string', required: true, options: RAM_TYPES },
    { key: 'capacity_gb', type: 'integer', required: true, min: 1 },
    { key: 'speed_mhz', type: 'integer', required: true, min: 1 },
    { key: 'modules', type: 'integer', required: true, min: 1 },
    { key: 'cas_latency', type: 'integer', required: false, min: 1 },
  ],
  gpu: [
    { key: 'chip_brand', type: 'string', required: true, options: ['NVIDIA', 'AMD'] },
    { key: 'chipset', type: 'string', required: true, optionsBy: 'chip_brand', optionGroups: GPU_CHIPSETS },
    { key: 'vram_gb', type: 'integer', required: true, min: 1 },
    { key: 'tdp_w', type: 'integer', required: true, min: 1 },
    { key: 'length_mm', type: 'integer', required: true, min: 1 },
    { key: 'slots', type: 'number', required: false, min: 1 },
    { key: 'outputs', type: 'string[]', required: true, options: VIDEO_PORTS },
    { key: 'perf_1080p', type: 'string', required: true, options: PERFORMANCE_LEVELS, translateOptions: true },
    { key: 'perf_1440p', type: 'string', required: true, options: PERFORMANCE_LEVELS, translateOptions: true },
    { key: 'perf_4k', type: 'string', required: true, options: PERFORMANCE_LEVELS, translateOptions: true },
    { key: 'recommended_psu_w', type: 'integer', required: false, min: 1 },
  ],
  storage: [
    { key: 'type', type: 'string', required: true, options: ['nvme', 'sata_ssd', 'hdd'] },
    { key: 'capacity_gb', type: 'integer', required: true, min: 1 },
    { key: 'form_factor', type: 'string', required: true, options: ['M.2', '2.5in', '3.5in'] },
    { key: 'read_mb_s', type: 'integer', required: false, min: 1 },
    { key: 'write_mb_s', type: 'integer', required: false, min: 1 },
  ],
  psu: [
    { key: 'wattage', type: 'integer', required: true, min: 1 },
    { key: 'rating', type: 'string', required: true, options: ['80+', '80+ Bronze', '80+ Gold', '80+ Platinum', '80+ Titanium'] },
    { key: 'modular', type: 'string', required: false, options: ['full', 'semi', 'none'] },
    { key: 'form_factor', type: 'string', required: false, options: ['ATX', 'SFX'] },
  ],
  case: [
    { key: 'supported_form_factors', type: 'string[]', required: true, options: FORM_FACTORS },
    { key: 'max_gpu_length_mm', type: 'integer', required: true, min: 1 },
    { key: 'max_gpu_slots', type: 'number', required: false, min: 1 },
    { key: 'max_cooler_height_mm', type: 'integer', required: false, min: 1 },
    { key: 'side_panel', type: 'string', required: false, options: ['glass', 'solid', 'mesh'] },
    { key: 'color', type: 'string', required: false },
  ],
  cooler: [
    { key: 'type', type: 'string', required: true, options: ['air', 'aio'] },
    { key: 'supported_sockets', type: 'string[]', required: true, options: SOCKETS },
    { key: 'height_mm', type: 'integer', required: false, min: 1 },
    { key: 'radiator_mm', type: 'integer', required: false, options: [120, 240, 280, 360] },
  ],
  monitor: [
    { key: 'size_in', type: 'number', required: true, min: 1 },
    { key: 'resolution', type: 'string', required: true, options: ['1920x1080', '2560x1440', '3440x1440', '3840x2160'] },
    { key: 'refresh_hz', type: 'integer', required: true, min: 1 },
    { key: 'panel', type: 'string', required: true, options: ['IPS', 'VA', 'TN', 'OLED'] },
    { key: 'inputs', type: 'string[]', required: true, options: VIDEO_PORTS },
    { key: 'response_ms', type: 'number', required: false, min: 0 },
  ],
  mouse: [
    { key: 'wireless', type: 'boolean', required: true },
    { key: 'weight_g', type: 'integer', required: false, min: 1 },
    { key: 'dpi', type: 'integer', required: false, min: 1 },
  ],
  keyboard: [
    { key: 'layout', type: 'string', required: true, options: ['full', 'TKL', '75%', '65%', '60%'] },
    { key: 'switch_type', type: 'string', required: true, options: ['linear', 'tactile', 'clicky', 'membrane'] },
    { key: 'wireless', type: 'boolean', required: true },
    { key: 'arabic_letters', type: 'boolean', required: true },
  ],
  headset: [
    { key: 'wireless', type: 'boolean', required: true },
    { key: 'connection', type: 'string[]', required: true, options: ['USB', '3.5mm', 'Bluetooth'] },
    { key: 'microphone', type: 'boolean', required: true },
    { key: 'surround', type: 'boolean', required: false },
  ],
  // A ready-made PC sold by a store: only the main parts, by name, without their details
  prebuilt: [
    { key: 'cpu_name', type: 'string', required: true },
    { key: 'gpu_brand', type: 'string', required: true, options: ['NVIDIA', 'AMD'] },
    { key: 'gpu_chipset', type: 'string', required: true, optionsBy: 'gpu_brand', optionGroups: GPU_CHIPSETS },
    { key: 'ram_gb', type: 'integer', required: true, min: 1 },
    { key: 'ram_type', type: 'string', required: false, options: RAM_TYPES },
    { key: 'storage_gb', type: 'integer', required: true, min: 1 },
    { key: 'storage_type', type: 'string', required: false, options: ['nvme', 'sata_ssd', 'hdd'] },
    { key: 'psu_w', type: 'integer', required: false, min: 1 },
    { key: 'wifi', type: 'boolean', required: false },
  ],
};

module.exports = { SPEC_FIELDS, PERFORMANCE_LEVELS };
