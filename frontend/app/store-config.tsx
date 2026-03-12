import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { saveStoreConfig, getStoreConfig, StoreConfig, clearAllData } from '../services/api';

export default function StoreConfigScreen() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<StoreConfig>({
    store_id: '',
    store_name: '',
    email: '',
    manager_phone: '',
    manager_name: '',
  });

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const config = await getStoreConfig();
      if (config) {
        setFormData(config);
      }
    } catch (error) {
      console.error('Error loading config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Validate required fields only (Código da Loja e Nome da Loja)
    if (!formData.store_id || !formData.store_name) {
      Alert.alert('Atenção', 'Preencha os campos obrigatórios: Código da Loja e Nome da Loja');
      return;
    }

    try {
      setLoading(true);
      await saveStoreConfig(formData);
      Alert.alert(t('configSaved'));
    } catch (error) {
      console.error('Error saving config:', error);
      Alert.alert('Erro', 'Falha ao salvar configuração');
    } finally {
      setLoading(false);
    }
  };

  const handleClearAllData = () => {
    Alert.alert(
      'Limpar Todos os Dados',
      'ATENÇÃO: Esta ação irá apagar permanentemente:\n\n• Configuração da Loja\n• Todos os Produtos\n• Todos os Inventários\n\nEsta ação não pode ser desfeita. Deseja continuar?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Apagar Tudo',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await clearAllData();
              setFormData({
                store_id: '',
                store_name: '',
                email: '',
                manager_phone: '',
                manager_name: '',
              });
              Alert.alert('Sucesso', 'Todos os dados foram apagados com sucesso!');
            } catch (error) {
              console.error('Error clearing data:', error);
              Alert.alert('Erro', 'Falha ao limpar os dados');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  if (loading && !formData.store_id) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('storeConfigTitle')}</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('storeId')}</Text>
            <TextInput
              style={styles.input}
              value={formData.store_id}
              onChangeText={(text) => setFormData({ ...formData, store_id: text })}
              placeholder={t('storeId')}
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('storeName')}</Text>
            <TextInput
              style={styles.input}
              value={formData.store_name}
              onChangeText={(text) => setFormData({ ...formData, store_name: text })}
              placeholder={t('storeName')}
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('email')}</Text>
            <TextInput
              style={styles.input}
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
              placeholder={t('email')}
              placeholderTextColor="#999"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('managerPhone')}</Text>
            <TextInput
              style={styles.input}
              value={formData.manager_phone}
              onChangeText={(text) => setFormData({ ...formData, manager_phone: text })}
              placeholder={t('managerPhone')}
              placeholderTextColor="#999"
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('managerName')}</Text>
            <TextInput
              style={styles.input}
              value={formData.manager_name}
              onChangeText={(text) => setFormData({ ...formData, manager_name: text })}
              placeholder={t('managerName')}
              placeholderTextColor="#999"
            />
          </View>

          <TouchableOpacity
            style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
                <Text style={styles.saveButtonText}>{t('saveConfig')}</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.clearButton, loading && styles.clearButtonDisabled]}
            onPress={handleClearAllData}
            disabled={loading}
          >
            <Ionicons name="trash-outline" size={24} color="#FFFFFF" />
            <Text style={styles.clearButtonText}>Limpar Todos os Dados</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#000',
    minHeight: 52,
  },
  saveButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    minHeight: 56,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  clearButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 32,
    minHeight: 56,
  },
  clearButtonDisabled: {
    opacity: 0.6,
  },
  clearButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
