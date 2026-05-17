## Context

`fix-superset-rest-timer` 把 superset 內的 UI 計時改為 round 為單位、並引入配對狀態機（idle / mid-round / between-rounds / done）。但背景通知這條路仍是舊的：

- `useRestNotification`（src/hooks/useRestNotification.js）只認 `lastCompletedAt` 與單一 `restNotificationDelay`、不知道 pair 內部 round 結構
- `App.jsx` line 75-93 的 `restActive` 用「最近 completedAt → logKey → parse exerciseId、setIdx → 看同動作下一組」的線性假設、對 pair round-robin 無感
- 結果：使用者完成 lateral_raise_1（mid-round）時、會排一個 90 秒通知；但他 15 秒後就會做 tri_pushdown_1、根本不在休息

`fix-superset-rest-timer` 的 round derived state 目前實作於 `TrainingView.jsx` 的本地 helper。本 change 需要把它提升為共用、讓 `App.jsx` 也能用同一份計算判定通知 context、避免兩處實作漂移。

## Goals / Non-Goals

**Goals：**

- 通知排程語意與 UI 顯示完全對齊：UI 顯示「輪間休息: 75s」時、通知也用 75 秒
- mid-round 不排通知、避免在切換動作時被叮
- 共享 round derived state、`fix-superset-rest-timer` 與本 change 不重複實作
- 不破壞單動作（非 pair）的既有通知行為與設定頁 UX
- Service Worker 介面（接收 `{ delay, title, body }`）不變、降低變動面

**Non-Goals：**

- 不重做 UI（已由 `fix-superset-rest-timer` 處理）
- 不在設定頁加 pair 專屬 delay 選項（pair rest 取自 `SUPERSET_PAIRS` 配置、不開放使用者覆寫）
- 不處理通知文案 i18n / 客製化 / 聲音
- 不改 SUPERSET_PAIRS 結構

## Decisions

### D1：共享 `usePairRoundState` hook、把 round derived state 從 TrainingView 提升

**選擇**：新增 `src/hooks/usePairRoundState.js`、輸入 `{ logs, currentWeek, currentDay, workoutKey }`、回傳「每個 pair 的 round 狀態 + endTs」與 helper（`getPairForExerciseId`、`getRestContextForLog` 等）。`TrainingView.jsx` 與 `App.jsx` 都呼叫此 hook、是 round derived state 的 single source of truth。

**理由**：
- `fix-superset-rest-timer` 落地後、TrainingView 本地的 round 計算已成熟、抽出成本低
- 避免兩處實作漂移（UI 顯示 75s 但通知排 90s 之類）
- hook 內部仍是純 derived、不持有 mutable state、可隨意呼叫

**捨棄替代**：
- 把 round 計算放在 utility（純函數）：可行，但 `useMemo` 在 hook 內較自然、且未來若要 cache 跨元件可平滑改造
- 把 round 狀態提升到 React Context：過度設計、目前只有兩個消費者

### D2：`useRestNotification` 介面以 `restContext` 物件取代散落參數

**選擇**：

```js
useRestNotification({
  restContext: {
    type: 'idle' | 'in-set' | 'in-pair-mid-round' | 'in-pair-between-rounds' | 'between-exercises',
    delay,        // 秒、undefined 表示不排程
    anchorTs,     // 排程起算點、undefined 表示不排程
    notifyKey,    // 用來判別 context 是否變更、cancel 舊通知
  }
})
```

當 `restContext.notifyKey` 變更時、hook SHALL 先 cancel、再依新 type 決定是否 schedule。

**理由**：
- 既有介面 `(lastCompletedAt, restNotificationDelay)` 假設「永遠有一個 anchor + 全域 delay」、無法表達 mid-round「不排程」
- 把判斷「該不該排程」「delay 多少」上推到 `App.jsx`、hook 變純粹的「依指令排程或不排程」、責任邊界乾淨
- `notifyKey` 設計成 `${type}:${anchorTs}` 之類字串、避免 React 對物件引用的 stale closure 問題

**捨棄替代**：
- 保留舊介面、加 `pairRestOverride` 參數：拼貼、語意不清
- 把整個 round state 傳入 hook 由 hook 內推：耦合過深、難以單元測

### D3：mid-round 不排程通知

