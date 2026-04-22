export enum ImpactFeedbackStyle {
  Light = 'Light',
  Medium = 'Medium',
  Heavy = 'Heavy',
}

export enum NotificationFeedbackType {
  Success = 'Success',
  Warning = 'Warning',
  Error = 'Error',
}

export async function impactAsync(_style?: ImpactFeedbackStyle): Promise<void> {
  return undefined;
}

export async function notificationAsync(_type?: NotificationFeedbackType): Promise<void> {
  return undefined;
}

export default { impactAsync, notificationAsync };
