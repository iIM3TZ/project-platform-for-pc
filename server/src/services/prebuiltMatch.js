// Ready-made PCs that match a build (docs/pages.md, "Ready-made PC suggestion").
// The graphics card is the base: the same GPU chipset. The CPU can be from AMD or Intel, of the same
// class or one class lower, so a cheaper PC can show too (a Ryzen 7 build matches a Core i7 or a
// Ryzen 5, never a Ryzen 3). RAM and storage do not matter.
// Only PCs with an offer in stock count. Returns { count, cheapest, cpu_name, gpu_chipset } or null.

// The class of a CPU from its name: 3, 5, 7 or 9, or null when the name does not say
// (Ryzen 7 7800X3D -> 7, Core i5-14400F -> 5, Core Ultra 9 285K -> 9)
function cpuClass(name) {
  const text = String(name ?? '').toLowerCase();
  const match = text.match(/ryzen\s*(?:threadripper\s*)?([3579])\b/)
    || text.match(/core\s*(?:ultra\s*)?i?([3579])\b/);
  return match ? Number(match[1]) : null;
}

// Without a class in the name, CPUs are compared by name, without case, spaces or the brand word
function normalizeCpu(name) {
  return String(name ?? '').toLowerCase().replace(/\s+/g, '').replace(/^(amd|intel)/, '');
}

const CLASSES = [3, 5, 7, 9];

// The same class, or one class lower (9 -> 9 or 7, 7 -> 7 or 5, 5 -> 5 or 3, 3 -> 3)
function closeCpuLevel(buildCpuName, pcCpuName) {
  const buildClass = cpuClass(buildCpuName);
  const pcClass = cpuClass(pcCpuName);
  if (buildClass && pcClass) {
    const steps = CLASSES.indexOf(buildClass) - CLASSES.indexOf(pcClass);
    return steps === 0 || steps === 1;
  }
  return normalizeCpu(buildCpuName) === normalizeCpu(pcCpuName);
}

// buildParts: [{ category, name, specs }]; prebuilts: parts of the prebuilt category with their `cheapest` offer
function matchPrebuilts(buildParts, prebuilts) {
  const cpu = buildParts.find((part) => part.category === 'cpu');
  const gpu = buildParts.find((part) => part.category === 'gpu');
  if (!cpu || !gpu || !gpu.specs.chipset) return null;

  const matches = prebuilts.filter((pc) => {
    const specs = pc.specs ?? {};
    if (!pc.cheapest) return false; // only PCs that can be found in a store right now
    return specs.gpu_chipset === gpu.specs.chipset && closeCpuLevel(cpu.name, specs.cpu_name);
  });
  if (matches.length === 0) return null;

  const cheapest = matches.reduce((best, pc) => (pc.cheapest.total_sar < best.cheapest.total_sar ? pc : best));
  return {
    count: matches.length,
    cheapest: {
      id: cheapest.id,
      brand: cheapest.brand,
      name: cheapest.name,
      total_sar: cheapest.cheapest.total_sar,
      store_name: cheapest.cheapest.store_name,
    },
    cpu_name: cpu.name,
    gpu_chipset: gpu.specs.chipset, // the link to the Parts page filters on the GPU only
  };
}

module.exports = { matchPrebuilts, cpuClass, normalizeCpu };
