'use strict';

function getElement(id) { return document.getElementById(id); }
function getInputString(id) { return getElement(id).value; }
function getInputNumber(id) { return parseFloat(getElement(id).value); }
function getInputChecked(id) { return getElement(id).checked; }

function getEffectiveArmor() {
  // TODO move calculations inside sim
  const base = getInputNumber('armor');
  const sunder = getInputChecked('sunder') ? 5 * 450 : 0;
  const faerie = getInputChecked('faerie') ? 505 : 0;
  const curse = getInputChecked('curse') ? 640 : 0;
  const annihilator = getInputChecked('annihilator') ? 600 : 0;
  return base - sunder - faerie - curse - annihilator;
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
