import "./global.css";
import React, { useState, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  View,
  StyleSheet,
  Text,
  Animated,
} from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { supabase } from './src/config/supabase';

// Main app screens
import TabNavigator from './src/navigation/TabNavigator';
import DetailScreen from './src/screens/DetailScreen';
import ManualEntryScreen from './src/screens/ManualEntryScreen';
import ScanGalleryScreen from './src/screens/ScanGalleryScreen';
import { ScanProvider } from './src/context/ScanContext';
import { ProcessingProvider } from './src/context/ProcessingContext';
import SettingsScreen from './src/screens/SettingsScreen';
import ProfileEditScreen from './src/screens/ProfileEditScreen';
import NotificationScreen from './src/screens/NotificationScreen';
import CurrencyScreen from './src/screens/CurrencyScreen';
import HelpSupportScreen from './src/screens/HelpSupportScreen';
import ExportScreen from './src/screens/ExportScreen';
import ReviewReceiptScreen from './src/screens/ReviewReceiptScreen';
import { NotificationProvider } from './src/context/NotificationContext';
import CategoryScreen from './src/screens/CategoryScreen';
import { CreditsProvider } from './src/context/CreditsContext';


// Auth screens
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';


const Stack = createNativeStackNavigator();

const App = () => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showToast, setShowToast] = useState(false);
  const justRegistered = useRef(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);

      // Configure RevenueCat when user is logged in
      if (session?.user?.id) {
        Purchases.setLogLevel(LOG_LEVEL.DEBUG);
        Purchases.configure({
          apiKey: 'appl_GiQmBRqwOePBykUbDJzEsrsrlEj',
          appUserID: session.user.id,
        });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);

      // Configure RevenueCat on auth state change (login/logout)
      if (session?.user?.id) {
        Purchases.setLogLevel(LOG_LEVEL.DEBUG);
        Purchases.configure({
          apiKey: 'appl_GiQmBRqwOePBykUbDJzEsrsrlEj',
          appUserID: session.user.id,
        });
      }

      if (session && justRegistered.current) {
        justRegistered.current = false;
        setTimeout(() => {
          setShowToast(true);
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }).start(() => {
            setTimeout(() => {
              Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
              }).start(() => setShowToast(false));
            }, 2000);
          });
        }, 400);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleRegistrationStart = () => {
    justRegistered.current = true;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1A3A6B" />
      </View>
    );
  }

  return (
    <>
      <ScanProvider>
        <NotificationProvider>
          <CreditsProvider>
            <ProcessingProvider>
                <NavigationContainer>
                  <Stack.Navigator screenOptions={{ headerShown: false }}>
                    {session ? (
                      <>
                        <Stack.Screen name="Main" component={TabNavigator} />
                        <Stack.Screen name="Detail" component={DetailScreen} />
                      
                        <Stack.Screen
                          name="ManualEntry"
                          component={ManualEntryScreen}
                          options={{ animation: 'slide_from_right' }}
                        />
                        <Stack.Screen
                        name="Settings"
                        component={SettingsScreen}
                        options={{ animation: 'slide_from_right' }}
                        />
                        <Stack.Screen 
                        name="ReviewReceipt" 
                        component={ReviewReceiptScreen} 
                        options={{ headerShown: false }} 
                        />
                        <Stack.Screen
                        name="ScanGallery"
                        component={ScanGalleryScreen}
                        options={{ animation: 'slide_from_left' }}
                        />
                        <Stack.Screen
                        name="ProfileEdit"
                        component={ProfileEditScreen}
                        options={{ animation: 'slide_from_right' }}
                        />
                        <Stack.Screen
                        name="CurrencyRegion"
                        component={CurrencyScreen}
                        options={{ animation: 'slide_from_right' }}
                        />
                        <Stack.Screen
                        name="HelpSupport"
                        component={HelpSupportScreen}
                        options={{ animation: 'slide_from_right' }}
                        />
                        <Stack.Screen
                        name="ExportDocuments"
                        component={ExportScreen}
                        options={{ animation: 'slide_from_right' }}
                        />
                        <Stack.Screen
                        name="Categories"
                        component={CategoryScreen}
                        options={{ animation: 'slide_from_right' }}
                        />    
                        <Stack.Screen name="Notifications" component={NotificationScreen} />
                      </>
                    ) : (
                      <>
                        <Stack.Screen
                          name="Login"
                          component={LoginScreen}
                          options={{ animationTypeForReplace: 'pop' }}
                        />
                        <Stack.Screen name="Register">
                          {(props) => (
                            <RegisterScreen
                              {...props}
                              onRegistrationStart={handleRegistrationStart}
                            />
                          )}
                        </Stack.Screen>
                      </>
                    )}
                  </Stack.Navigator>
              </NavigationContainer>
            </ProcessingProvider>
          </CreditsProvider>
        </NotificationProvider>
      </ScanProvider>
      {/* Simple toast message */}
      {showToast && (
        <Animated.View style={[styles.toast, { opacity: fadeAnim }]}>
          <Text style={styles.toastText}>✓ Account created successfully!</Text>
        </Animated.View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAF8F4',
  },
  toast: {
    position: 'absolute',
    top: 60,
    left: 24,
    right: 24,
    backgroundColor: '#2A8C5C',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  toastText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default App;