import { GOALS } from '../constants/nutrition';

/**
 * Mifflin-St Jeor 公式計算 BMR
 */
export const calculateBMR = (gender, weight, height, age) => {
  if (gender === 'male') {
    return 10 * weight + 6.25 * height - 5 * age + 5;
  }
  return 10 * weight + 6.25 * height - 5 * age - 161;
};

/**
 * 計算 TDEE
 */
export const calculateTDEE = (bmr, activityLevel) => {
  return Math.round(bmr * activityLevel);
};

/**
 * 計算巨量營養素目標
 * - 蛋白質：依目標 1.6-2.2 g/kg
 * - 脂肪：25% 總熱量
 * - 碳水：剩餘熱量
 */
export const calculateMacros = (targetCalories, weight, goal) => {
  const goalConfig = GOALS.find(g => g.value === goal) || GOALS[1];
  const proteinGrams = Math.round(weight * goalConfig.proteinPerKg);
  const fatCalories = targetCalories * 0.25;
  const fatGrams = Math.round(fatCalories / 9);
  const proteinCalories = proteinGrams * 4;
  const carbCalories = targetCalories - proteinCalories - fatCalories;
  const carbGrams = Math.round(Math.max(0, carbCalories / 4));

  return {
    protein: proteinGrams,
    fat: fatGrams,
    carbs: carbGrams,
  };
};

/**
 * 加總每日所有餐點的攝取量
 */
export const calculateDailyTotals = (meals) => {
  if (!meals || meals.length === 0) {
    return { calories: 0, protein: 0, carbs: 0, fat: 0 };
  }

  return meals.reduce((totals, meal) => {
    const mealTotals = (meal.items || []).reduce((acc, item) => ({
      calories: acc.calories + (item.calories || 0),
      protein: acc.protein + (item.protein || 0),
      carbs: acc.carbs + (item.carbs || 0),
      fat: acc.fat + (item.fat || 0),
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

    return {
      calories: totals.calories + mealTotals.calories,
      protein: totals.protein + mealTotals.protein,
      carbs: totals.carbs + mealTotals.carbs,
      fat: totals.fat + mealTotals.fat,
    };
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
};
