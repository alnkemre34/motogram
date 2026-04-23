import type {
  WsBadgeEarnedPayload,
  WsEmergencyNearbyPayload,
  WsEmergencyResolvedPayload,
  WsEmergencyResponderUpdatedPayload,
  WsQuestCompletedPayload,
} from '@motogram/shared';
import { create } from 'zustand';

import { capOverlayQueue } from '../lib/p7-overlay-queue';

export type P7OverlayItem =
  | { id: string; at: number; kind: 'quest'; payload: WsQuestCompletedPayload }
  | { id: string; at: number; kind: 'badge'; payload: WsBadgeEarnedPayload }
  | { id: string; at: number; kind: 'emergencyNearby'; payload: WsEmergencyNearbyPayload }
  | { id: string; at: number; kind: 'emergencyResponder'; payload: WsEmergencyResponderUpdatedPayload }
  | { id: string; at: number; kind: 'emergencyResolved'; payload: WsEmergencyResolvedPayload };

interface P7State {
  items: P7OverlayItem[];
  pushQuest: (p: WsQuestCompletedPayload) => void;
  pushBadge: (p: WsBadgeEarnedPayload) => void;
  pushEmergencyNearby: (p: WsEmergencyNearbyPayload) => void;
  pushEmergencyResponder: (p: WsEmergencyResponderUpdatedPayload) => void;
  pushEmergencyResolved: (p: WsEmergencyResolvedPayload) => void;
  dismiss: (id: string) => void;
  clear: () => void;
}

export const useP7RealtimeStore = create<P7State>((set) => ({
  items: [],

  pushQuest: (payload) =>
    set((s) => ({
      items: capOverlayQueue(s.items, {
        id: `q-${payload.questId}-${Date.now()}`,
        at: Date.now(),
        kind: 'quest',
        payload,
      }),
    })),

  pushBadge: (payload) =>
    set((s) => ({
      items: capOverlayQueue(s.items, {
        id: `b-${payload.badgeId}-${Date.now()}`,
        at: Date.now(),
        kind: 'badge',
        payload,
      }),
    })),

  pushEmergencyNearby: (payload) =>
    set((s) => ({
      items: capOverlayQueue(s.items, {
        id: `en-${payload.alertId}-${Date.now()}`,
        at: Date.now(),
        kind: 'emergencyNearby',
        payload,
      }),
    })),

  pushEmergencyResponder: (payload) =>
    set((s) => ({
      items: capOverlayQueue(s.items, {
        id: `er-${payload.alertId}-${payload.responderId}-${Date.now()}`,
        at: Date.now(),
        kind: 'emergencyResponder',
        payload,
      }),
    })),

  pushEmergencyResolved: (payload) =>
    set((s) => ({
      items: capOverlayQueue(s.items, {
        id: `ex-${payload.alertId}-${Date.now()}`,
        at: Date.now(),
        kind: 'emergencyResolved',
        payload,
      }),
    })),

  dismiss: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),

  clear: () => set({ items: [] }),
}));
