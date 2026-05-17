## Context

`training-plan-v3-final` 將 antagonist isolation 改為 superset 配對執行、但計時 UI 沿用「單動作直線組」時代的邏輯。`TrainingView.jsx` 內：

- `calculateRestTime(currentLogKey, previousLogKey)` 與 `getCurrentRestTime(previousLogKey)` 以同動作相鄰組為單位計算（line 167-180）
- 個別 set 列底下渲染「休息時間 / 休息中」inline 文字（line 714-738）
- pair 兩成員渲染時、`renderExerciseInner` 被以 `hideInterRest: true` 呼叫（line 855）、把該 pair 內所有 set 的 inter-exercise rest 也一併隱藏
- 後續單動作的 `previousExerciseLastSetKey` 取 `currentSessionPlan[flatIdx - 1]` 的最後一組（line 478-480）、在 pair 之後就是 secondary 的最後一組、未考慮 primary 較晚完成的情形

`superset-execution` 已有 requirement 規範「配對動作完成一輪後休息 75 / 90 秒、UI 計時 SHALL 採用該值」、但實作上沒有 round 概念、計時表現失真。

本 change 不動 logs schema、不動 `useRestNotification`、不動 `SUPERSET_PAIRS`、只重寫 `TrainingView.jsx` 內與配對休息呈現相關的 derived state 與渲染。

## Goals / Non-Goals

**Goals：**

- 在 pair 內部、以 round 為單位計算與顯示休息時間、語意對齊 spec
- 把休息訊息從個別 set 列搬到 pair 卡片頂端 sticky bar、唯一來源
- 修正進入 pair、離開 pair 兩個邊界的「動作間休息」行為（一個失蹤、一個算錯）
- 維持單動作（非 pair）動作的休息 UI 不變、回歸最小破壞
- 純 derived state 實作、不引入新 logs 欄位、不寫遷移

**Non-Goals：**

- 不處理 `useRestNotification` 的 context-aware delay（pair 內 60s vs 全域 90s）→ 下一個 change
- 不調整 `SUPERSET_PAIRS` 結構與 rest 數值
- 不重排個別動作 set 的編輯 UI（保留兩動作上下並列形態）
- 不修改 logs schema 或 localStorage migration
- 不調整 60 分鐘超時警示
- 不處理 pair 整體的拖曳排序行為（已 work）

## Decisions

### D1：以純 derived state 計算 round 狀態、不引入新 logs 欄位

**選擇**：在 `TrainingView.jsx` 內以 `useMemo` 從 `logs` 派生每個 pair 的 round 狀態與 timestamp。

**理由**：
- `logs` 已記錄 `done`、`skipped`、`completedAt`、所有 round 推論所需訊息完備
- 避免 schema migration、降低相容性風險（CLAUDE.md 明示 schema 變更需評估相容性）
- derived state 易於單元測試、給定 logs 子集就能驗證輸出

**捨棄替代**：
- 在 logs 加 `roundIdx`、`pairId` 欄位：浪費、需 v4→v5 migration、且使用者反覆 toggle done / skipped 時 derived 結果一致而欄位易過期
- 在 React state 維護 `roundProgress`：與 logs 同步成本高、無 single source of truth

### D2：sticky bar 黏在 pair 卡片內部、非全域 sticky

**選擇**：sticky bar 用 `position: sticky; top: 0` 於 pair 卡片內部，離開 pair 後自然解除黏附。

**理由**：
- 同時間最多只關心一個 pair、bar 跟著 pair 自然進出視野
- 避免全域 sticky 佔用整個畫面頂部空間、與 60 分鐘超時 banner、Day Selector 競爭
- pair 卡片有自己的橘色配色、bar 沿用配色不需額外顏色協調

**捨棄替代**：
- 畫面右下角 FAB：手機右下被瀏覽器 UI 與虛擬鍵盤遮蔽風險高
- 畫面頂部 fixed bar：佔用過多空間、與 Day Selector 視覺競爭、且離開 pair 後也仍佔位
- inline 顯示於 pair 底部：使用者在 pair 內捲動編輯 set 時看不到

### D3：mid-round 顯示「切換中」、不算入 rest 目標

**選擇**：pair 內某 round 的兩組「恰好一個 settled」時、狀態為 `mid-round`、bar 顯示「⏱ 切換中: m:ss」、不顯示 rest 目標。

**理由**：
- 使用者明顯不在「休息」、是在做 partner 動作或切換中
- 把該時間誤標為 rest 會讓使用者誤判「已休息夠了、可以開下一輪」
- 採 amber 色與 `between-rounds` 的 emerald 區分、減少誤判

**捨棄替代**：
- mid-round 不顯示任何 timer：使用者看不到 partner 切換成本、無法回顧 superset 節奏
- mid-round 顯示同樣的 rest 倒數：違反 rest 語意、且超時染紅會誤導

