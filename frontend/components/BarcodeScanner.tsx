import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import Modal from 'react-native-modal';
import { BarCodeScanner, BarCodeScannerProps } from 'expo-barcode-scanner';
import { Camera } from 'expo-camera';

interface BarcodeScannerComponentProps {
  visible: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}

export default function BarcodeScanner({ visible, onClose, onScan }: BarcodeScannerComponentProps) {
  const { t } = useTranslation();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  // Na web, usar câmera frontal por padrão (notebooks só têm frontal)
  // Em dispositivos móveis, usar câmera traseira por padrão
  const [cameraType, setCameraType] = useState<'front' | 'back'>(
    Platform.OS === 'web' ? 'front' : 'back'
  );

  useEffect(() => {
    if (visible) {
      requestPermission();
      setScanned(false);
    }
  }, [visible]);

  const requestPermission = async () => {
    const { status } = await BarCodeScanner.requestPermissionsAsync();
    setHasPermission(status === 'granted');
  };

  const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
    if (!scanned) {
      setScanned(true);
      onScan(data);
    }
  };

  const handleClose = () => {
    setScanned(false);
    onClose();
  };

  const toggleCameraType = () => {
    setCameraType(current => current === 'back' ? 'front' : 'back');
  };

  if (hasPermission === null) {
    return null;
  }

  if (hasPermission === false) {
    return (
      <Modal
        isVisible={visible}
        onBackdropPress={handleClose}
        onBackButtonPress={handleClose}
        style={styles.modal}
      >
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-off" size={64} color="#8E8E93" />
          <Text style={styles.permissionTitle}>{t('cameraPermission')}</Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>{t('grantPermission')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
            <Text style={styles.cancelButtonText}>{t('cancel')}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={handleClose}
      onBackButtonPress={handleClose}
      style={styles.fullScreenModal}
      animationIn="fadeIn"
      animationOut="fadeOut"
    >
      <View style={styles.scannerContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('scannerTitle')}</Text>
          <View style={styles.headerButtons}>
            {/* Botão para alternar câmera */}
            <TouchableOpacity onPress={toggleCameraType} style={styles.switchCameraButton}>
              <Ionicons name="camera-reverse" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={32} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.cameraContainer}>
          <BarCodeScanner
            onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
            style={StyleSheet.absoluteFillObject}
            type={cameraType}
            barCodeTypes={[
              'ean13',
              'ean8',
              'upc_e',
              'upc_a',
              'qr',
              'code128',
              'code39',
              'code93',
              'codabar',
              'itf14',
              'pdf417',
              'aztec',
            ]}
          />
          <View style={styles.overlay}>
            <View style={styles.scanArea} />
          </View>
        </View>

        <View style={styles.instructions}>
          <Text style={styles.instructionsText}>{t('scannerInstructions')}</Text>
          <Text style={styles.cameraTypeText}>
            Câmera: {cameraType === 'front' ? 'Frontal' : 'Traseira'}
          </Text>
          {scanned && (
            <TouchableOpacity
              style={styles.scanAgainButton}
              onPress={() => setScanned(false)}
            >
              <Ionicons name="refresh" size={20} color="#FFFFFF" />
              <Text style={styles.scanAgainText}>Escanear Novamente</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: {
    margin: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenModal: {
    margin: 0,
  },
  permissionContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    gap: 16,
    maxWidth: 320,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
  },
  permissionButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    alignItems: 'center',
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    padding: 12,
  },
  cancelButtonText: {
    color: '#8E8E93',
    fontSize: 16,
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 48,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  switchCameraButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
  },
  closeButton: {
    padding: 4,
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: 280,
    height: 280,
    borderWidth: 2,
    borderColor: '#34C759',
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  instructions: {
    padding: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    gap: 12,
  },
  instructionsText: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  cameraTypeText: {
    fontSize: 14,
    color: '#34C759',
    fontWeight: '600',
  },
  scanAgainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  scanAgainText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
