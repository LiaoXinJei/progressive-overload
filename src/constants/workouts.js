export const WORKOUTS = {
  A: {
    name: 'PUSH A',
    subtitle: '水平推力 + 微量腿前',
    type: 'push',
    exercises: [
      { id: 'bp_flat', name: '平板槓鈴臥推', muscle: 'CHEST', baseSets: 2, increments: true, isUpper: true, repRange: '5-8' },
      { id: 'bp_incline_db', name: '上斜啞鈴臥推', muscle: 'CHEST', baseSets: 2, increments: true, isUpper: true, repRange: '8-10' },
      { id: 'lateral_raise', name: '啞鈴側平舉', muscle: 'SIDE_DELT', baseSets: 2, increments: false, isUpper: true, repRange: '10-15' },
      { id: 'tri_pushdown', name: '繩索三頭下壓', muscle: 'TRICEPS', baseSets: 2, increments: false, isUpper: true, repRange: '10-12' },
      { id: 'leg_ext', name: '機械腿伸直', muscle: 'QUADS', baseSets: 2, increments: false, isUpper: false, repRange: '12-15' }
    ]
  },
  B: {
    name: 'PULL A',
    subtitle: '垂直拉力 + 微量腿後',
    type: 'pull',
    exercises: [
      { id: 'pullup', name: '引體向上', muscle: 'BACK', baseSets: 2, increments: true, isUpper: true, repRange: '6-8' },
      { id: 'db_row', name: '單臂啞鈴划船', muscle: 'BACK', baseSets: 2, increments: true, isUpper: true, repRange: '8-10' },
      { id: 'rear_fly', name: '反向飛鳥', muscle: 'REAR_DELT', baseSets: 2, increments: false, isUpper: true, repRange: '12-15' },
      { id: 'bi_curl', name: '啞鈴二頭彎舉', muscle: 'BICEPS', baseSets: 2, increments: false, isUpper: true, repRange: '10-12' },
      { id: 'leg_curl', name: '機械腿彎舉', muscle: 'HAMS', baseSets: 2, increments: false, isUpper: false, repRange: '10-12' }
    ]
  },
  C: {
    name: 'PUSH B',
    subtitle: '垂直推力（純上半身）',
    type: 'push',
    exercises: [
      { id: 'ohp', name: '站姿肩推', muscle: 'SHOULDERS', baseSets: 2, increments: true, isUpper: true, repRange: '6-8' },
      { id: 'tri_dips', name: '雙槓臂屈伸', muscle: 'CHEST', baseSets: 2, increments: true, isUpper: true, repRange: '8-10' },
      { id: 'lateral_raise_cable', name: '單臂滑輪側平舉', muscle: 'SIDE_DELT', baseSets: 2, increments: false, isUpper: true, repRange: '10-15' },
      { id: 'tri_overhead', name: '過頭三頭伸展', muscle: 'TRICEPS', baseSets: 2, increments: false, isUpper: true, repRange: '10-12' },
      { id: 'fly_cable', name: '繩索飛鳥', muscle: 'CHEST', baseSets: 2, increments: false, isUpper: true, repRange: '10-12' }
    ]
  },
  D: {
    name: 'PULL B',
    subtitle: '水平拉力（純上半身）',
    type: 'pull',
    exercises: [
      { id: 'bb_row', name: '槓鈴划船', muscle: 'BACK', baseSets: 2, increments: true, isUpper: true, repRange: '6-8' },
      { id: 'pulldown_narrow', name: '窄距下拉', muscle: 'BACK', baseSets: 2, increments: true, isUpper: true, repRange: '8-10' },
      { id: 'face_pull', name: '滑輪面拉', muscle: 'REAR_DELT', baseSets: 2, increments: false, isUpper: true, repRange: '12-15' },
      { id: 'bi_hammer', name: '錘式彎舉', muscle: 'BICEPS', baseSets: 2, increments: false, isUpper: true, repRange: '10-12' },
      { id: 'straight_arm_pd', name: '直臂下拉', muscle: 'BACK', baseSets: 2, increments: false, isUpper: true, repRange: '12-15' }
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
  HAMS: '腿後側'
};
