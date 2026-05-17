import { useEffect, useRef, useCallback } from 'react';

const getSW = async () => {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
};

const postToSW = async (message) => {
  const reg = await getSW();
  reg?.active?.postMessage(message);
};

export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  return Notification.requestPermission();
};

const SCHEDULABLE_TYPES = new Set([
  'in-set',
  'in-pair-between-rounds',
  'between-exercises',
]);

const buildMessage = (type, delay) => {
  const mins = Math.floor(delay / 60);
  const secs = String(delay % 60).padStart(2, '0');
  if (type === 'in-pair-between-rounds') {
    return {
      title: '輪間休息結束！',
      body: `已休息 ${mins}:${secs}，開始下一輪！`,
    };
  }
  if (type === 'between-exercises') {
    return {
      title: '休息結束！',
      body: `已休息 ${mins}:${secs}，繼續下一個動作！`,
    };
  }
  return {
    title: '休息結束！',
    body: `已休息 ${mins}:${secs}，該做下一組了！`,
  };
};

/**
 * 依 restContext 排程／取消休息結束通知。
 *
 * restContext 由 src/utils/pairRoundState.js#getRestContext 計算、
 * 形如 { type, delay, anchorTs, notifyKey }。
 *
 * 行為：
 *   - 當 type 不在 SCHEDULABLE_TYPES（如 idle、in-pair-mid-round）→ cancel
 *   - 當 notifyKey 變更 → cancel 既有、再依新 context 決定是否 schedule
 *   - schedule 內部依 visibilitychange：背景時排程、前景時 cancel
 */
export const useRestNotification = ({ restContext }) => {
  const scheduledRef = useRef(false);
  const ctxRef = useRef(restContext);

  useEffect(() => { ctxRef.current = restContext; }, [restContext]);

  const cancel = useCallback(async () => {
    if (!scheduledRef.current) return;
    await postToSW({ type: 'CANCEL_NOTIFICATION' });
    scheduledRef.current = false;
  }, []);

  const schedule = useCallback(async () => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    if (!SCHEDULABLE_TYPES.has(ctx.type)) return;
    if (ctx.delay == null || ctx.anchorTs == null) return;
    if (Notification.permission !== 'granted') return;

    const elapsed = Date.now() - ctx.anchorTs;
    const remaining = ctx.delay * 1000 - elapsed;
    if (remaining <= 0) return;

    const { title, body } = buildMessage(ctx.type, ctx.delay);
    await postToSW({
      type: 'SCHEDULE_NOTIFICATION',
      delay: remaining,
      title,
      body,
    });
    scheduledRef.current = true;
  }, []);

  // notifyKey 變更：先 cancel 舊通知；若前景則不再排程（schedule 由 visibilitychange 觸發）
  useEffect(() => {
    cancel();
    // 若 type 不可排程、保持取消狀態即可
    // 若可排程、待 visibilitychange 觸發 background 時 schedule
  }, [restContext?.notifyKey, cancel]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        schedule();
      } else {
        cancel();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [schedule, cancel]);
};
