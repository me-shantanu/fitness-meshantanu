import { Alert, AlertButton, Platform } from 'react-native';

// Alert.alert is a no-op on react-native-web, so route through
// window.alert / window.confirm there.
export function showAlert(title: string, message?: string, buttons?: AlertButton[]) {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }
  const text = message ? `${title}\n\n${message}` : title;
  if (!buttons || buttons.length <= 1) {
    window.alert(text);
    buttons?.[0]?.onPress?.();
    return;
  }
  const confirmBtn = buttons.find(b => b.style !== 'cancel');
  const cancelBtn = buttons.find(b => b.style === 'cancel');
  if (window.confirm(text)) {
    confirmBtn?.onPress?.();
  } else {
    cancelBtn?.onPress?.();
  }
}
