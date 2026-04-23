import { create } from 'zustand';
import type {
  PartyDetail,
  PartyMemberDto,
  PartyStatus,
  WsPartyMemberUpdatedPayload,
  WsPartySignalReceivedPayload,
} from '@motogram/shared';

import { applyPartyStatusChange } from '../lib/party-ws-helpers';

// Spec 9.6 - Zustand senkron UI state (parti + HUD + canli uye konumlari)

export interface LiveMemberState {
  userId: string;
  lat: number;
  lng: number;
  heading?: number | null;
  speed?: number | null;
  timestamp: number;
}

export interface PartySignalToast {
  id: string;
  partyId: string;
  senderId: string;
  senderName: string;
  type: WsPartySignalReceivedPayload['type'];
  timestamp: number;
}

interface PartyState {
  party: PartyDetail | null;
  connected: boolean;
  liveMembers: Record<string, LiveMemberState>;
  recentSignals: PartySignalToast[];
  setParty: (party: PartyDetail | null) => void;
  clearParty: () => void;
  setConnected: (c: boolean) => void;
  setPartyStatus: (status: PartyStatus) => void;
  upsertMember: (member: PartyMemberDto) => void;
  removeMember: (userId: string) => void;
  setLeader: (leaderId: string) => void;
  updateLiveMember: (payload: WsPartyMemberUpdatedPayload) => void;
  pushSignal: (signal: WsPartySignalReceivedPayload) => void;
  dismissSignal: (id: string) => void;
}

export const usePartyStore = create<PartyState>((set) => ({
  party: null,
  connected: false,
  liveMembers: {},
  recentSignals: [],

  setParty: (party) =>
    set(() => ({
      party,
      liveMembers: party ? {} : {},
      recentSignals: [],
    })),

  clearParty: () =>
    set(() => ({ party: null, liveMembers: {}, recentSignals: [] })),

  setConnected: (connected) => set(() => ({ connected })),

  setPartyStatus: (status) =>
    set((state) => {
      if (!state.party) return state;
      return { party: applyPartyStatusChange(state.party, status) };
    }),

  upsertMember: (member) =>
    set((state) => {
      if (!state.party) return state;
      const members = state.party.members.filter((m) => m.userId !== member.userId);
      members.push(member);
      return {
        party: { ...state.party, members, memberCount: members.length },
      };
    }),

  removeMember: (userId) =>
    set((state) => {
      if (!state.party) return state;
      const members = state.party.members.filter((m) => m.userId !== userId);
      const { [userId]: _removed, ...liveMembers } = state.liveMembers;
      return {
        party: { ...state.party, members, memberCount: members.length },
        liveMembers,
      };
    }),

  setLeader: (leaderId) =>
    set((state) => {
      if (!state.party) return state;
      const members = state.party.members.map((m) => ({
        ...m,
        role: m.userId === leaderId ? ('LEADER' as const) : m.role === 'LEADER' ? ('MEMBER' as const) : m.role,
      }));
      return { party: { ...state.party, leaderId, members } };
    }),

  updateLiveMember: (payload) =>
    set((state) => ({
      liveMembers: {
        ...state.liveMembers,
        [payload.userId]: {
          userId: payload.userId,
          lat: payload.lat,
          lng: payload.lng,
          heading: payload.heading ?? null,
          speed: payload.speed ?? null,
          timestamp: payload.timestamp,
        },
      },
    })),

  pushSignal: (signal) =>
    set((state) => {
      const id = `${signal.senderId}-${signal.timestamp}-${signal.type}`;
      const recentSignals = [
        { id, ...signal },
        ...state.recentSignals.filter((s) => s.id !== id),
      ].slice(0, 5);
      return { recentSignals };
    }),

  dismissSignal: (id) =>
    set((state) => ({
      recentSignals: state.recentSignals.filter((s) => s.id !== id),
    })),
}));
