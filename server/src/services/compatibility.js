// Compatibility checks for a build (docs/compatibility.md): rules 1 to 12 for the core parts
// (errors and warnings), rules 13 and 14 for the monitor against the GPU (warnings only).
//
// Input: the parts of the build, each { id, category, specs }. Storage can have several parts.
// Output of checkBuild():
//   {
//     status: 'compatible' | 'warnings' | 'incompatible',
//     estimate_w: 300,        // estimated power draw, or null without a CPU or a GPU
//     results: [{ rule, level: 'error' | 'warning', message_ar, message_en, parts: [ids] }],
//     parts: { [id]: 'ok' | 'warning' | 'error' }
//   }
//
// A rule runs only when all the parts it compares are chosen, and is skipped when an optional
// field is missing on one of them (no error, no warning).

const has = (value) => value !== undefined && value !== null;

// Fills {placeholders} in a message
function fill(text, values) {
  return text.replace(/\{(\w+)\}/g, (match, name) => (has(values[name]) ? String(values[name]) : match));
}

function result(rule, level, parts, ar, en, values = {}) {
  return { rule, level, message_ar: fill(ar, values), message_en: fill(en, values), parts: parts.map((p) => p.id) };
}

// Estimated power draw: CPU TDP + GPU TDP + 100 W for the rest (board, RAM, drives, fans)
const OTHER_PARTS_W = 100;

function estimateWatts(cpu, gpu) {
  if (!cpu && !gpu) return null;
  return (cpu?.specs.tdp_w ?? 0) + (gpu?.specs.tdp_w ?? 0) + OTHER_PARTS_W;
}

