// ==================== 肌群週容量目標 ====================
// 每個陣列代表 W1(MEV) → W2(MAV1) → W3(MAV2) → W4(MRV)
// 肌力期 (W6-W9) 固定使用 W1 值（MEV），重量遞增
// 減量週 (W5, W10) 使用 W1 值的 50%

export const VOLUME_CONFIG = {
  CHEST:     [10, 11, 12, 12],
  BACK:      [12, 14, 16, 18],
  SHOULDERS: [4, 5, 6, 6],
  SIDE_DELT: [8, 10, 12, 14],
  REAR_DELT: [8, 9, 10, 12],
  TRICEPS:   [8, 8, 9, 9],
  BICEPS:    [8, 9, 10, 12],
  QUADS:     [10, 12, 14, 16],
  HAMS:      [8, 10, 12, 14],
  CALVES:    [10, 12, 14, 14],
};

// ==================== 單動作組數上限 ====================

export const MAX_SETS_PER_EXERCISE = 4;

// ==================== 週期配置 ====================

export const PHASE_CONFIG = {
  hypertrophy: { weeks: [1, 2, 3, 4], compound: '8-12', isolation: '10-15', label: '肌肥大期' },
  strength:    { weeks: [6, 7, 8, 9], compound: '3-6',  isolation: '8-10',  label: '肌力期' },
  deload:      { weeks: [5, 10],      compound: '8-12', isolation: '10-15', label: '減量週' },
};

// ==================== 訓練菜單 ====================
// 5 練固定週：A → B → C → D → E（依序輪替、不綁星期）

