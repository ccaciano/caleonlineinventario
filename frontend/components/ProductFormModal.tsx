import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import Modal from 'react-native-modal';
import { createProduct, updateProduct, Product } from '../services/api';

interface ProductFormModalProps {
  visible: boolean;
  product: Product | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ProductFormModal({
  visible,
  product,
  onClose,
  onSuccess,
}: ProductFormModalProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    ean: '',
    description: '',
  });

  useEffect(() => {
    if (product) {
      setFormData({
        code: product.code,
        ean: product.ean,
        description: product.description,
      });
    } else {
      setFormData({
        code: '',
        ean: '',
        description: '',
      });
    }
  }, [product, visible]);

  const handleSave = async () => {
    if (!formData.code || !formData.ean || !formData.description) {
      Alert.alert(t('fillAllFields'));
      return;
    }

    try {
      setLoading(true);
      if (product && product._id) {
        // Update existing product
        await updateProduct(product._id, formData);
        Alert.alert(t('productUpdated'));
      } else {
        // Create new product
        await createProduct(formData);
        Alert.alert(t('productAdded'));
      }
      onSuccess();
    } catch (error) {
      console.error('Error saving product:', error);
      Alert.alert('Erro', error instanceof Error ? error.message : 'Falha ao salvar produto');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setFormData({ code: '', ean: '', description: '' });
      onClose();
    }
  };

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={handleClose}
      onBackButtonPress={handleClose}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      backdropOpacity={0.5}
      style={styles.modal}
    >
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>
            {product ? t('editProduct') : t('addProduct')}
          </Text>
          <TouchableOpacity onPress={handleClose} disabled={loading}>
            <Ionicons name="close" size={28} color="#8E8E93" />
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('productCode')}</Text>
            <TextInput
              style={styles.input}
              value={formData.code}
              onChangeText={(text) => setFormData({ ...formData, code: text })}
              placeholder={t('productCode')}
              placeholderTextColor="#999"
              editable={!loading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('ean')}</Text>
            <TextInput
              style={styles.input}
              value={formData.ean}
              onChangeText={(text) => setFormData({ ...formData, ean: text })}
              placeholder={t('ean')}
              placeholderTextColor="#999"
              editable={!loading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('description')}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              placeholder={t('description')}
              placeholderTextColor="#999"
              multiline
              numberOfLines={3}
              editable={!loading}
            />
          </View>

          <View style={styles.buttons}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>{t('cancel')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.saveButton, loading && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>
                  {product ? t('updateProduct') : t('addProduct')}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    minHeight: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
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
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#000',
    minHeight: 52,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  button: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  cancelButton: {
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
