'use strict';

// Standalone Warrior talent picker. Reads/writes the same localStorage key
// the main sim page reads (see collectInputs() in main.js), so points spent
// here are picked up by the sim immediately -- no copy/pasting a spec URL.

const TALENTS_STORAGE_KEY = 'bigdickTalents';
const CELL_PITCH = 56 + 10; // must match --cell + --gap in talents.css

function loadTalentState() {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(TALENTS_STORAGE_KEY));
  } catch (e) {
    saved = null;
  }
  const state = {};
  for (const tree of TALENT_TREES) state[tree.key] = { ...(saved && saved[tree.key]) };
  return state;
}

function saveTalentState(state) {
  try {
    localStorage.setItem(TALENTS_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // Storage unavailable (private browsing, disabled, quota, ...). Ignore.
  }
}

const state = loadTalentState();

function rankOf(treeKey, talentKey) {
  return state[treeKey][talentKey] || 0;
}

function pointsInTree(treeKey) {
  const tree = TALENT_TREES.find((t) => t.key === treeKey);
  return tree.talents.reduce((sum, t) => sum + rankOf(treeKey, t.key), 0);
}

function totalPoints() {
  return TALENT_TREES.reduce((sum, t) => sum + pointsInTree(t.key), 0);
}

function tierRequirement(talent) {
  return TALENT_POINTS_PER_TIER * (talent.tier - 1);
}

// Talents (in any tree) that list `talent` as their prerequisite.
function dependents(tree, talent) {
  return tree.talents.filter((t) => t.requires && t.requires.key === talent.key);
}

function unmetReason(tree, talent) {
  const rank = rankOf(tree.key, talent.key);
  if (rank >= talent.maxRank) return null; // maxed, not "locked"
  if (totalPoints() >= TALENT_MAX_POINTS) return 'No talent points remaining.';
  const tierNeeded = tierRequirement(talent);
  if (pointsInTree(tree.key) < tierNeeded) {
    return `Requires ${tierNeeded} points in ${tree.name} Talents.`;
  }
  if (talent.requires) {
    const reqRank = rankOf(tree.key, talent.requires.key);
    if (reqRank < talent.requires.rank) {
      const reqTalent = tree.talents.find((t) => t.key === talent.requires.key);
      const s = talent.requires.rank > 1 ? 's' : '';
      return `Requires ${talent.requires.rank} point${s} in ${reqTalent.name}.`;
    }
  }
  return null;
}

function canAllocate(tree, talent) {
  return unmetReason(tree, talent) === null && rankOf(tree.key, talent.key) < talent.maxRank;
}

function canDeallocate(tree, talent) {
  const rank = rankOf(tree.key, talent.key);
  if (rank <= 0) return false;
  const nextRank = rank - 1;

  // Would removing this point invalidate a dependent talent that already
  // has points in it?
  for (const dep of dependents(tree, talent)) {
    if (rankOf(tree.key, dep.key) > 0 && nextRank < dep.requires.rank) return false;
  }

  // Would removing this point drop the tree's total below what some other
  // already-allocated talent's tier requires?
  const newTreeTotal = pointsInTree(tree.key) - 1;
  for (const other of tree.talents) {
    if (other === talent) continue;
    if (rankOf(tree.key, other.key) > 0 && newTreeTotal < tierRequirement(other)) return false;
  }

  return true;
}

function allocate(tree, talent) {
  if (!canAllocate(tree, talent)) return;
  state[tree.key][talent.key] = rankOf(tree.key, talent.key) + 1;
  saveTalentState(state);
  render();
}

function deallocate(tree, talent) {
  if (!canDeallocate(tree, talent)) return;
  state[tree.key][talent.key] = rankOf(tree.key, talent.key) - 1;
  saveTalentState(state);
  render();
}

function resetTree(tree) {
  state[tree.key] = {};
  saveTalentState(state);
  render();
}

// ---- Rendering ----

const treesEl = document.getElementById('trees');
const totalPointsEl = document.getElementById('totalPoints');
const tooltipEl = document.getElementById('tooltip');

function iconUrl(icon) {
  return `https://wow.zamimg.com/images/wow/icons/medium/${icon}.jpg`;
}

function buildTreeDom(tree) {
  const wrap = document.createElement('div');
  wrap.className = 'tree';
  wrap.dataset.tree = tree.key;

  const header = document.createElement('div');
  header.className = 'tree-header';
  header.innerHTML = `
    <img src="${iconUrl(tree.icon)}" alt="${tree.name}">
    <span class="tree-name">${tree.name}</span>
    <span class="tree-points">(<span class="tree-points-value">0</span>)</span>
    <button type="button" class="reset-btn">Reset</button>
  `;
  header.querySelector('.reset-btn').addEventListener('click', () => resetTree(tree));
  wrap.appendChild(header);

  const gridWrap = document.createElement('div');
  gridWrap.className = 'tree-grid-wrap';

  const maxTier = Math.max(...tree.talents.map((t) => t.tier));
  const svgNs = 'http://www.w3.org/2000/svg';
  const arrows = document.createElementNS(svgNs, 'svg');
  arrows.setAttribute('class', 'tree-arrows');
  arrows.setAttribute('width', 4 * CELL_PITCH);
  arrows.setAttribute('height', maxTier * CELL_PITCH);
  gridWrap.appendChild(arrows);

  const grid = document.createElement('div');
  grid.className = 'tree-grid';
  grid.style.gridTemplateRows = `repeat(${maxTier}, 56px)`;

  const cellCenter = (tier, col) => ({
    x: (col - 1) * CELL_PITCH + 28,
    y: (tier - 1) * CELL_PITCH + 28,
  });

  for (const talent of tree.talents) {
    const cell = document.createElement('div');
    cell.className = 'talent-cell';
    cell.dataset.key = talent.key;
    cell.style.gridColumn = String(talent.col);
    cell.style.gridRow = String(talent.tier);
    cell.innerHTML = `<img src="${iconUrl(talent.icon)}" alt="${talent.name}">` +
        `<span class="talent-points">0/${talent.maxRank}</span>`;

    cell.addEventListener('click', () => allocate(tree, talent));
    cell.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      deallocate(tree, talent);
    });
    cell.addEventListener('mouseenter', (e) => showTooltip(e, tree, talent));
    cell.addEventListener('mousemove', positionTooltip);
    cell.addEventListener('mouseleave', hideTooltip);

    grid.appendChild(cell);

    if (talent.requires) {
      const reqTalent = tree.talents.find((t) => t.key === talent.requires.key);
      const from = cellCenter(reqTalent.tier, reqTalent.col);
      const to = cellCenter(talent.tier, talent.col);
      const line = document.createElementNS(svgNs, 'line');
      line.setAttribute('x1', from.x);
      line.setAttribute('y1', from.y + 28);
      line.setAttribute('x2', to.x);
      line.setAttribute('y2', to.y - 28);
      line.setAttribute('stroke', '#886020');
      line.setAttribute('stroke-width', '2');
      arrows.appendChild(line);
    }
  }

  gridWrap.appendChild(grid);
  wrap.appendChild(gridWrap);
  return wrap;
}