**選擇**：`restContext.type === 'in-pair-mid-round'` 時、`useRestNotification` SHALL 不排程任何通知（也 SHALL 取消任何已排程通知）。

**理由**：
- 使用者切換到 partner 動作（15-30 秒）、若叮一聲反而干擾節奏
- 「該開始 partner」這個提示應由 UI（mid-round sticky bar）即時呈現、不需背景通知
- 簡化判斷：mid-round 期間使用者通常在前景互動、Service Worker 通知本就無關緊要

**捨棄替代**：
- mid-round 排短促通知（例如 20 秒）提示「該換 partner」：增加複雜度且使用者通常已在前景

### D4：pair → 後續動作沿用全域 delay

**選擇**：當最近完成組為某 pair 的最後一輪、`restContext.type` SHALL 為 `between-exercises`、delay SHALL 為全域 `restNotificationDelay`、anchorTs SHALL 為 pair.end_ts。

**理由**：
- 離開 pair 之後、下一動作是獨立直線組、休息語意回到單動作
- 使用者已習慣的設定頁全域 delay 在此處仍適用、不需特例
- 與 UI 邏輯（離開 pair 後恢復 inline rest）對齊

### D5：設定頁不引入 pair 專屬 delay 設定

**選擇**：保留設定頁的 `restNotificationDelay` 為「非 pair 全域休息 delay」、不加 pair 設定欄位。pair delay 一律由 `SUPERSET_PAIRS[session][pairIdx].rest` 決定。

**理由**：
- pair rest 是訓練學設計的一部分、不該由使用者隨意覆寫
- 設定頁不膨脹、保留現有 UX
- 未來若需要、可在 `SUPERSET_PAIRS` 旁再加層覆寫、但屬於另一個 change

**捨棄替代**：
- 設定頁加「Superset 休息」獨立 slider：使用者操作面變大、訓練學意圖被稀釋

## Risks / Trade-offs

**[Risk] 與 `fix-superset-rest-timer` 的 round derived state 抽出時機若沒對齊、會留下兩處實作** → Mitigation：本 change 落地前先 PR review 確認 `fix-superset-rest-timer` 已合併；實作首步就是把 TrainingView 內的 round state 替換為共享 hook 的呼叫；測試覆蓋 UI 與通知共用同一份計算。

**[Risk] Service Worker 的通知取消在切換 context 時可能 race（例如 mid-round → between-rounds 切太快）** → Mitigation：`useRestNotification` 內以 `scheduledRef` 追蹤狀態、每次重新 schedule 前先 cancel；以 `notifyKey` 作為 dedupe 鍵；單元測（mock postMessage）覆蓋連續切換情境。

**[Risk] 前景操作期間 visibilitychange 邏輯與新 restContext 互動產生例外** → Mitigation：保留既有「前景時不 schedule」與「visibilitychange 觸發 schedule」行為；context 變更只影響「該不該/用什麼 delay」、不改變何時呼叫 schedule。

**[Trade-off] mid-round 不通知意味著如果使用者背景了 app 並超過 partner 切換時間、不會被提醒** → 接受；mid-round 通常 < 30 秒、使用者長時間背景代表已暫停訓練、本就不該被叮。

**[Trade-off] 通知 delay 隨 pair rest 變化、使用者不能像現在一樣全域調整** → 接受；對齊訓練學設計、與 UI 顯示一致。

## Migration Plan

無 schema 變更：

1. 部署後使用者既有 `restNotificationDelay` 設定仍生效、用於 `in-set` / `between-exercises` 兩種狀態
2. 既有當日 logs 不受影響、`restContext` 從 logs 即時推算、無需轉檔
3. 通知 UX 直接生效、無 feature flag
4. Rollback：git revert、回到 `fix-superset-rest-timer` 落地後的狀態（UI 正確、通知用全域 delay）

## Open Questions

1. mid-round 期間是否完全靜默通知、或保留「partner 切換提示」這類更短的通知？**暫定**：完全靜默、若使用者反映想要、後續 change 再加。
2. `notifyKey` 的 string 編碼是否需要納入 workoutKey 與 day index 以涵蓋日內切換 session 的場景？**暫定**：是、key 形如 `${workoutKey}:${day}:${type}:${anchorTs}`。
