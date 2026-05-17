## 1. 常數層

- [x] 1.1 替換 `src/constants/workouts.js` 的 `VOLUME_CONFIG`（CHEST/TRICEPS/QUADS/HAMS 改值、新增 CALVES）
- [x] 1.2 在 `MUSCLE_GROUPS` 加入 `CALVES: '小腿'`
- [x] 1.3 替換 `WORKOUTS.A` 動作清單（移除 pec_deck、新增 calf_standing_a）
- [x] 1.4 替換 `WORKOUTS.B` 動作清單（移除 leg_curl、新增 seated_leg_curl_b、calf_seated_b）
- [x] 1.5 替換 `WORKOUTS.C` 動作清單（移除 ohp/fly_cable/bp_machine/tri_kickback、新增 machine_press/single_leg_press/calf_standing_c、tri_overhead 改為 tri_overhead_seated）
- [x] 1.6 替換 `WORKOUTS.D` 動作清單（移除 bb_row、新增 chest_supported_row/lying_leg_curl_d/calf_seated_d、lying_leg_curl_d 帶 `noteRIR: '2-3'`）
- [x] 1.7 新增 `WORKOUTS.E` (LEGS, `type: 'legs'`)、含 6 個動作、`rdl_db` 帶 `noteText`
- [x] 1.8 替換 `EXTRA_LIBRARY_ITEMS`（依規格 §7）
- [x] 1.9 新增 `SUPERSET_PAIRS` export（A/B/C/D/E 五個 session 配對）
- [x] 1.10 新增 `SESSION_TYPE_THEME` map（push/pull/legs → className）

## 2. Migration（App.jsx）

- [x] 2.1 在 `App.jsx:107-147` useEffect 加入 `REMOVED_IDS` 與 `RENAMED_IDS` 兩個 const
- [x] 2.2 撰寫 history 清除邏輯（迭代 REMOVED_IDS）
- [x] 2.3 撰寫 history 改名邏輯（迭代 RENAMED_IDS、複製+刪除）
- [x] 2.4 撰寫 logs key 清除與改寫邏輯
- [x] 2.5 撰寫 customSets / exerciseOverrides / customExercises / exerciseOrder 的清除邏輯
- [x] 2.6 加入進度重置：`setCurrentWeek(1)`、`setCurrentDay(0)`
- [x] 2.7 將 `schemaVersion` 寫回 4（`App.jsx:151`）
- [x] 2.8 確保 migration 冪等（已是 v4 不重複執行、不重置進度）
- [x] 2.9 包 try/catch 確保中途錯誤不寫回 localStorage

## 3. UI — Session 輪替與配色

- [x] 3.1 `TrainingView.jsx:32-34` `getWorkoutForDay` 陣列改為 `['A','B','C','D','E']`
- [x] 3.2 `TrainingView.jsx:402-421` Day Selector 從 4 按鈕擴為 5 按鈕（迴圈 `[0,1,2,3,4]`）
- [x] 3.3 套用 `SESSION_TYPE_THEME` 到 Day Selector 當前日按鈕與 session 標題
- [x] 3.4 確認 375px 寬手機尺寸下 5 按鈕不破版（grid-cols-5 + 縮小 padding）

## 4. UI — 動作卡片重構

- [x] 4.1 在 TrainingView 渲染前、依 `SUPERSET_PAIRS[currentSession]` 將 exercises 分組為 [pair, single, pair, ...] 結構
- [x] 4.2 實作配對卡片容器（含「🔗 SUPERSET · {rest}s」header）
- [x] 4.3 配對卡片底部加 TMJ 提示「💨 下顎放鬆 · 鼻吸口呼」
- [x] 4.4 動作卡片 header 區渲染 `noteRIR` 徽章「⚠ RIR {noteRIR}、不可至力竭」
- [x] 4.5 動作卡片 header 區渲染 `noteText` 灰字提示
- [x] 4.6 既有拖曳排序對配對卡片以「對」為單位運作（pair 整體拖、內部固定）

## 5. UI — 警示

- [x] 5.1 TrainingView 讀 `sessionDuration`（內部 derive 自 logs+currentTime）、判斷 `> 3600` 顯示超時橫幅
- [x] 5.2 超時橫幅文案「⏱ 已超時 X 分鐘、考慮跳過 1 組 isolation」、X 動態計算

## 6. UI — Fallback 防呆

- [x] 6.1 `TrainingView.jsx:531` `MUSCLE_GROUPS[ex.muscle]` 加 `?? '未知'` fallback
- [x] 6.2 `getSessionPlan` 對 `ex.muscle` 未定義時不崩、安全略過或顯示警告

## 7. 驗證

- [x] 7.1 `npm run build` 通過
- [ ] 7.2 `npm run dev` 啟動、手機 375px viewport 驗證所有 5 個 session 渲染正確（需使用者執行）
- [~] 7.3 驗證 W4 組數分配對得上規格 §5 末驗證表 — **程式推算發現 CHEST=10/12、HAMS=12/14、QUADS=13/16（規格已標）；CHEST/HAMS 落差源於 MAX_SETS_PER_EXERCISE=4 cap、需使用者決策**
- [ ] 7.4 驗證 D 的 `lying_leg_curl_d` 顯示 RIR 2-3 警示（需使用者執行）
- [ ] 7.5 驗證 E 的 `rdl_db` 顯示助握帶提示（需使用者執行）
- [ ] 7.6 驗證 A 的 `lateral_raise + tri_pushdown` 顯示為配對卡片（需使用者執行）
- [ ] 7.7 驗證 LEGS session 標籤呈橘 / 棕色（需使用者執行）
- [ ] 7.8 用備份的 v3 localStorage 跑 migration、驗證 history 改名 / 清除、進度重置、schemaVersion=4（需使用者執行）
- [ ] 7.9 清空 localStorage 跑全新使用者流程、驗證走預設值（需使用者執行）
- [x] 7.10 migration 冪等：`needsV4Migration` flag 確保已是 v4 時不重複執行進度重置
- [ ] 7.11 模擬 60 分鐘以上 session、驗證超時橫幅（需使用者執行）
- [ ] 7.12 驗證拖曳排序對配對卡片正常運作（需使用者執行）

## 8. 文件收尾

- [x] 8.1 更新 `docs/stories/index.md` 加入「腿部訓練計劃 v3 FINAL」實作對應
- [x] 8.2 評估：superset / migration 章節不在本次必要範圍、openspec 的 design.md 已涵蓋、可後續按需補
- [ ] 8.3 評估是否在 `CLAUDE.md` 的「修改指南速查」表加入 `SUPERSET_PAIRS` / `noteRIR` / `noteText` 條目（待使用者決定）

## 9. Archive

- [ ] 9.1 所有 task 完成 + 使用者驗證通過後執行 `openspec archive training-plan-v3-final`
