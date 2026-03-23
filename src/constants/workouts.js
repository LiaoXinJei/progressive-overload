// ==================== 肌群週容量目標 ====================
// 每個陣列代表 W1(MEV) → W2(MAV1) → W3(MAV2) → W4(MRV)
// 肌力期 (W6-W9) 固定使用 W1 值（MEV），重量遞增
// 減量週 (W5, W10) 使用 W1 值的 50%

export const VOLUME_CONFIG = {
  CHEST:     [12, 14, 16, 18],
  BACK:      [12, 14, 16, 18],
  SHOULDERS: [4, 5, 6, 6],
  SIDE_DELT: [8, 10, 12, 14],
  REAR_DELT: [8, 9, 10, 12],
  TRICEPS:   [8, 9, 10, 12],
  BICEPS:    [8, 9, 10, 12],
  QUADS:     [4, 4, 4, 4],
  HAMS:      [4, 4, 4, 4],
};

// ==================== 週期配置 ====================

export const PHASE_CONFIG = {
  hypertrophy: { weeks: [1, 2, 3, 4], compound: '8-12', isolation: '10-15', label: '肌肥大期' },
  strength:    { weeks: [6, 7, 8, 9], compound: '3-6',  isolation: '8-10',  label: '肌力期' },
  deload:      { weeks: [5, 10],      compound: '8-12', isolation: '10-15', label: '減量週' },
};

// ==================== 訓練菜單 ====================

export const WORKOUTS = {
  A: {
    name: 'PUSH A',
    subtitle: '水平推力 + 微量腿前',
    type: 'push',
    exercises: [
      { id: 'bp_flat', name: '平板槓鈴臥推', muscle: 'CHEST', type: 'compound', isUpper: true },
      { id: 'bp_incline_db', name: '上斜啞鈴臥推', muscle: 'CHEST', type: 'compound', isUpper: true },
      { id: 'lateral_raise', name: '啞鈴側平舉', muscle: 'SIDE_DELT', type: 'isolation', isUpper: true },
      { id: 'tri_pushdown', name: '繩索三頭下壓', muscle: 'TRICEPS', type: 'isolation', isUpper: true },
      { id: 'leg_ext', name: '機械腿伸直', muscle: 'QUADS', type: 'isolation', isUpper: false },
    ]
  },
  B: {
    name: 'PULL A',
    subtitle: '垂直拉力 + 微量腿後',
    type: 'pull',
    exercises: [
      { id: 'pullup', name: '引體向上', muscle: 'BACK', type: 'compound', isUpper: true },
      { id: 'db_row', name: '單臂啞鈴划船', muscle: 'BACK', type: 'compound', isUpper: true },
      { id: 'rear_fly', name: '反向飛鳥', muscle: 'REAR_DELT', type: 'isolation', isUpper: true },
      { id: 'bi_curl', name: '啞鈴二頭彎舉', muscle: 'BICEPS', type: 'isolation', isUpper: true },
      { id: 'leg_curl', name: '機械腿彎舉', muscle: 'HAMS', type: 'isolation', isUpper: false },
    ]
  },
  C: {
    name: 'PUSH B',
    subtitle: '垂直推力（純上半身）',
    type: 'push',
    exercises: [
      { id: 'ohp', name: '站姿肩推', muscle: 'SHOULDERS', type: 'compound', isUpper: true },
      { id: 'tri_dips', name: '雙槓臂屈伸', muscle: 'CHEST', type: 'compound', isUpper: true },
      { id: 'lateral_raise_cable', name: '單臂滑輪側平舉', muscle: 'SIDE_DELT', type: 'isolation', isUpper: true },
      { id: 'tri_overhead', name: '過頭三頭伸展', muscle: 'TRICEPS', type: 'isolation', isUpper: true },
      { id: 'fly_cable', name: '繩索飛鳥', muscle: 'CHEST', type: 'isolation', isUpper: true },
    ]
  },
  D: {
    name: 'PULL B',
    subtitle: '水平拉力（純上半身）',
    type: 'pull',
    exercises: [
      { id: 'bb_row', name: '槓鈴划船', muscle: 'BACK', type: 'compound', isUpper: true },
      { id: 'pulldown_narrow', name: '窄距下拉', muscle: 'BACK', type: 'compound', isUpper: true },
      { id: 'face_pull', name: '滑輪面拉', muscle: 'REAR_DELT', type: 'isolation', isUpper: true },
      { id: 'bi_hammer', name: '錘式彎舉', muscle: 'BICEPS', type: 'isolation', isUpper: true },
      { id: 'straight_arm_pd', name: '直臂下拉', muscle: 'BACK', type: 'isolation', isUpper: true },
    ]
  }
};

// ==================== 肌群映射 ====================

export const MUSCLE_GROUPS = {
  CHEST: '胸部',
  BACK: '背部',
  SHOULDERS: '肩膀',
  SIDE_DELT: '側三角',
  REAR_DELT: '後三角',
  TRICEPS: '三頭',
  BICEPS: '二頭',
  QUADS: '股四頭',
  HAMS: '腿後側'
};

// ==================== 預計算：肌群 → 出現在哪些 session ====================

export const MUSCLE_SESSION_MAP = {};
Object.entries(WORKOUTS).forEach(([key, workout]) => {
  const seen = new Set();
  workout.exercises.forEach(ex => {
    if (!seen.has(ex.muscle)) {
      seen.add(ex.muscle);
      if (!MUSCLE_SESSION_MAP[ex.muscle]) MUSCLE_SESSION_MAP[ex.muscle] = [];
      MUSCLE_SESSION_MAP[ex.muscle].push(key);
    }
  });
});
