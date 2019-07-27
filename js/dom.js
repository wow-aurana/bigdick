const OUTPUT_ID = "output";
const SUBMIT_ID = "submit";


function getInputNumber(id) {
  const el = document.getElementById(id);
  return parseFloat(el.value);
}

class Output {
  constructor() {
    this.el = document.getElementById(OUTPUT_ID);
  }
  clear() {
    this.el.innerHTML = '';
  }

  print(line) {
    const child = document.createElement('div');
    child.classList.add('log');
    child.append(line);
    this.el.append(child);
  }
}

class Submit {
  constructor(callback) {
    this.el = document.getElementById(SUBMIT_ID);
    this.el.onclick = callback;
  }
}