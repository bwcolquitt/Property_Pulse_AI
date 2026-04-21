/**
 * Offline Photo Queue - stores photos locally when offline and retries upload when connected.
 *
 * Usage:
 *   import { queuePhoto, retryQueue, getQueueSize } from '@/utils/offlinePhotoQueue';
 *
 * Photos are stored as base64 in AsyncStorage under key 'offline_photo_queue'.
 * On each retry attempt, we iterate through the queue and attempt to POST to /api/media/upload.
 * Successful uploads are removed; failures stay for next retry.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import api from './api';

const QUEUE_KEY = 'offline_photo_queue_v1';

export interface QueuedPhoto {
  id: string;
  owner_type: string;   // 'issue' | 'checklist_item' | 'note'
  owner_id: string;
  media_type: string;   // 'photo' | 'video'
  base64_data: string;
  context?: any;        // extra metadata (e.g., { task_id, floor })
  queued_at: string;
  attempts: number;
  last_error?: string;
}

async function readQueue(): Promise<QueuedPhoto[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function writeQueue(q: QueuedPhoto[]) {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  } catch (e) {
    console.warn('Failed to persist offline photo queue', e);
  }
}

/** Try to upload immediately; if it fails, queue for retry. */
export async function uploadOrQueue(photo: Omit<QueuedPhoto, 'id' | 'queued_at' | 'attempts'>): Promise<{ uploaded: boolean; queued: boolean }> {
  try {
    const net = await NetInfo.fetch();
    if (net.isConnected && net.isInternetReachable !== false) {
      await api.post('/media/upload', {
        owner_type: photo.owner_type,
        owner_id: photo.owner_id,
        media_type: photo.media_type,
        base64_data: photo.base64_data,
      });
      return { uploaded: true, queued: false };
    }
  } catch (e) {
    // fall through to queue
  }
  await queuePhoto(photo);
  return { uploaded: false, queued: true };
}

/** Add a photo to the offline queue. */
export async function queuePhoto(photo: Omit<QueuedPhoto, 'id' | 'queued_at' | 'attempts'>) {
  const q = await readQueue();
  q.push({
    ...photo,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    queued_at: new Date().toISOString(),
    attempts: 0,
  });
  await writeQueue(q);
}

/** Current queue size. */
export async function getQueueSize(): Promise<number> {
  const q = await readQueue();
  return q.length;
}

export async function getQueue(): Promise<QueuedPhoto[]> {
  return readQueue();
}

export async function clearQueue() {
  await AsyncStorage.removeItem(QUEUE_KEY);
}

/** Attempt to upload every queued photo. Returns { uploaded, remaining }. */
export async function retryQueue(): Promise<{ uploaded: number; remaining: number; failed: number }> {
  const net = await NetInfo.fetch();
  if (!net.isConnected) return { uploaded: 0, remaining: (await readQueue()).length, failed: 0 };

  const q = await readQueue();
  const still: QueuedPhoto[] = [];
  let uploaded = 0;
  let failed = 0;
  for (const item of q) {
    try {
      await api.post('/media/upload', {
        owner_type: item.owner_type,
        owner_id: item.owner_id,
        media_type: item.media_type,
        base64_data: item.base64_data,
      });
      uploaded++;
    } catch (e: any) {
      still.push({ ...item, attempts: (item.attempts || 0) + 1, last_error: String(e?.message || e).slice(0, 200) });
      failed++;
    }
  }
  await writeQueue(still);
  return { uploaded, remaining: still.length, failed };
}

/** Start a background listener that retries whenever the network reconnects. */
let unsubscribe: (() => void) | null = null;
export function startBackgroundSync(onProgress?: (result: { uploaded: number; remaining: number }) => void) {
  if (unsubscribe) return;
  unsubscribe = NetInfo.addEventListener(async (state) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      const size = await getQueueSize();
      if (size > 0) {
        const r = await retryQueue();
        if (onProgress) onProgress({ uploaded: r.uploaded, remaining: r.remaining });
      }
    }
  });
}

export function stopBackgroundSync() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
}
