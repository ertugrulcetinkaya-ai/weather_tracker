import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';

import { checkBackendHealth } from './src/api/health';

type ConnectionState = 'checking' | 'connected' | 'disconnected';

export default function App() {
  const [connection, setConnection] = useState<ConnectionState>('checking');

  const runHealthCheck = useCallback(async () => {
    setConnection('checking');
    try {
      await checkBackendHealth();
      setConnection('connected');
    } catch {
      setConnection('disconnected');
    }
  }, []);

  useEffect(() => {
    runHealthCheck();
  }, [runHealthCheck]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hava Takip</Text>
      {connection === 'checking' && <Text>Backend kontrol ediliyor...</Text>}
      {connection === 'connected' && <Text>Backend: Bağlı</Text>}
      {connection === 'disconnected' && (
        <>
          <Text>Backend: Bağlantı Yok</Text>
          <Button title="Tekrar Dene" onPress={runHealthCheck} />
        </>
      )}
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
});