export const WORKOUTS = {
  A: {
    name: 'PUSH A',
    subtitle: '水平推力 + 腿前/小腿補刀',
    type: 'push',
    exercises: [
      { id: 'bp_flat', name: '平板槓鈴臥推', muscle: 'CHEST', type: 'compound', isUpper: true },
      { id: 'bp_incline_db', name: '上斜啞鈴臥推', muscle: 'CHEST', type: 'compound', isUpper: true },
      { id: 'lateral_raise', name: '啞鈴側平舉', muscle: 'SIDE_DELT', type: 'isolation', isUpper: true },
      { id: 'lateral_raise_lean', name: '傾斜側平舉', muscle: 'SIDE_DELT', type: 'isolation', isUpper: true },
      { id: 'tri_pushdown', name: '繩索三頭下壓', muscle: 'TRICEPS', type: 'isolation', isUpper: true },
      { id: 'tri_cross_body', name: '跨體三頭伸展', muscle: 'TRICEPS', type: 'isolation', isUpper: true },
      { id: 'leg_ext', name: '機械腿伸直', muscle: 'QUADS', type: 'isolation', isUpper: false },
      { id: 'calf_standing_a', name: '機械站姿提踵', muscle: 'CALVES', type: 'isolation', isUpper: false },
    ]
  },
  B: {
    name: 'PULL A',
    subtitle: '垂直拉力 + 腿後/小腿補刀',
    type: 'pull',
    exercises: [
      { id: 'pullup', name: '引體向上', muscle: 'BACK', type: 'compound', isUpper: true },
      { id: 'db_row', name: '單臂啞鈴划船', muscle: 'BACK', type: 'compound', isUpper: true },
      { id: 'seated_row', name: '坐姿划船', muscle: 'BACK', type: 'isolation', isUpper: true },
      { id: 'rear_fly', name: '反向飛鳥（後三角）', muscle: 'REAR_DELT', type: 'isolation', isUpper: true },
      { id: 'rear_delt_cable', name: '繩索後三角飛鳥', muscle: 'REAR_DELT', type: 'isolation', isUpper: true },
      { id: 'bi_curl', name: '啞鈴二頭彎舉', muscle: 'BICEPS', type: 'isolation', isUpper: true },
      { id: 'bi_preacher', name: '牧師椅彎舉', muscle: 'BICEPS', type: 'isolation', isUpper: true },
      { id: 'seated_leg_curl_b', name: '坐姿腿彎舉', muscle: 'HAMS', type: 'isolation', isUpper: false },
      { id: 'calf_seated_b', name: '坐姿提踵', muscle: 'CALVES', type: 'isolation', isUpper: false },
    ]
  },
  C: {
    name: 'PUSH B',
    subtitle: '垂直推力 + 雙槓 + 腿前/小腿補刀（脊椎友善）',
    type: 'push',
    exercises: [
      { id: 'db_press_seated', name: '坐姿啞鈴肩推', muscle: 'SHOULDERS', type: 'compound', isUpper: true },
      { id: 'machine_press', name: '機械肩推', muscle: 'SHOULDERS', type: 'compound', isUpper: true },
      { id: 'tri_dips', name: '雙槓臂屈伸（身體前傾、胸偏）', muscle: 'CHEST', type: 'compound', isUpper: true },
      { id: 'lateral_raise_cable', name: '單臂滑輪側平舉', muscle: 'SIDE_DELT', type: 'isolation', isUpper: true },
      { id: 'lateral_raise_machine', name: '機械側平舉', muscle: 'SIDE_DELT', type: 'isolation', isUpper: true },
      { id: 'tri_overhead_seated', name: '坐姿過頭三頭伸展', muscle: 'TRICEPS', type: 'isolation', isUpper: true },
      { id: 'single_leg_press', name: '單腿腿推', muscle: 'QUADS', type: 'compound', isUpper: false },
      { id: 'calf_standing_c', name: '機械站姿提踵', muscle: 'CALVES', type: 'isolation', isUpper: false },
    ]
  },
  D: {
    name: 'PULL B',
    subtitle: '水平拉力 + 腿後/小腿補刀（腿彎舉強制 RIR 2–3、保護腿日 RDL）',
    type: 'pull',
    exercises: [
      { id: 'chest_supported_row', name: '胸靠支撐划船', muscle: 'BACK', type: 'compound', isUpper: true },
      { id: 'pulldown_narrow', name: '窄距下拉', muscle: 'BACK', type: 'compound', isUpper: true },
      { id: 'straight_arm_pd', name: '直臂下拉', muscle: 'BACK', type: 'isolation', isUpper: true },
      { id: 'face_pull', name: '滑輪面拉', muscle: 'REAR_DELT', type: 'isolation', isUpper: true },
      { id: 'rear_delt_machine', name: '機械反向飛鳥（後三角）', muscle: 'REAR_DELT', type: 'isolation', isUpper: true },
      { id: 'bi_hammer', name: '錘式彎舉', muscle: 'BICEPS', type: 'isolation', isUpper: true },
      { id: 'bi_cable', name: '繩索彎舉', muscle: 'BICEPS', type: 'isolation', isUpper: true },
      { id: 'lying_leg_curl_d', name: '俯臥腿彎舉', muscle: 'HAMS', type: 'isolation', isUpper: false, noteRIR: '2-3' },
      { id: 'calf_seated_d', name: '坐姿提踵', muscle: 'CALVES', type: 'isolation', isUpper: false },
    ]
  },
  E: {
    name: 'LEGS',
    subtitle: '腿部複合動作集中日',
    type: 'legs',
    exercises: [
      { id: 'leg_press', name: '腿推（45°）', muscle: 'QUADS', type: 'compound', isUpper: false },
      { id: 'bulgarian_split_db', name: '保加利亞分腿蹲（啞鈴垂兩側）', muscle: 'QUADS', type: 'compound', isUpper: false },
      { id: 'rdl_db', name: '啞鈴羅馬尼亞硬舉', muscle: 'HAMS', type: 'compound', isUpper: false, noteText: '建議使用助握帶（lifting straps）' },
      { id: 'back_ext_45', name: '45° 背伸展（負重於胸前）', muscle: 'HAMS', type: 'compound', isUpper: false },
      { id: 'calf_standing_heavy', name: '機械站姿提踵（重負荷）', muscle: 'CALVES', type: 'isolation', isUpper: false },
      { id: 'calf_press_legpress', name: '腿推提踵', muscle: 'CALVES', type: 'isolation', isUpper: false },
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
  HAMS: '腿後側',
  CALVES: '小腿',
};

// ==================== Superset 配對 ====================
// 第一動作做完 → 15 秒切換 → 第二動作做完 → 休息 rest 秒 → 重複
// 複合動作（compound）不參與 superset、保持直線組與 2–3 分鐘休息

export const SUPERSET_PAIRS = {
  A: [
    { primary: 'lateral_raise', secondary: 'tri_pushdown', rest: 75 },
    { primary: 'lateral_raise_lean', secondary: 'tri_cross_body', rest: 75 },
  ],
  B: [
    { primary: 'rear_fly', secondary: 'bi_curl', rest: 75 },
    { primary: 'rear_delt_cable', secondary: 'bi_preacher', rest: 75 },
  ],
  C: [
    { primary: 'lateral_raise_cable', secondary: 'tri_overhead_seated', rest: 75 },
    { primary: 'lateral_raise_machine', secondary: 'tri_overhead_seated', rest: 75 },
  ],
  D: [
    { primary: 'face_pull', secondary: 'bi_hammer', rest: 75 },
    { primary: 'rear_delt_machine', secondary: 'bi_cable', rest: 75 },
  ],
  E: [
    { primary: 'rdl_db', secondary: 'calf_standing_heavy', rest: 90 },
  ],
};

// ==================== Session 類型配色 ====================
// 給 Day Selector 與 session 標題使用

export const SESSION_TYPE_THEME = {
  push: {
    accentText: 'text-rose-400',
    accentBg: 'bg-rose-500',
    activeBtn: 'bg-rose-500 text-black border-rose-500 shadow-lg',
    label: '推',
  },
  pull: {
    accentText: 'text-blue-400',
    accentBg: 'bg-blue-500',
    activeBtn: 'bg-blue-500 text-black border-blue-500 shadow-lg',
    label: '拉',
  },
  legs: {
    accentText: 'text-orange-400',
    accentBg: 'bg-orange-500',
    activeBtn: 'bg-orange-500 text-black border-orange-500 shadow-lg',
    label: '腿',
  },
};

// ==================== 動作庫預設資料 ====================

const collectFromWorkouts = () => {
  const seen = new Set();
  const list = [];
  Object.values(WORKOUTS).forEach(w => {
    w.exercises.forEach(ex => {
      if (!seen.has(ex.id)) {
        seen.add(ex.id);
        list.push({
          id: ex.id,
          name: ex.name,
          muscle: ex.muscle,
          type: ex.type,
          defaultSets: 3,
        });
      }
    });
  });
  return list;
};

const EXTRA_LIBRARY_ITEMS = [
  // CHEST（僅限推類：平板 / 上斜 / 雙槓三大類、無飛鳥）
  { id: 'lib_flat_db_press', name: '平板啞鈴臥推', muscle: 'CHEST', type: 'compound', defaultSets: 3 },
  { id: 'lib_machine_press_flat', name: '平板機械胸推', muscle: 'CHEST', type: 'compound', defaultSets: 3 },
  { id: 'lib_machine_press_incline', name: '上斜機械胸推', muscle: 'CHEST', type: 'compound', defaultSets: 3 },
  { id: 'lib_smith_incline', name: 'Smith 上斜臥推', muscle: 'CHEST', type: 'compound', defaultSets: 3 },
  { id: 'lib_smith_flat', name: 'Smith 平板臥推', muscle: 'CHEST', type: 'compound', defaultSets: 3 },
  { id: 'lib_weighted_dips', name: '負重雙槓臂屈伸', muscle: 'CHEST', type: 'compound', defaultSets: 3 },
  { id: 'lib_incline_bb_press', name: '上斜槓鈴臥推', muscle: 'CHEST', type: 'compound', defaultSets: 3 },

  // BACK
  { id: 'lib_pulldown_wide', name: '寬握高位下拉', muscle: 'BACK', type: 'compound', defaultSets: 3 },
  { id: 'lib_t_bar_row_chest', name: 'T-Bar 划船（胸靠版）', muscle: 'BACK', type: 'compound', defaultSets: 3 },
  { id: 'lib_machine_row', name: '機械划船', muscle: 'BACK', type: 'compound', defaultSets: 3 },

  // SHOULDERS（無站姿軸向動作）
  { id: 'lib_arnold_press_seated', name: '坐姿阿諾肩推', muscle: 'SHOULDERS', type: 'compound', defaultSets: 3 },
  { id: 'lib_smith_seated_press', name: 'Smith 坐姿肩推', muscle: 'SHOULDERS', type: 'compound', defaultSets: 3 },

  // SIDE_DELT
  { id: 'lib_lateral_raise_machine_alt', name: '單臂機械側平舉', muscle: 'SIDE_DELT', type: 'isolation', defaultSets: 3 },

  // REAR_DELT（限有支撐版本）
  { id: 'lib_rear_delt_db_chest', name: '胸靠俯身啞鈴飛鳥（後三角）', muscle: 'REAR_DELT', type: 'isolation', defaultSets: 3 },

  // TRICEPS
  { id: 'lib_skullcrusher', name: '骷髏粉碎機', muscle: 'TRICEPS', type: 'isolation', defaultSets: 3 },
  { id: 'lib_close_grip_bp', name: '窄握臥推', muscle: 'TRICEPS', type: 'compound', defaultSets: 3 },
  { id: 'lib_tri_rope_overhead_seated', name: '坐姿繩索過頭三頭', muscle: 'TRICEPS', type: 'isolation', defaultSets: 3 },

  // BICEPS
  { id: 'lib_bi_concentration', name: '集中彎舉', muscle: 'BICEPS', type: 'isolation', defaultSets: 3 },
  { id: 'lib_bi_ez_curl', name: 'EZ 槓彎舉', muscle: 'BICEPS', type: 'isolation', defaultSets: 3 },
  { id: 'lib_bi_incline_db', name: '上斜啞鈴彎舉', muscle: 'BICEPS', type: 'isolation', defaultSets: 3 },

  // QUADS（脊椎友善替代、無軸向加壓）
  { id: 'lib_belt_squat', name: 'Belt squat（首選、若場館可用）', muscle: 'QUADS', type: 'compound', defaultSets: 3 },
  { id: 'lib_pendulum_squat_noload', name: 'Pendulum 深蹲（限無肩墊版本）', muscle: 'QUADS', type: 'compound', defaultSets: 3 },
  { id: 'lib_sissy_squat', name: 'Sissy squat', muscle: 'QUADS', type: 'isolation', defaultSets: 3 },
  { id: 'lib_step_up_db', name: '啞鈴登階（啞鈴垂兩側）', muscle: 'QUADS', type: 'compound', defaultSets: 3 },
  { id: 'lib_leg_ext_alt', name: '機械腿伸直（替代）', muscle: 'QUADS', type: 'isolation', defaultSets: 3 },

  // HAMS（脊椎友善替代）
  { id: 'lib_nordic_curl', name: 'Nordic 腿彎舉', muscle: 'HAMS', type: 'isolation', defaultSets: 3 },
  { id: 'lib_cable_pullthrough', name: '繩索 Pull-through', muscle: 'HAMS', type: 'compound', defaultSets: 3 },
  { id: 'lib_reverse_hyper', name: 'Reverse Hyper（若場館可用）', muscle: 'HAMS', type: 'isolation', defaultSets: 3 },
  { id: 'lib_machine_hip_hinge', name: '機械 Hip Hinge', muscle: 'HAMS', type: 'compound', defaultSets: 3 },
  { id: 'lib_glute_ham_raise', name: 'Glute-Ham Raise', muscle: 'HAMS', type: 'isolation', defaultSets: 3 },

  // CALVES
  { id: 'lib_calf_donkey', name: 'Donkey 提踵', muscle: 'CALVES', type: 'isolation', defaultSets: 3 },
  { id: 'lib_calf_single_leg_db', name: '單腿啞鈴提踵', muscle: 'CALVES', type: 'isolation', defaultSets: 3 },
  { id: 'lib_calf_smith_standing', name: 'Smith 站姿提踵', muscle: 'CALVES', type: 'isolation', defaultSets: 3 },
  { id: 'lib_calf_seated_alt', name: '坐姿提踵（替代）', muscle: 'CALVES', type: 'isolation', defaultSets: 3 },
];

export const DEFAULT_EXERCISE_LIBRARY = [
  ...collectFromWorkouts(),
  ...EXTRA_LIBRARY_ITEMS,
];

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
