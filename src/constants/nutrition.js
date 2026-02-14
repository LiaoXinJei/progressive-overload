export const ACTIVITY_LEVELS = [
  { value: 1.2, label: '久坐不動', description: '辦公室工作，幾乎不運動' },
  { value: 1.375, label: '輕度活動', description: '每週運動 1-3 天' },
  { value: 1.55, label: '中度活動', description: '每週運動 3-5 天' },
  { value: 1.725, label: '高度活動', description: '每週運動 6-7 天' },
  { value: 1.9, label: '極高活動', description: '體力勞動或每日高強度訓練' },
];

export const GOALS = [
  { value: 'cut', label: '減脂', calorieAdjust: -500, proteinPerKg: 2.2 },
  { value: 'maintain', label: '維持', calorieAdjust: 0, proteinPerKg: 1.8 },
  { value: 'bulk', label: '增肌', calorieAdjust: 300, proteinPerKg: 1.6 },
];

export const DEFAULT_MEAL_NAMES = ['早餐', '午餐', '晚餐', '點心'];
