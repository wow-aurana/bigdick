function getElement(id) { return document.getElementById(id); }
function getInputString(id) { return getElement(id).value; }
function getInputNumber(id) { return parseFloat(getElement(id).value); }
function getInputChecked(id) { return getElement(id).checked; }

class Checkbox {
  constructor(id) {
    this.el = getElement(id);
    this.name = id;
    this.clickCb = null;
    this.el.onclick = (ev) => {
      const checked = ev.target.checked;
      this.check(checked);
    }
  }

  check(enable, runCallback = true) {
    this.el.checked = enable;
    for (const el of document.getElementsByClassName(this.name)) {
      el.classList.toggle('inactive', !enable);
      if (el.nodeName == 'INPUT') {
        el.disabled = !enable;
      } 
    }
    if (this.clickCb && runCallback) this.clickCb(enable);
  }

  enable(enable) { this.el.disabled = !enable; }

  checked() { return this.el.checked; }

  collect() {
    if (!this.checked()) return null;

    const result = {};
    for (const el of document.getElementsByClassName(this.name)) {
      if (el.nodeName == 'INPUT') {
        if (el.type == 'text') {
          result[el.name] = el.value;
        } else if (el.type == 'checkbox') {
          result[el.name] = el.checked;
        } else if (el.type == 'number') {
          result[el.name] = parseFloat(el.value);
        }
      }
    }
    return result; 
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