// Each rule gets the parts by category ({ cpu, motherboard, ram, gpu, psu, case, cooler, storage: [] })
// and returns a list of results (empty when everything fits)
const RULES = [
  // 1. CPU and motherboard socket
  ({ cpu, motherboard }) => {
    if (!cpu || !motherboard || cpu.specs.socket === motherboard.specs.socket) return [];
    return [result('socket', 'error', [cpu, motherboard],
      'المعالج ({cpu_socket}) لا يركب على اللوحة الأم ({motherboard_socket}).',
      'The CPU ({cpu_socket}) does not fit the motherboard socket ({motherboard_socket}).',
      { cpu_socket: cpu.specs.socket, motherboard_socket: motherboard.specs.socket })];
  },

  // 2. RAM type
  ({ ram, motherboard }) => {
    if (!ram || !motherboard || ram.specs.ram_type === motherboard.specs.ram_type) return [];
    return [result('ram_type', 'error', [ram, motherboard],
      'الذاكرة من نوع {ram_type} واللوحة الأم تدعم {motherboard_ram_type} فقط.',
      'The RAM is {ram_type}, but the motherboard only supports {motherboard_ram_type}.',
      { ram_type: ram.specs.ram_type, motherboard_ram_type: motherboard.specs.ram_type })];
  },

  // 3. RAM sticks and slots
  ({ ram, motherboard }) => {
    if (!ram || !motherboard || !has(ram.specs.modules) || !has(motherboard.specs.ram_slots)) return [];
    if (ram.specs.modules <= motherboard.specs.ram_slots) return [];
    return [result('ram_slots', 'error', [ram, motherboard],
      'عدد شرائح الذاكرة ({modules}) أكثر من منافذ اللوحة الأم ({ram_slots}).',
      'The RAM has {modules} sticks, but the motherboard has only {ram_slots} slots.',
      { modules: ram.specs.modules, ram_slots: motherboard.specs.ram_slots })];
  },

  // 4. Maximum RAM (optional field on the motherboard)
  ({ ram, motherboard }) => {
    if (!ram || !motherboard || !has(motherboard.specs.max_ram_gb)) return [];
    if (ram.specs.capacity_gb <= motherboard.specs.max_ram_gb) return [];
    return [result('max_ram', 'error', [ram, motherboard],
      'حجم الذاكرة ({capacity_gb} جيجا) أكبر من أقصى حجم تدعمه اللوحة الأم ({max_ram_gb} جيجا).',
      'The RAM ({capacity_gb} GB) is more than the motherboard supports ({max_ram_gb} GB).',
      { capacity_gb: ram.specs.capacity_gb, max_ram_gb: motherboard.specs.max_ram_gb })];
  },

  // 5. M.2 drives and M.2 slots (optional field on the motherboard)
  ({ storage, motherboard }) => {
    const m2 = storage.filter((drive) => drive.specs.form_factor === 'M.2');
    if (!motherboard || m2.length === 0 || !has(motherboard.specs.m2_slots)) return [];
    if (m2.length <= motherboard.specs.m2_slots) return [];
    return [result('m2_slots', 'error', [...m2, motherboard],
      'عدد أقراص M.2 ({m2_count}) أكثر من منافذ M.2 في اللوحة الأم ({m2_slots}).',
      'You picked {m2_count} M.2 drives, but the motherboard has only {m2_slots} M.2 slots.',
      { m2_count: m2.length, m2_slots: motherboard.specs.m2_slots })];
  },

  // 6. Motherboard size and case
  ({ motherboard, case: pcCase }) => {
    if (!motherboard || !pcCase || !Array.isArray(pcCase.specs.supported_form_factors)) return [];
    if (pcCase.specs.supported_form_factors.includes(motherboard.specs.form_factor)) return [];
    return [result('form_factor', 'error', [motherboard, pcCase],
      'اللوحة الأم بحجم {form_factor} لا تركب في هذا الكيس.',
      'The {form_factor} motherboard does not fit this case.',
      { form_factor: motherboard.specs.form_factor })];
  },

  // 7. GPU length
  ({ gpu, case: pcCase }) => {
    if (!gpu || !pcCase || !has(gpu.specs.length_mm) || !has(pcCase.specs.max_gpu_length_mm)) return [];
    if (gpu.specs.length_mm <= pcCase.specs.max_gpu_length_mm) return [];
    return [result('gpu_length', 'error', [gpu, pcCase],
      'كرت الشاشة أطول ({length_mm} ملم) من أقصى طول يدعمه الكيس ({max_gpu_length_mm} ملم).',
      'The GPU ({length_mm} mm) is longer than the case allows ({max_gpu_length_mm} mm).',
      { length_mm: gpu.specs.length_mm, max_gpu_length_mm: pcCase.specs.max_gpu_length_mm })];
  },

  // 8. GPU thickness (both fields optional)
  ({ gpu, case: pcCase }) => {
    if (!gpu || !pcCase || !has(gpu.specs.slots) || !has(pcCase.specs.max_gpu_slots)) return [];
    if (gpu.specs.slots <= pcCase.specs.max_gpu_slots) return [];
    return [result('gpu_slots', 'error', [gpu, pcCase],
      'كرت الشاشة أسمك ({slots} فتحات) من المساحة المتوفرة في الكيس ({max_gpu_slots} فتحات).',
      'The GPU is {slots} slots thick, but the case only has room for {max_gpu_slots}.',
      { slots: gpu.specs.slots, max_gpu_slots: pcCase.specs.max_gpu_slots })];
  },

  // 9. Cooler needed: shown as soon as a CPU without a cooler is chosen.
  //    It is a missing part, not a clash, so the part picker does not hide CPUs because of it.
  ({ cpu, cooler }) => {
    if (!cpu || cooler || cpu.specs.includes_cooler !== false) return [];
    return [result('cooler_needed', 'error', [cpu],
      'هذا المعالج لا يأتي مع مبرد، أضف مبرد معالج.',
      'This CPU does not come with a cooler. Add a CPU cooler.')];
  },

  // 10. Cooler socket
  ({ cpu, cooler }) => {
    if (!cpu || !cooler || !Array.isArray(cooler.specs.supported_sockets)) return [];
    if (cooler.specs.supported_sockets.includes(cpu.specs.socket)) return [];
    return [result('cooler_socket', 'error', [cooler, cpu],
      'المبرد لا يدعم مقبس المعالج ({cpu_socket}).',
      'The cooler does not support the CPU socket ({cpu_socket}).',
      { cpu_socket: cpu.specs.socket })];
  },

  // 11. Air cooler height (both fields optional)
  ({ cooler, case: pcCase }) => {
    if (!cooler || !pcCase || cooler.specs.type !== 'air') return [];
    if (!has(cooler.specs.height_mm) || !has(pcCase.specs.max_cooler_height_mm)) return [];
    if (cooler.specs.height_mm <= pcCase.specs.max_cooler_height_mm) return [];
    return [result('cooler_height', 'error', [cooler, pcCase],
      'المبرد أطول ({height_mm} ملم) من أقصى ارتفاع يدعمه الكيس ({max_cooler_height_mm} ملم).',
      'The cooler ({height_mm} mm) is taller than the case allows ({max_cooler_height_mm} mm).',
      { height_mm: cooler.specs.height_mm, max_cooler_height_mm: pcCase.specs.max_cooler_height_mm })];
  },

  // 12. Power supply: below the estimate is an error, less than 20% headroom a warning,
  //     and below the GPU maker's recommendation another warning
  ({ cpu, gpu, psu }) => {
    if (!cpu || !gpu || !psu || !has(psu.specs.wattage)) return [];
    const estimate = estimateWatts(cpu, gpu);
    const { wattage } = psu.specs;
    const results = [];
    if (wattage < estimate) {
      results.push(result('psu_low', 'error', [psu, cpu, gpu],
        'مزود الطاقة ({wattage} واط) أقل من الاستهلاك المتوقع ({estimate} واط).',
        'The power supply ({wattage} W) is below the estimated power draw ({estimate} W).',
        { wattage, estimate }));
    } else if (wattage < estimate * 1.2) {
      const recommended = Math.ceil((estimate * 1.2) / 50) * 50;
      results.push(result('psu_headroom', 'warning', [psu],
        'مزود الطاقة يكفي بالكاد. ننصح بقدرة {recommended} واط أو أكثر.',
        'The power supply is barely enough. We recommend {recommended} W or more.',
        { recommended }));
    }
    if (has(gpu.specs.recommended_psu_w) && wattage < gpu.specs.recommended_psu_w) {
      results.push(result('psu_gpu_recommended', 'warning', [psu, gpu],
        'الشركة المصنعة لكرت الشاشة تنصح بمزود طاقة {recommended_psu_w} واط على الأقل.',
        'The GPU maker recommends at least a {recommended_psu_w} W power supply.',
        { recommended_psu_w: gpu.specs.recommended_psu_w }));
    }
    return results;
  },
];

