import React, { useState, useEffect, useRef } from 'react';
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

// Componente para Web usando API nativa do navegador
function WebBarcodeScanner({ visible, onClose, onScan }: BarcodeScannerComponentProps) {
  const { t } = useTranslation();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [cameraType, setCameraType] = useState<'user' | 'environment'>('user');
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const containerRef = useRef<View>(null);
  const scanningRef = useRef(false);

  useEffect(() => {
    if (visible) {
      startCamera();
    } else {
      stopCamera();
    }
    
    return () => {
      stopCamera();
    };
  }, [visible]);

  useEffect(() => {
    if (visible && hasPermission) {
      // Reiniciar câmera quando o tipo mudar
      startCamera();
    }
  }, [cameraType]);

  const startCamera = async () => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined' || !navigator.mediaDevices) {
      setHasPermission(false);
      setError('Seu navegador não suporta acesso à câmera');
      return;
    }

    try {
      // Parar stream anterior
      stopCamera();

      const constraints = {
        video: {
          facingMode: cameraType,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setHasPermission(true);
      setError(null);

      // Aguardar um pouco para o DOM estar pronto
      setTimeout(() => {
        setupVideo(stream);
      }, 100);

    } catch (err: any) {
      console.error('Error accessing camera:', err);
      setHasPermission(false);
      if (err.name === 'NotAllowedError') {
        setError('Permissão para câmera negada. Por favor, permita o acesso à câmera.');
      } else if (err.name === 'NotFoundError') {
        setError('Nenhuma câmera encontrada no dispositivo.');
      } else {
        setError('Erro ao acessar a câmera: ' + err.message);
      }
    }
  };

  const setupVideo = (stream: MediaStream) => {
    if (typeof document === 'undefined') return;

    // Buscar o container
    const container = document.querySelector('[data-scanner-container="true"]');
    if (!container) {
      console.error('Scanner container not found');
      return;
    }

    // Limpar container
    container.innerHTML = '';

    // Criar elemento de vídeo
    const video = document.createElement('video');
    video.setAttribute('playsinline', 'true');
    video.setAttribute('autoplay', 'true');
    video.setAttribute('muted', 'true');
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'cover';
    video.srcObject = stream;
    
    container.appendChild(video);
    videoRef.current = video;

    video.play().then(() => {
      setIsScanning(true);
      scanningRef.current = true;
      startBarcodeDetection(video);
    }).catch(err => {
      console.error('Error playing video:', err);
    });
  };

  const stopCamera = () => {
    scanningRef.current = false;
    setIsScanning(false);
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current = null;
    }

    // Limpar container
    if (typeof document !== 'undefined') {
      const container = document.querySelector('[data-scanner-container="true"]');
      if (container) {
        container.innerHTML = '';
      }
    }
  };

  const startBarcodeDetection = (video: HTMLVideoElement) => {
    // Verificar se BarcodeDetector está disponível (Chrome 83+)
    if ('BarcodeDetector' in window) {
      const barcodeDetector = new (window as any).BarcodeDetector({
        formats: ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'codabar', 'itf']
      });

      const detectLoop = async () => {
        if (!scanningRef.current || !video || video.readyState !== 4) {
          if (scanningRef.current) {
            requestAnimationFrame(detectLoop);
          }
          return;
        }

        try {
          const barcodes = await barcodeDetector.detect(video);
          if (barcodes.length > 0) {
            const code = barcodes[0].rawValue;
            if (code) {
              handleScan(code);
              return;
            }
          }
        } catch (err) {
          // Ignorar erros de detecção
        }

        if (scanningRef.current) {
          requestAnimationFrame(detectLoop);
        }
      };

      detectLoop();
    } else {
      console.log('BarcodeDetector API não disponível neste navegador.');
    }
  };

  const handleScan = (code: string) => {
    stopCamera();
    onScan(code);
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  const toggleCameraType = () => {
    setCameraType(current => current === 'user' ? 'environment' : 'user');
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
          <TouchableOpacity style={styles.permissionButton} onPress={startCamera}>
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
            <TouchableOpacity onPress={toggleCameraType} style={styles.switchCameraButton}>
              <Ionicons name="camera-reverse" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={32} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.cameraContainer}>
          <View 
            data-scanner-container="true"
            style={styles.videoContainer as any}
          />
          <View style={styles.overlay}>
            <View style={styles.scanArea} />
          </View>
        </View>

        <View style={styles.instructions}>
          <Text style={styles.instructionsText}>{t('scannerInstructions')}</Text>
          <Text style={styles.cameraTypeText}>
            Câmera: {cameraType === 'user' ? 'Frontal' : 'Traseira'}
          </Text>
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
  videoContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
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
