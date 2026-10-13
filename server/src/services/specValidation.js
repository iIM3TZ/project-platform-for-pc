const { SPEC_FIELDS } = require('../config/specFields');

function isEmpty(value) {
  return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
}

// The allowed values of a field. For a field with optionGroups they depend on another
// field's value (e.g. GPU chipsets depend on chip_brand).
function allowedOptions(field, specs) {
  if (field.optionGroups) return field.optionGroups[specs[field.optionsBy]] || [];
  return field.options;
}

// Checks one value against its field definition. Returns an error message, or null if it is valid.
function checkValue(field, value, specs) {
  const options = allowedOptions(field, specs);

  switch (field.type) {
    case 'boolean':
      return typeof value === 'boolean' ? null : 'must be true or false';

    case 'integer':
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return 'must be a number';
      if (field.type === 'integer' && !Number.isInteger(value)) return 'must be a whole number';
      if (field.min !== undefined && value < field.min) return `must be at least ${field.min}`;
      if (field.max !== undefined && value > field.max) return `must be at most ${field.max}`;
      if (options && !options.includes(value)) return `must be one of: ${options.join(', ')}`;
      return null;
    }

    case 'string':
      if (typeof value !== 'string') return 'must be text';
      if (field.optionGroups && options.length === 0) return `choose ${field.optionsBy} first`;
      if (options && !options.includes(value)) return `must be one of: ${options.join(', ')}`;
      return null;

    case 'string[]':
      if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) return 'must be a list';
      if (options && !value.every((item) => options.includes(item))) {
        return `can only contain: ${options.join(', ')}`;
      }
      return null;

    default:
      return 'has an unknown type';
  }
}

// Validates the specs of a product in a category.
// Returns { specs } with only the known, non-empty fields, or { errors } keyed by field.
function validateSpecs(category, input) {
  const fields = SPEC_FIELDS[category];
  if (!fields) {
    return { errors: { category: 'Unknown category' } };
  }
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { errors: { specs: 'Specs must be an object' } };
  }

  const specs = {};
  const errors = {};

  for (const field of fields) {
    let value = input[field.key];
    if (typeof value === 'string') value = value.trim();
    if (Array.isArray(value)) value = [...new Set(value)]; // no duplicate ports or sockets

    if (isEmpty(value)) {
      if (field.required) errors[field.key] = 'is required';
      continue;
    }

    const problem = checkValue(field, value, specs);
    if (problem) {
      errors[field.key] = problem;
    } else {
      specs[field.key] = value;
    }
  }

  return Object.keys(errors).length > 0 ? { errors } : { specs };
}

module.exports = { validateSpecs };
