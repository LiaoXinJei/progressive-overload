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

// lastCompletedAt: timestamp of the most recent completed set in current day
// restNotificationDelay: seconds to wait before notifying (e.g. 90)
export const useRestNotification = ({ lastCompletedAt, restNotificationDelay }) => {
  const scheduledRef = useRef(false);
  const lastCompletedAtRef = useRef(lastCompletedAt);
  const delayRef = useRef(restNotificationDelay);

  useEffect(() => { lastCompletedAtRef.current = lastCompletedAt; }, [lastCompletedAt]);
  useEffect(() => { delayRef.current = restNotificationDelay; }, [restNotificationDelay]);

  const schedule = useCallback(async () => {
    const ts = lastCompletedAtRef.current;
    if (!ts) return;
    if (Notification.permission !== 'granted') return;

    const elapsed = Date.now() - ts;
    const remaining = delayRef.current * 1000 - elapsed;
    if (remaining <= 0) return;

    const mins = Math.floor(delayRef.current / 60);
    const secs = String(delayRef.current % 60).padStart(2, '0');

    await postToSW({
      type: 'SCHEDULE_NOTIFICATION',
      delay: remaining,
      title: '休息結束！',
      body: `已休息 ${mins}:${secs}，該做下一組了！`,
    });
    scheduledRef.current = true;
  }, []);

  const cancel = useCallback(async () => {
    if (!scheduledRef.current) return;
    await postToSW({ type: 'CANCEL_NOTIFICATION' });
    scheduledRef.current = false;
  }, []);

  // Cancel when user returns to app or logs a new set
  useEffect(() => {
    if (!document.hidden) cancel();
  }, [lastCompletedAt, cancel]);

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
