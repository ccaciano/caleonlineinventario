import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import Modal from 'react-native-modal';

// Importar BarCodeScanner apenas para plataformas nativas
let BarCodeScanner: any = null;
if (Platform.OS !== 'web') {
  BarCodeScanner = require('expo-barcode-scanner').BarCodeScanner;
}

interface BarcodeScannerComponentProps {
  visible: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}

// Componente para Web usando html5-qrcode
function WebBarcodeScanner({ visible, onClose, onScan }: BarcodeScannerComponentProps) {
  const { t } = useTranslation();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [cameraId, setCameraId] = useState<string>('');
  const [cameras, setCameras] = useState<any[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [isStarted, setIsStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<any>(null);
  const html5QrCodeRef = useRef<any>(null);

  // Inicializar scanner quando o modal abre
  useEffect(() => {
    if (visible && Platform.OS === 'web') {
      initializeScanner();
    }
    
    return () => {
      stopScanner();
    };
  }, [visible]);

  const initializeScanner = async () => {
    if (typeof window === 'undefined') return;

    try {
      // Importar html5-qrcode dinamicamente
      const { Html5Qrcode } = await import('html5-qrcode');
      
      // Obter lista de câmeras
      const devices = await Html5Qrcode.getCameras();
      
      if (devices && devices.length > 0) {
        setCameras(devices);
        setHasPermission(true);
        
        // Preferir câmera frontal para notebooks (geralmente tem "front" ou "user" no label)
        let frontCameraIndex = devices.findIndex((d: any) => 
          d.label.toLowerCase().includes('front') || 
          d.label.toLowerCase().includes('user') ||
          d.label.toLowerCase().includes('facetime')
        );
        
        // Se não encontrar câmera frontal, usar a primeira
        if (frontCameraIndex === -1) frontCameraIndex = 0;
        
        setCurrentCameraIndex(frontCameraIndex);
        setCameraId(devices[frontCameraIndex].id);
        
        // Aguardar DOM estar pronto e iniciar
        setTimeout(() => {
          startScanner(devices[frontCameraIndex].id);
        }, 500);
      } else {
        setHasPermission(false);
        setError('Nenhuma câmera encontrada');
      }
    } catch (err: any) {
      console.error('Error initializing scanner:', err);
      setHasPermission(false);
      setError(err.message || 'Erro ao acessar câmera');
    }
  };

  const startScanner = async (camId: string) => {
    if (typeof window === 'undefined' || !camId) return;
    
    try {
      // Parar scanner anterior se existir
      await stopScanner();
      
      const { Html5Qrcode } = await import('html5-qrcode');
      
      // Verificar se o elemento existe
      const element = document.getElementById('html5-qrcode-scanner');
      if (!element) {
        console.error('Scanner element not found');
        return;
      }

      html5QrCodeRef.current = new Html5Qrcode('html5-qrcode-scanner');
      
      await html5QrCodeRef.current.start(
        camId,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText: string) => {
          handleScan(decodedText);
        },
        (errorMessage: string) => {
          // Ignorar erros de scan - são normais quando não há código na imagem
        }
      );
      
      setIsStarted(true);
      setError(null);
    } catch (err: any) {
      console.error('Error starting scanner:', err);
      setError(err.message || 'Erro ao iniciar scanner');
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current && isStarted) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current = null;
        setIsStarted(false);
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
    }
  };

  const handleScan = async (code: string) => {
    await stopScanner();
    onScan(code);
  };

  const handleClose = async () => {
    await stopScanner();
    onClose();
  };

  const toggleCamera = async () => {
    if (cameras.length <= 1) return;
    
    const nextIndex = (currentCameraIndex + 1) % cameras.length;
    setCurrentCameraIndex(nextIndex);
    setCameraId(cameras[nextIndex].id);
    
    // Reiniciar com nova câmera
    await startScanner(cameras[nextIndex].id);
  };

  if (!visible) return null;

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
          <Text style={styles.permissionTitle}>
            {error || t('cameraPermission')}
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={initializeScanner}>
            <Text style={styles.permissionButtonText}>Tentar Novamente</Text>
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
            {cameras.length > 1 && (
              <TouchableOpacity onPress={toggleCamera} style={styles.switchCameraButton}>
                <Ionicons name="camera-reverse" size={28} color="#FFFFFF" />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={32} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.cameraContainer}>
          {Platform.OS === 'web' && (
            <View 
              style={styles.webScannerWrapper}
              // @ts-ignore - Web-specific attribute
              dangerouslySetInnerHTML={{
                __html: '<div id="html5-qrcode-scanner" style="width:100%;height:100%;background:#000;"></div>'
              }}
            />
          )}
        </View>

        <View style={styles.instructions}>
          <Text style={styles.instructionsText}>{t('scannerInstructions')}</Text>
          {cameras.length > 0 && (
            <Text style={styles.cameraTypeText}>
              Câmera: {cameras[currentCameraIndex]?.label || 'Desconhecida'}
            </Text>
          )}
          <Text style={styles.tipText}>
            💡 Se a leitura automática não funcionar, digite o código manualmente
          </Text>
        </View>
      </View>
    </Modal>
  );
}

// Componente para dispositivos nativos (iOS/Android)
function NativeBarcodeScanner({ visible, onClose, onScan }: BarcodeScannerComponentProps) {
  const { t } = useTranslation();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [cameraType, setCameraType] = useState<'front' | 'back'>('back');

  useEffect(() => {
    if (visible && BarCodeScanner) {
      requestPermission();
      setScanned(false);
    }
  }, [visible]);

  const requestPermission = async () => {
    if (!BarCodeScanner) return;
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

  if (!BarCodeScanner || !visible) {
    return null;
  }

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

// Componente principal que escolhe qual implementação usar
export default function BarcodeScanner(props: BarcodeScannerComponentProps) {
  if (Platform.OS === 'web') {
    return <WebBarcodeScanner {...props} />;
  }
  return <NativeBarcodeScanner {...props} />;
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
    zIndex: 10,
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
    overflow: 'hidden',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
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
    zIndex: 10,
  },
  webScannerWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
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
    textAlign: 'center',
  },
  tipText: {
    fontSize: 12,
    color: '#FFD60A',
    textAlign: 'center',
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
