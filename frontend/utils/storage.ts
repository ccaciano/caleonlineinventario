import AsyncStorage from '@react-native-async-storage/async-storage';
import { StoreConfig } from '../services/api';

const STORE_CONFIG_KEY = '@store_config';

export const saveStoreConfigLocal = async (config: StoreConfig): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORE_CONFIG_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('Error saving store config locally:', error);
    throw error;
  }
};

export const getStoreConfigLocal = async (): Promise<StoreConfig | null> => {
  try {
    const value = await AsyncStorage.getItem(STORE_CONFIG_KEY);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error('Error getting store config locally:', error);
    return null;
  }
};
