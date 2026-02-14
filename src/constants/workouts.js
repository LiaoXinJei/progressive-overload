export const WORKOUTS = {
  A: {
    name: 'PUSH A',
    subtitle: '胸主導 + 三頭',
    type: 'push',
    exercises: [
      { id: 'bp_flat', name: '平板槓鈴臥推', muscle: 'CHEST', baseSets: 4, isUpper: true },
      { id: 'bp_incline', name: '上斜啞鈴臥推', muscle: 'CHEST', baseSets: 3, isUpper: true },
      { id: 'fly_cable', name: '繩索飛鳥', muscle: 'CHEST', baseSets: 3, isUpper: true },
      { id: 'tri_pushdown', name: '繩索三頭下壓', muscle: 'TRICEPS', baseSets: 3, isUpper: true },
      { id: 'tri_overhead', name: '過頭三頭伸展', muscle: 'TRICEPS', baseSets: 2, isUpper: true }
    ]
  },
  B: {
    name: 'PULL A',
    subtitle: '背部厚度主導 + 二頭',
    type: 'pull',
    exercises: [
      { id: 'bb_row', name: '槓鈴划船', muscle: 'BACK', baseSets: 4, isUpper: true },
      { id: 'pulldown', name: '滑輪下拉', muscle: 'BACK', baseSets: 3, isUpper: true },
      { id: 'db_row', name: '單臂啞鈴划船', muscle: 'BACK', baseSets: 3, isUpper: true },
      { id: 'bi_curl', name: '槓鈴彎舉', muscle: 'BICEPS', baseSets: 3, isUpper: true },
      { id: 'bi_hammer', name: '錘式彎舉', muscle: 'BICEPS', baseSets: 2, isUpper: true }
    ]
  },
  C: {
    name: 'PUSH B',
    subtitle: '肩膀主導 + 上胸',
    type: 'push',
    exercises: [
      { id: 'ohp', name: '站姿肩推', muscle: 'SHOULDERS', baseSets: 4, isUpper: true },
      { id: 'lateral_raise', name: '啞鈴側平舉', muscle: 'SIDE_DELT', baseSets: 4, isUpper: true },
      { id: 'bp_incline_bb', name: '上斜槓鈴臥推', muscle: 'CHEST', baseSets: 3, isUpper: true },
      { id: 'tri_dips', name: '三頭臂屈伸', muscle: 'TRICEPS', baseSets: 3, isUpper: true }
    ]
  },
  D: {
    name: 'PULL B',
    subtitle: '背部細節主導 + 後三角',
    type: 'pull',
    exercises: [
      { id: 'pullup', name: '引體向上', muscle: 'BACK', baseSets: 3, isUpper: true },
      { id: 'cable_row', name: '坐姿划船', muscle: 'BACK', baseSets: 3, isUpper: true },
      { id: 'face_pull', name: '繩索面拉', muscle: 'REAR_DELT', baseSets: 3, isUpper: true },
      { id: 'rear_fly', name: '反向飛鳥', muscle: 'REAR_DELT', baseSets: 3, isUpper: true },
      { id: 'bi_cable', name: '繩索彎舉', muscle: 'BICEPS', baseSets: 2, isUpper: true }
    ]
  },
  E: {
    name: 'LEGS',
    subtitle: '下肢功能維持',
    type: 'legs',
    exercises: [
      { id: 'sq_low_bar', name: '低槓深蹲', muscle: 'QUADS', baseSets: 3, isUpper: false },
      { id: 'rdl', name: '羅馬尼亞硬舉', muscle: 'HAMS', baseSets: 3, isUpper: false },
      { id: 'leg_press', name: '腿推舉', muscle: 'QUADS', baseSets: 2, isUpper: false },
      { id: 'calf_raise', name: '站姿提踵', muscle: 'CALVES', baseSets: 3, isUpper: false }
    ]
  }
};

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
  CALVES: '小腿'
};
