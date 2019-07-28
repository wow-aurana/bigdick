function getInput(id) {
  const el = document.getElementById(id);
  return el.value;
}

function getInputNumber(id) {
  const el = document.getElementById(id);
  return parseFloat(el.value);
}

function getChecked(id) {
  return document.getElementById(id).checked;
}

class Checkbox {
  constructor(id, toggleInputs, callback = null) {
    this.el = document.getElementById(id);
    this.el.onclick = (ev) => {
      const checked = ev.target.checked;
      for (const id of toggleInputs) {
        document.getElementById(id).disabled = !checked;
      }
      // same class as checkbox id
      for (const el of document.getElementsByClassName(id)) {
        el.classList.toggle('inactive', !checked);
      }
      callback && callback(ev);
    }
  }

  checked() { return this.el.checked; }
}

class Output {
  constructor() {
    this.el = document.getElementById('output');
  }

  clear() { this.el.innerHTML = ''; }

  print(line) {
    const child = document.createElement('div');
    child.classList.add('log');
    child.append(line);
    this.el.append(child);
  }
}

class Submit {
  constructor(callback) {
    this.el = document.getElementById('submit');
    this.el.onclick = callback;
  }
}
