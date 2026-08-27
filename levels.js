const LEVELS = (function () {
  const seededRandom = function (seed) {
    let s = seed;
    return function () {
      s = (s * 16807 + 0) % 2147483647;
      return (s - 1) / 2147483646;
    };
  };

  const wallColors = [
    ['#3a3530', '#2e2a26'], ['#3d3a36', '#322f2b'], ['#444038', '#3a3630'],
    ['#35322e', '#2b2824'], ['#3f3c38', '#34312d'], ['#38352f', '#2d2a25'],
    ['#413e3a', '#36332f'], ['#3b3834', '#302d29'], ['#45423c', '#3a3732'],
    ['#3c3935', '#312e2a'], ['#33302c', '#292622'], ['#433f3a', '#383530'],
    ['#3e3b37', '#33302c'], ['#3a3733', '#2f2c28'], ['#403d39', '#35322e'],
  ];

  const wallPatterns = [
    'plain', 'bricks', 'plaster', 'wood', 'tiles', 'concrete', 'wallpaper',
  ];

  const objectTypes = [
    { type: 'picture', label: '🖼', w: 60, h: 45 },
    { type: 'clock', label: '🕐', w: 40, h: 40 },
    { type: 'poster', label: '📋', w: 50, h: 65 },
    { type: 'switch', label: '💡', w: 25, h: 30 },
    { type: 'meter', label: '⚡', w: 35, h: 40 },
    { type: 'pipe', label: '🔧', w: 15, h: 80 },
    { type: 'outlet', label: '🔌', w: 25, h: 25 },
    { type: 'sticker', label: '📌', w: 20, h: 20 },
    { type: 'graffiti', label: '✏️', w: 55, h: 35 },
    { type: 'mail', label: '📬', w: 30, h: 35 },
    { type: 'sensor', label: '📷', w: 22, h: 22 },
    { type: 'bell', label: '🔔', w: 20, h: 25 },
    { type: 'camera', label: '🎥', w: 25, h: 20 },
    { type: 'sign', label: '🏷', w: 45, h: 30 },
    { type: 'scratch', label: '〰️', w: 40, h: 15 },
  ];

  const levels = [];

  for (let i = 0; i < 100; i++) {
    const rand = seededRandom(i * 7919 + 42);
    const level = i + 1;
    let codeLen;
    if (level <= 10) codeLen = 2;
    else if (level <= 25) codeLen = 3;
    else if (level <= 50) codeLen = 4;
    else if (level <= 75) codeLen = 5;
    else codeLen = 6;

    let code = '';
    for (let d = 0; d < codeLen; d++) {
      code += Math.floor(rand() * 10).toString();
    }

    const colorPair = wallColors[Math.floor(rand() * wallColors.length)];
    const pattern = wallPatterns[Math.floor(rand() * wallPatterns.length)];

    const usedAreas = [];
    const phoneArea = { x: 40, y: 70, w: 20, h: 28 };

    function isOverlapping(x, y, w, h) {
      const areas = usedAreas.concat([phoneArea]);
      for (const a of areas) {
        if (x < a.x + a.w && x + w > a.x && y < a.y + a.h && y + h > a.y) return true;
      }
      return false;
    }

    const numObjects = 4 + Math.floor(rand() * 8);
    const objects = [];
    for (let o = 0; o < numObjects; o++) {
      const ot = objectTypes[Math.floor(rand() * objectTypes.length)];
      let ox, oy, attempts = 0;
      do {
        ox = 5 + Math.floor(rand() * 70);
        oy = 5 + Math.floor(rand() * 55);
        attempts++;
      } while (isOverlapping(ox, oy, ot.w / 10, ot.h / 10) && attempts < 100);
      usedAreas.push({ x: ox, y: oy, w: ot.w / 10 + 2, h: ot.h / 10 + 2 });
      objects.push({
        type: ot.type,
        label: ot.label,
        x: ox,
        y: oy,
        w: ot.w,
        h: ot.h,
        rotation: Math.floor(rand() * 20) - 10,
        hidesDigit: -1,
      });
    }

    const digitPositions = [];
    for (let d = 0; d < codeLen; d++) {
      const objIdx = d % objects.length;
      const obj = objects[objIdx];
      const objCx = obj.x + (obj.w / 10) / 2;
      const objCy = obj.y + (obj.h / 10) / 2;
      const dx = Math.round(objCx + (rand() - 0.5) * 6);
      const dy = Math.round(objCy + (rand() - 0.5) * 6);
      const x = Math.max(2, Math.min(90, dx));
      const y = Math.max(2, Math.min(65, dy));
      digitPositions.push({ x, y, digit: code[d] });
      obj.hidesDigit = d;
    }

    const cracks = [];
    const numCracks = Math.floor(rand() * 4);
    for (let c = 0; c < numCracks; c++) {
      cracks.push({
        x: Math.floor(rand() * 90),
        y: Math.floor(rand() * 80),
        w: 10 + Math.floor(rand() * 20),
        rotation: Math.floor(rand() * 360),
      });
    }

    const stains = [];
    const numStains = Math.floor(rand() * 3);
    for (let s = 0; s < numStains; s++) {
      stains.push({
        x: Math.floor(rand() * 85),
        y: Math.floor(rand() * 75),
        size: 3 + Math.floor(rand() * 8),
      });
    }

    levels.push({
      level,
      code,
      codeLen,
      wallColor: colorPair,
      wallPattern: pattern,
      digitPositions,
      objects,
      cracks,
      stains,
    });
  }

  return levels;
})();
