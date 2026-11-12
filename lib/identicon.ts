export function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function identiconCells(seed: string): boolean[][] {
  let x = hashStr(seed || "imphnen") || 1;
  const next = () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    return x;
  };
  const cells: boolean[][] = [];
  for (let r = 0; r < 5; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < 3; c++) row.push(next() % 100 < 55);
    cells.push([row[0], row[1], row[2], row[1], row[0]]);
  }
  return cells;
}
