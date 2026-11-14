import { FontAwesome } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';

type ToastProps = {
    visible: boolean;
    type: 'success' | 'error';
    text: string;
    onHide: () => void;
};

export function Toast({ visible, type, text, onHide }: ToastProps) {
    const translateY = useRef(new Animated.Value(-120)).current;
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (!visible) return;

        // Resetear valores cada vez que se muestra
        translateY.setValue(-120);
        opacity.setValue(0);

        // Animación de entrada: cae desde arriba y aparece
        Animated.parallel([
            Animated.spring(translateY, {
                toValue: 0,
                useNativeDriver: true,
                tension: 70,
                friction: 9,
            }),
            Animated.timing(opacity, {
                toValue: 1,
                duration: 250,
                useNativeDriver: true,
            }),
        ]).start();

        // Auto-ocultar después de 3.5 segundos
        const timer = setTimeout(() => {
            Animated.parallel([
                Animated.timing(translateY, {
                    toValue: -120,
                    duration: 250,
                    useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                    toValue: 0,
                    duration: 250,
                    useNativeDriver: true,
                }),
            ]).start(() => onHide());
        }, 3500);

        return () => clearTimeout(timer);
    }, [visible]);

    if (!visible) return null;

    return (
        <Animated.View
            style={{
                position: 'absolute',
                top: 60, // Debajo del notch/status bar
                left: 20,
                right: 20,
                zIndex: 9999,
                transform: [{ translateY }],
                opacity,
                elevation: 20, // Sombra en Android
            }}
        >
            <View
                className={`flex-row items-center p-4 rounded-2xl ${type === 'success' ? 'bg-emerald-500' : 'bg-red-500'
                    }`}
                style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.2,
                    shadowRadius: 12,
                }}
            >
                <FontAwesome
                    name={type === 'success' ? 'check-circle' : 'exclamation-circle'}
                    size={22}
                    color="#ffffff"
                />
                <Text className="text-white font-bold ml-3 flex-1 text-sm">
                    {text}
                </Text>
            </View>
        </Animated.View>
    );
}