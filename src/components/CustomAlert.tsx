// components/CustomAlert.tsx
import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { useThemeStore } from '@/store/useThemeStore';

interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface CustomAlertProps {
  visible: boolean;
  title: string;
  message?: string;
  buttons?: AlertButton[];
  onDismiss?: () => void;
}

export function CustomAlert({ 
  visible, 
  title, 
  message, 
  buttons = [{ text: 'OK' }],
  onDismiss 
}: CustomAlertProps) {
  const { vars, mode } = useThemeStore();

  const handleButtonPress = (button: AlertButton) => {
    if (button.onPress) {
      button.onPress();
    }
    if (onDismiss) {
      onDismiss();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={vars} key={mode} className="flex-1 bg-black/50 justify-center items-center px-4">
        <View className="bg-surface rounded-2xl w-full max-w-sm p-6">
          {/* Title */}
          <Text className="text-text text-xl font-bold mb-3 text-center">
            {title}
          </Text>

          {/* Message */}
          {message && (
            <Text className="text-text-light text-center mb-6">
              {message}
            </Text>
          )}

          {/* Buttons */}
          <View className={`flex-row ${buttons.length === 1 ? 'justify-center' : 'justify-between'} gap-3`}>
            {buttons.map((button, index) => {
              const isCancel = button.style === 'cancel';
              const isDestructive = button.style === 'destructive';

              return (
                <TouchableOpacity
                  key={index}
                  className={`flex-1 py-3 rounded-xl ${
                    isDestructive 
                      ? 'bg-red-500' 
                      : isCancel 
                        ? 'bg-gray-700' 
                        : 'bg-blue-600'
                  }`}
                  onPress={() => handleButtonPress(button)}
                >
                  <Text className={`text-center font-bold ${
                    isDestructive 
                      ? 'text-white' 
                      : isCancel 
                        ? 'text-gray-300' 
                        : 'text-white'
                  }`}>
                    {button.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Hook for easier usage
export function useCustomAlert() {
  const [alertConfig, setAlertConfig] = React.useState<{
    visible: boolean;
    title: string;
    message?: string;
    buttons?: AlertButton[];
  }>({
    visible: false,
    title: '',
    message: '',
    buttons: []
  });

  const showAlert = (
    title: string,
    message?: string,
    buttons?: AlertButton[]
  ) => {
    setAlertConfig({
      visible: true,
      title,
      message,
      buttons: buttons || [{ text: 'OK' }]
    });
  };

  const hideAlert = () => {
    setAlertConfig(prev => ({ ...prev, visible: false }));
  };

  const AlertComponent = (
    <CustomAlert
      {...alertConfig}
      onDismiss={hideAlert}
    />
  );

  return { showAlert, hideAlert, AlertComponent };
}