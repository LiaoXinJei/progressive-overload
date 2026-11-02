// 健身房模式的槓片：點槓片架加重、點槓鈴（或重量旁的「卸」）卸下最外面那片。純函式。
// 重量照真的槓片算：槓鈴類 = 空槓 + 兩邊各掛一片；其他器材（啞鈴、插銷、自體重）點一片只加一片的重量。

export const PLATE_KGS = [20, 10, 5, 2.5, 1.25];

export const BARBELL = { bar: 20, sides: 2 };
export const EZ_BAR = { bar: 10, sides: 2 };
export const SINGLE = { bar: 0, sides: 1 };

const round2 = (n) => Math.round(n * 100) / 100;
const num = (w) => {
  const n = parseFloat(w);
  return Number.isFinite(n) ? n : 0;
};

// 重量拆成每邊的槓片（大的在內、小的在外），湊不出來的零頭不畫
export const platesOf = (weight, rule = SINGLE) => {
  let left = round2((num(weight) - rule.bar) / rule.sides);
  const plates = [];
  for (const kg of PLATE_KGS) {
    while (left >= kg - 1e-9) {
      plates.push(kg);
      left = round2(left - kg);
    }
  }
  return plates;
};

// 掛一片：比空槓輕（或還沒填）就從空槓開始
export const addPlate = (weight, kg, rule = SINGLE) => round2(Math.max(num(weight), rule.bar) + kg * rule.sides);

// 卸一片：不會比 0 輕
export const removePlate = (weight, kg, rule = SINGLE) => round2(Math.max(0, num(weight) - kg * rule.sides));

/**
 * 槓上現在掛的槓片。使用者剛點過的話照點的順序（點 10 就多一片 10，不會被重新拆成 20），
 * 重量在別的地方改過（清單、另一個視窗）就照重量重新拆。
 * memo：{ weight, plates } | undefined
 */
export const stackOf = (weight, rule = SINGLE, memo = undefined) => (
  memo && memo.weight === round2(num(weight)) ? memo.plates : platesOf(weight, rule)
);