// ---------- Monitor and GPU (rules 13 and 14) ----------

const PERFORMANCE_ORDER = ['weak', 'ok', 'good', 'excellent'];

// For each monitor resolution: the GPU field to read, and the level needed below / from 120 Hz
const MONITOR_NEEDS = {
  '1920x1080': { field: 'perf_1080p', below120: 'good', from120: 'excellent' },
  '2560x1440': { field: 'perf_1440p', below120: 'good', from120: 'excellent' },
  '3440x1440': { field: 'perf_1440p', below120: 'excellent', from120: 'excellent' }, // ultrawide: a third more pixels
  '3840x2160': { field: 'perf_4k', below120: 'good', from120: 'excellent' },
};

// Ports connect when they share a type; any HDMI works with any HDMI (at the lower speed)
const portType = (port) => (port.startsWith('HDMI') ? 'HDMI' : port);

function monitorPower({ gpu, monitor }) {
  const needs = monitor && MONITOR_NEEDS[monitor.specs.resolution];
  if (!gpu || !needs || !has(monitor.specs.refresh_hz)) return [];
  const level = gpu.specs[needs.field];
  if (!PERFORMANCE_ORDER.includes(level)) return [];
  const needed = monitor.specs.refresh_hz >= 120 ? needs.from120 : needs.below120;
  if (PERFORMANCE_ORDER.indexOf(level) >= PERFORMANCE_ORDER.indexOf(needed)) return [];
  return [result('monitor_power', 'warning', [gpu, monitor],
    'كرت الشاشة قد لا يستغل الشاشة بالكامل ({resolution} بتردد {refresh_hz} هرتز) في الألعاب الثقيلة.',
    'The GPU may not get the most out of this monitor ({resolution} at {refresh_hz} Hz) in demanding games.',
    { resolution: monitor.specs.resolution, refresh_hz: monitor.specs.refresh_hz })];
}

