import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import {
  WS_EVENTS,
  WsBadgeEarnedSchema,
  WsEmergencyNearbySchema,
  WsEmergencyResolvedSchema,
  WsEmergencyResponderUpdatedSchema,
  WsQuestCompletedSchema,
} from '@motogram/shared';

import { connectEmergencySocket, getEmergencySocket } from '../lib/emergency-socket';
import { connectGamificationSocket, getGamificationSocket } from '../lib/gamification-socket';
import { queryClient } from '../lib/query-client';
import { wsOnServerParsed } from '../lib/ws-typed';
import { useAuthStore } from '../store/auth.store';
import { useP7RealtimeStore } from '../store/p7-realtime.store';

// Spec 3.7 + 2.3.2 — P7.3 `/gamification` + P7.4 `/emergency` (Blueprint §14.2)

export function useP7RealtimeWebSockets(): void {
  const isAuthenticated = useAuthStore((s) => Boolean(s.accessToken && s.userId));

  useEffect(() => {
    if (!isAuthenticated) {
      useP7RealtimeStore.getState().clear();
      getGamificationSocket().disconnect();
      getEmergencySocket().disconnect();
      return;
    }

    const st = useP7RealtimeStore.getState();
    const g = connectGamificationSocket();
    const e = connectEmergencySocket();

    const onQuest = (p: Parameters<typeof st.pushQuest>[0]) => {
      st.pushQuest(p);
      void queryClient.invalidateQueries({ queryKey: ['my-quests'] });
      void queryClient.invalidateQueries({ queryKey: ['me'] });
    };
    const onBadge = (p: Parameters<typeof st.pushBadge>[0]) => {
      st.pushBadge(p);
      void queryClient.invalidateQueries({ queryKey: ['my-badges'] });
      void queryClient.invalidateQueries({ queryKey: ['me'] });
    };

    const ug1 = wsOnServerParsed(g, WS_EVENTS.questCompleted, WsQuestCompletedSchema, onQuest);
    const ug2 = wsOnServerParsed(g, WS_EVENTS.badgeEarned, WsBadgeEarnedSchema, onBadge);
    const ue1 = wsOnServerParsed(
      e,
      WS_EVENTS.emergencyNearby,
      WsEmergencyNearbySchema,
      (p) => st.pushEmergencyNearby(p),
    );
    const ue2 = wsOnServerParsed(
      e,
      WS_EVENTS.emergencyResponderUpdated,
      WsEmergencyResponderUpdatedSchema,
      (p) => st.pushEmergencyResponder(p),
    );
    const ue3 = wsOnServerParsed(
      e,
      WS_EVENTS.emergencyResolved,
      WsEmergencyResolvedSchema,
      (p) => st.pushEmergencyResolved(p),
    );

    return () => {
      ug1();
      ug2();
      ue1();
      ue2();
      ue3();
      useP7RealtimeStore.getState().clear();
      g.disconnect();
      e.disconnect();
    };
  }, [isAuthenticated]);

  // Pil / arka plan: gamification + emergency soketlerini kes; ön planda yeniden baglan
  useEffect(() => {
    if (!isAuthenticated) return;
    const onApp = (s: AppStateStatus) => {
      if (s === 'active') {
        connectGamificationSocket();
        connectEmergencySocket();
      } else {
        getGamificationSocket().disconnect();
        getEmergencySocket().disconnect();
      }
    };
    const sub = AppState.addEventListener('change', onApp);
    return () => sub.remove();
  }, [isAuthenticated]);
}
