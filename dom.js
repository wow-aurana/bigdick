'use strict';

function getElement(id) { return document.getElementById(id); }
function getInputNumber(id) { return parseFloat(getElement(id).value); }
function getInputChecked(id) { return getElement(id).checked; }

function getRadioValue(name) {
  const el = document.querySelector('input[name="' + name + '"]:checked');
  return el ? el.value : null;
}

// Talent selection made on talents.html; see TALENTS_STORAGE_KEY in
// talent-picker.js.
function getTalents() {
  try {
    return JSON.parse(localStorage.getItem('bigdickTalents')) || {};
  } catch (e) {
    return {};
  }
}

function getEffectiveArmor() {
  // TODO move calculations inside sim
  const base = getInputNumber('armor');
  const sunder = getInputChecked('sunder') ? 5 * 450 : 0;
  const faerie = getInputChecked('faerie') ? 505 : 0;
  const curse = getInputChecked('curse') ? 640 : 0;
  const annihilator = getInputChecked('annihilator') ? 600 : 0;
  return base - sunder - faerie - curse - annihilator;
}

function getMitigation() {
  const armor = getEffectiveArmor();
  const charlevel = getInputNumber('charlvl');
  if (armor <= 0) return 0;
  return (armor / (armor + 400 + 85 * charlevel));
}

class Checkbox {
  constructor(id) {
    this.el = getElement(id);
    this.name = id;
    this.clickCb = null;
    this.children = Array.from(document.getElementsByClassName(this.name));
    this.inputs = this.children.filter((el) => {
      return (el.nodeName == 'INPUT');
    });

    this.el.onclick = (ev) => {
      const checked = ev.target.checked;
      this.check(checked);
    }
  }

  check(enable, runCallback = true) {
    this.el.checked = enable;
    for (const el of this.children) {
      el.classList.toggle('inactive', !enable);
    }

    for (const el of this.inputs) { el.disabled = !enable; } 
    if (this.clickCb && runCallback) this.clickCb(enable);
  }

  enable(enable) { this.el.disabled = !enable; }
  checked() { return this.el.checked; }

  collect() {
    if (!this.checked()) return null;

    const result = {};
    for (const el of this.inputs) {
      if (el.type == 'text') {
        result[el.name] = el.value;
      } else if (el.type == 'checkbox') {
        result[el.name] = el.checked;
      } else if (el.type == 'number') {
        result[el.name] = parseFloat(el.value);
      } else if (el.type == 'radio' && el.checked) {
        result['proc'] = el.value;
      }
    }
    return result; 
  }
}

class WeaponCheckbox extends Checkbox {
  constructor(id) { 
    super(id);
    for (const el of this.inputs) {
      if (el.type == 'radio') {
        el.onclick = () => setWeaponStats(this);
      }
    }    
  }

  getNumbers() {
    let result = {};
    for (const el of this.inputs) {
      if (el.type == 'number') {
        result[el.name] = el;
      }
    }
    return result;
  }

  getProc() {
    for (const el of this.inputs) {
      if (el.type == 'radio' && el.checked) {
        return el.value;
      }
    }
    return 'none';
  }
}

// Persist the whole #setup form to localStorage and restore it on load.
//
// Most inputs share a `name` across multiple gear/ability groups (e.g. every
// weapon slot has a "min"/"max"/"speed"/"skill"), so `name` alone isn't a
// stable key. We key on `id` when present, otherwise on the element's first
// CSS class (the group it belongs to, matching a Checkbox id) plus `name`.
const SETTINGS_KEY = 'bigdickSettings';

function settingsKey(el) {
  if (el.id) return 'id:' + el.id;
  return 'cls:' + (el.classList[0] || '') + '.' + el.name;
}

function saveSettings() {
  const form = getElement('setup');
  const settings = {};
  for (const el of form.elements) {
    if (el.type == 'submit') continue;
    const key = settingsKey(el);
    if (el.type == 'checkbox') {
      settings[key] = el.checked;
    } else if (el.type == 'radio') {
      if (el.checked) settings[key] = el.value;
    } else {
      settings[key] = el.value;
    }
  }
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    // Storage unavailable (private browsing, disabled, quota, ...). Ignore.
  }
}

function loadSettings() {
  let settings = null;
  try {
    settings = JSON.parse(localStorage.getItem(SETTINGS_KEY));
  } catch (e) {
    settings = null;
  }
  if (!settings) return;

  const form = getElement('setup');

  // Restore checkboxes/radios first, via .click() so wired onclick handlers
  // (enabling/disabling related fields, WeaponCheckbox's setWeaponStats
  // preset, mutually-exclusive twohand/mainhand+offhand, etc.) run exactly
  // as if the user had clicked them. Number/text fields are restored in a
  // second pass below so saved values always win over any preset a proc
  // radio's click handler might have just written into them.
  for (const el of form.elements) {
    if (el.type != 'checkbox' && el.type != 'radio') continue;
    const key = settingsKey(el);
    if (!(key in settings)) continue;
    const shouldBeChecked =
        el.type == 'radio' ? (el.value === settings[key]) : !!settings[key];
    if (el.checked === shouldBeChecked) continue;

    if (key.startsWith('id:')) {
      // Top-level toggle: click it so wired onclick handlers (enabling or
      // disabling related fields, twohand/mainhand+offhand mutual
      // exclusivity, etc.) run as if the user had clicked it themselves.
      el.click();
    } else {
      // Nested field. A toggle processed above may have already disabled
      // it, and .click() silently no-ops on disabled elements, so set the
      // state directly instead. This also skips a proc radio's
      // setWeaponStats preset, which the value pass below overwrites
      // with the saved numbers anyway.
      el.checked = shouldBeChecked;
    }
  }

  for (const el of form.elements) {
    if (el.type == 'checkbox' || el.type == 'radio' || el.type == 'submit') {
      continue;
    }
    const key = settingsKey(el);
    if (key in settings) el.value = settings[key];
  }
}

class Output {
  constructor() {
    this.el = getElement('output');
  }

  clear() { this.el.innerHTML = ''; }

  print(line) {
    const child = document.createElement('div');
    child.classList.add('log');
    child.append(line);
    this.el.append(child);
  }
}