### D4：pair end timestamp 取 `max(A_last, B_last).completedAt`

**選擇**：離開 pair 的 inter-exercise rest 起算點 = 兩成員最後一組中較晚完成者的 `completedAt`、僅納入 `done === true` 的組。

**理由**：
- 嚴格 round-robin 下、secondary 結束較晚屬常見、但非保證；使用者也可能先把 A 做完再補 B
- max 是「pair 真正結束」最自然的定義、無歧義
- 若兩組之一 skipped、取剩下 done 的；若都 skipped、回退到再上一輪 end_ts

**捨棄替代**：
- 固定取 secondary 的最後一組：現行錯誤、忽略 primary 較晚的情形
- 取 primary：對稱問題、同樣不對
- 取 round-by-round 的最後 end_ts：等價於 max、實作較繞

### D5：tail set（A/B 組數不等）回退單動作語意

**選擇**：若 pair 中 A、B 設不同組數、超出較少者的 tail 組（例如 B_3 沒有 A_3）視為「single tail」、回退為「同動作上一組 completedAt 起算」的單動作 inline rest。

**理由**：
- tail 組已脫離 round 概念、強行套 round 反而扭曲
- 單動作邏輯已穩定、直接重用
- tail 出現條件需使用者主動 `adjustExerciseSets` 改變 pair 成員組數、屬於非預設行為

**捨棄替代**：
- 限制 pair 兩動作組數必須一致：與既有 `adjustExerciseSets` 自由度衝突
- tail 組顯示在 sticky bar 並以 single-tail 狀態呈現：增加狀態機複雜度

### D6：round dots 放 sticky bar 左側

**選擇**：sticky bar 左側顯示兩列 round dots（A、B 各 N 個）、實心 / 空心 / 斜線分別代表 done / pending / skipped。

**理由**：
- 一眼掃到「在第幾輪、誰結束了沒」、不需滾動上下找
- 與 timer 同行、屬於配對進度的視覺總覽、訊息高度聚合
- N 通常 3–4 個、橫向空間充足（手機 375px 寬扣掉 bar 內邊距仍 > 200px）

**捨棄替代**：
- dots 內嵌於個別動作卡片標題：與既有 `completedCount/setsCount` 文字重複
- dots 放 pair 卡片底部：與 TMJ 提示競爭、且離 timer 太遠失去聚合感

## Risks / Trade-offs

**[Risk] sticky 在 PWA 中於某些瀏覽器表現異常（例如 iOS Safari 過去有 `position: sticky` 與 overflow ancestor 的衝突）** → Mitigation：實作時驗證 iOS Safari 與 Chrome 行動版兩個目標瀏覽器；若有 ancestor overflow 問題、改為 pair 卡片內以 `top: 0` 的 sticky 包一層 `position: relative` container；最差情況退回 `position: fixed` + offset 計算。

**[Risk] round dots 在不等組數時顯示突兀（A 列 3 個、B 列 4 個）** → Mitigation：以「pair core round 數 = min(A_sets, B_sets)」決定主要 dots 數、tail 組另以「+1」尾標表示；單元測試覆蓋此案例。

**[Risk] 移除個別 set 列的「休息時間」之後、使用者回顧紀錄時找不到本輪實際耗時** → Mitigation：本 change 不處理；若日後有需求、可在 set 列保留「完成時間」絕對 timestamp 或 round 總耗時 metadata；不阻擋本 change。

**[Risk] 與 `training-plan-v3-final` 父 change 的 capability 版本衝突** → Mitigation：本 change 的 spec delta 寫在自己的 `specs/` 目錄、以 MODIFIED Requirement 形式表達；父 change archive 後、本 change archive 時會基於父 change 的最終 spec 套用 delta；若父 change 在本 change 落地前先 archive、`openspec/specs/superset-execution/spec.md` 與 `workout-execution-ui/spec.md` 會存在、套 delta 不衝突；若反序、需在 archive 階段協調。

**[Trade-off] 純 derived state 在每次 logs 更新都重算所有 pair 狀態** → 接受；pair 數量小（≤ 2 per session）、round 數 ≤ 4、計算量微小、不需 memoize 到細粒度。

**[Trade-off] mid-round 顯示「切換中」會增加 UI 訊息密度** → 接受；該訊息對 superset 節奏掌握有實際價值、且 sticky bar 內容已預留位置。

## Migration Plan

無 schema 變更、無需資料遷移。前端純渲染重構：

1. 部署後使用者既有 `logs` 不變、原本錯誤的 inline rest 文字會消失、改由 sticky bar 呈現
2. 進入 pair 與離開 pair 的邊界訊息會自動修正（依現有 completedAt 推算）
3. 無 rollback 風險、只需 git revert 該 commit

## Open Questions

無。所有設計細節已於 explore 階段對齊。
