import { useCallback, useEffect } from 'react';
import {
  WS_EVENTS,
  WsPartyEndedSchema,
  WsPartyErrorSchema,
  WsPartyLeaderChangedSchema,
  WsPartyMemberJoinedSchema,
  WsPartyMemberLeftSchema,
  WsPartyMemberUpdatedSchema,
  WsPartySignalReceivedSchema,
  WsPartyStatusChangedSchema,
  type PartySignalType,
  type WsPartyUpdateLocationPayload,
} from '@motogram/shared';
import type { Socket } from 'socket.io-client';

import { connectSocket, getSocket } from '../lib/socket';
import { captureException } from '../lib/sentry';
import { wsEmitClient, wsOnServerParsed } from '../lib/ws-typed';
import { usePartyStore } from '../store/party.store';

export interface UsePartyResult {
  connected: boolean;
  sendLocation: (p: Omit<WsPartyUpdateLocationPayload, 'partyId'>) => void;
  sendSignal: (type: PartySignalType) => void;
  leave: () => void;
}

export function useParty(partyId: string | null | undefined): UsePartyResult {
  const connected = usePartyStore((s) => s.connected);
  const setConnected = usePartyStore((s) => s.setConnected);
  const upsertMember = usePartyStore((s) => s.upsertMember);
  const removeMember = usePartyStore((s) => s.removeMember);
  const setLeader = usePartyStore((s) => s.setLeader);
  const clearParty = usePartyStore((s) => s.clearParty);
  const setPartyStatus = usePartyStore((s) => s.setPartyStatus);
  const updateLiveMember = usePartyStore((s) => s.updateLiveMember);
  const pushSignal = usePartyStore((s) => s.pushSignal);
  const party = usePartyStore((s) => s.party);

  useEffect(() => {
    if (!partyId) return;
    const socket: Socket = connectSocket();

    const onConnect = () => {
      setConnected(true);
      wsEmitClient(socket, WS_EVENTS.partyJoin, { partyId });
    };
    const onDisconnect = () => setConnected(false);
    const onError = (err: unknown) => captureException(err);

    const unsub: Array<() => void> = [];

    unsub.push(
      wsOnServerParsed(socket, WS_EVENTS.partyMemberJoined, WsPartyMemberJoinedSchema, (p) => {
        if (p.partyId !== partyId) return;
        upsertMember(p.member);
      }),
    );
    unsub.push(
      wsOnServerParsed(socket, WS_EVENTS.partyMemberLeft, WsPartyMemberLeftSchema, (p) => {
        if (p.partyId !== partyId) return;
        removeMember(p.userId);
      }),
    );
    unsub.push(
      wsOnServerParsed(socket, WS_EVENTS.partyMemberUpdated, WsPartyMemberUpdatedSchema, (p) => {
        if (p.partyId !== partyId) return;
        updateLiveMember(p);
      }),
    );
    unsub.push(
      wsOnServerParsed(socket, WS_EVENTS.partyLeaderChanged, WsPartyLeaderChangedSchema, (p) => {
        if (p.partyId !== partyId) return;
        setLeader(p.newLeaderId);
      }),
    );
    unsub.push(
      wsOnServerParsed(socket, WS_EVENTS.partyStatusChanged, WsPartyStatusChangedSchema, (p) => {
        if (p.partyId !== partyId) return;
        setPartyStatus(p.status);
      }),
    );
    unsub.push(
      wsOnServerParsed(socket, WS_EVENTS.partySignalReceived, WsPartySignalReceivedSchema, (p) => {
        if (p.partyId !== partyId) return;
        pushSignal(p);
      }),
    );
    unsub.push(
      wsOnServerParsed(socket, WS_EVENTS.partyEnded, WsPartyEndedSchema, (p) => {
        if (p.partyId !== partyId) return;
        clearParty();
      }),
    );
    unsub.push(
      wsOnServerParsed(socket, WS_EVENTS.partyError, WsPartyErrorSchema, (p) => {
        captureException(new Error(`[WS] ${p.event} ${p.code}: ${p.message}`));
      }),
    );

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onError);

    if (socket.connected) onConnect();

    return () => {
      if (socket.connected) {
        wsEmitClient(socket, WS_EVENTS.partyLeave, { partyId });
      }
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onError);
      unsub.forEach((u) => u());
    };
  }, [
    partyId,
    setConnected,
    setPartyStatus,
    upsertMember,
    removeMember,
    updateLiveMember,
    setLeader,
    pushSignal,
    clearParty,
  ]);

  const sendLocation = useCallback(
    (payload: Omit<WsPartyUpdateLocationPayload, 'partyId'>) => {
      if (!partyId) return;
      const socket = getSocket();
      if (!socket.connected) return;
      wsEmitClient(socket, WS_EVENTS.partyUpdateLocation, { ...payload, partyId });
    },
    [partyId],
  );

  const sendSignal = useCallback(
    (type: PartySignalType) => {
      if (!partyId) return;
      const socket = getSocket();
      if (!socket.connected) return;
      wsEmitClient(socket, WS_EVENTS.partySendSignal, {
        partyId,
        type,
        clientTimestamp: Date.now(),
      });
    },
    [partyId],
  );

  const leave = useCallback(() => {
    if (!partyId) return;
    const socket = getSocket();
    if (!socket.connected) return;
    wsEmitClient(socket, WS_EVENTS.partyLeave, { partyId });
  }, [partyId]);

  return { connected: connected && Boolean(party), sendLocation, sendSignal, leave };
}
