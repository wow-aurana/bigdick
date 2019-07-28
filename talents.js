const defaultTalentUrl =
    'https://classic.wowhead.com/talent-calc/warrior/30305001302-05050005525010051';


function parseTalents(url = defaultTalentUrl) {
  const numbers = url.split('/').pop();
  let arms, fury, prot;
  [arms, fury, prot] = numbers.split('-');

  const getValue = (str, idx, def) => {
    return (str && str.length > idx) ? (parseInt(str[idx]) || def) : def;
  }
  return {
    improvedHS: getValue(arms, 0, 0),
    angerMgmt: getValue(arms, 7, 0),
    deepWounds: getValue(arms, 8, 0),
    twoHandSpec: getValue(arms, 9, 0),
    impale: getValue(arms, 10, 0),
    // TODO add rest of arms?
    boomingVoice: getValue(fury, 0, 0),
    unbridledWrath: getValue(fury, 3, 0),
    dualWieldSpec: getValue(fury, 8, 0),
    improvedExecute: getValue(fury, 9, 0),
    improvedSlam: getValue(fury, 11, 0),
    deathWish: getValue(fury, 12, 0),
    flurry: getValue(fury, 15, 0),
  }
}