function render() {
  for (const tree of TALENT_TREES) {
    const wrap = treesEl.querySelector(`[data-tree="${tree.key}"]`);
    wrap.querySelector('.tree-points-value').textContent = pointsInTree(tree.key);

    for (const talent of tree.talents) {
      const cell = wrap.querySelector(`[data-key="${talent.key}"]`);
      const rank = rankOf(tree.key, talent.key);
      cell.querySelector('.talent-points').textContent = `${rank}/${talent.maxRank}`;

      cell.classList.remove('locked', 'available', 'allocated', 'maxed');
      if (rank >= talent.maxRank) {
        cell.classList.add('maxed');
      } else if (rank > 0) {
        cell.classList.add('allocated');
      } else if (canAllocate(tree, talent)) {
        cell.classList.add('available');
      } else {
        cell.classList.add('locked');
      }
    }
  }
  totalPointsEl.textContent = `${totalPoints()} / ${TALENT_MAX_POINTS} points spent`;
}

function showTooltip(e, tree, talent) {
  const rank = rankOf(tree.key, talent.key);
  const nextRankIdx = Math.min(rank, talent.maxRank - 1);
  const reason = unmetReason(tree, talent);

  let html = `<div class="tt-name">${talent.name} (${rank}/${talent.maxRank})</div>`;
  html += `<div class="tt-rank">${talent.ranks[nextRankIdx]}</div>`;
  const tierNeeded = tierRequirement(talent);
  if (tierNeeded > 0) {
    html += `<div>Requires ${tierNeeded} points in ${tree.name} Talents.</div>`;
  }
  if (talent.requires) {
    const reqTalent = tree.talents.find((t) => t.key === talent.requires.key);
    const s = talent.requires.rank > 1 ? 's' : '';
    html += `<div>Requires ${talent.requires.rank} point${s} in ${reqTalent.name}.</div>`;
  }
  if (reason) html += `<div class="tt-req">${reason}</div>`;

  tooltipEl.innerHTML = html;
  tooltipEl.hidden = false;
  positionTooltip(e);
}

function positionTooltip(e) {
  const pad = 16;
  let x = e.clientX + pad;
  let y = e.clientY + pad;
  if (x + 330 > window.innerWidth) x = e.clientX - 330 - pad;
  if (y + 150 > window.innerHeight) y = e.clientY - 150 - pad;
  tooltipEl.style.left = `${x}px`;
  tooltipEl.style.top = `${y}px`;
}

function hideTooltip() {
  tooltipEl.hidden = true;
}

for (const tree of TALENT_TREES) {
  treesEl.appendChild(buildTreeDom(tree));
}
render();
