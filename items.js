function setWeaponStats(checkbox) {
  const proc = checkbox.getProc();
  const {min, max, speed} = checkbox.getNumbers();

  if (proc == 'MS') {
    min.value = 158, max.value = 238, speed.value = '3.8';
  } else if (proc == 'AC') {
    min.value = 129, max.value = 194, speed.value = '3.0';
  } else if (proc == 'UTB') {
    min.value = 192, max.value = 289, speed.value = '3.4';
  }
};
