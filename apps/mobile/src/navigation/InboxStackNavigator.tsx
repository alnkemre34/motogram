import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ConversationScreen } from '../screens/inbox/ConversationScreen';
import { InboxScreen } from '../screens/inbox/InboxScreen';

// Spec 2.5 - Mesajlar sekmesi stack: Inbox -> Conversation.

export type InboxStackParamList = {
  InboxRoot: undefined;
  Conversation: { id: string };
};

const Stack = createNativeStackNavigator<InboxStackParamList>();

export function InboxStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#111' }, headerTintColor: '#fff' }}>
      <Stack.Screen name="InboxRoot" component={InboxScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Conversation" component={ConversationScreen} options={{ title: 'Sohbet' }} />
    </Stack.Navigator>
  );
}