function monitorPorts({ gpu, monitor }) {
  const outputs = gpu?.specs.outputs;
  const inputs = monitor?.specs.inputs;
  if (!Array.isArray(outputs) || !Array.isArray(inputs)) return [];

  // A: at least one port in common
  const shared = inputs.filter((input) => outputs.some((output) => portType(output) === portType(input)));
  if (shared.length === 0) {
    return [result('monitor_ports', 'warning', [gpu, monitor],
      'لا يوجد منفذ مشترك بين كرت الشاشة والشاشة، ستحتاج محول.',
      'The GPU and the monitor have no matching port. You will need an adapter.')];
  }

  // B: 4K at 120 Hz or more needs DP, or HDMI 2.1 on both sides
  const fast4k = monitor.specs.resolution === '3840x2160' && monitor.specs.refresh_hz >= 120;
  const hasFastLink = shared.includes('DP') || (inputs.includes('HDMI 2.1') && outputs.includes('HDMI 2.1'));
  if (!fast4k || hasFastLink) return [];
  return [result('monitor_4k_link', 'warning', [gpu, monitor],
    'للحصول على {refresh_hz} هرتز بدقة 4K تحتاج منفذ DP أو HDMI 2.1 في الكرت والشاشة.',
    'To get {refresh_hz} Hz at 4K you need DP, or HDMI 2.1 on both the GPU and the monitor.',
    { refresh_hz: monitor.specs.refresh_hz })];
}

RULES.push(monitorPower, monitorPorts);

// The parts by category: one part per category, except storage (a list)
function byCategory(parts) {
  const grouped = { storage: [] };
  for (const part of parts) {
    if (part.category === 'storage') grouped.storage.push(part);
    else grouped[part.category] = part;
  }
  return grouped;
}

function checkBuild(parts) {
  const grouped = byCategory(parts);
  const results = RULES.flatMap((rule) => rule(grouped));

  const partStatus = Object.fromEntries(parts.map((part) => [part.id, 'ok']));
  for (const item of results) {
    for (const id of item.parts) {
      if (item.level === 'error') partStatus[id] = 'error';
      else if (partStatus[id] !== 'error') partStatus[id] = 'warning';
    }
  }

  let status = 'compatible';
  if (results.some((item) => item.level === 'error')) status = 'incompatible';
  else if (results.length > 0) status = 'warnings';

  return { status, estimate_w: estimateWatts(grouped.cpu, grouped.gpu), results, parts: partStatus };
}

// Does `candidate` fit the rest of the build? Used by the part picker's "compatible only" filter.
// Only clashes that involve the candidate count, and a missing cooler is not a clash.
function fitsBuild(candidate, otherParts) {
  const { results } = checkBuild([...otherParts, candidate]);
  return !results.some((item) => item.level === 'error' && item.rule !== 'cooler_needed' && item.parts.includes(candidate.id));
}

module.exports = { checkBuild, fitsBuild, estimateWatts };
