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
  FlatList,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  getInventory,
  getCountedItems,
  addCountedItem,
  updateCountedItem,
  deleteCountedItem,
  closeInventory,
  getExportData,
  Inventory,
  CountedItem,
} from '../../services/api';
import BarcodeScanner from '../../components/BarcodeScanner';
import EditItemModal from '../../components/EditItemModal';
import { generateExcelReport, shareExcelFile } from '../../utils/excelExport';
import * as MailComposer from 'expo-mail-composer';
import { getStoreConfig } from '../../services/api';

export default function CountingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const inventoryId = Array.isArray(id) ? id[0] : id;

  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [items, setItems] = useState<CountedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [editItem, setEditItem] = useState<CountedItem | null>(null);

  const [formData, setFormData] = useState({
    product_code: '',
    quantity: '',
    lot: '',
    expiry_date: '',
  });

  useEffect(() => {
    loadData();
  }, [inventoryId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [invData, itemsData] = await Promise.all([
        getInventory(inventoryId),
        getCountedItems(inventoryId),
      ]);
      setInventory(invData);
      setItems(itemsData);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleScan = (code: string) => {
    setFormData({ ...formData, product_code: code });
    setScannerVisible(false);
  };

  const handleAddItem = async () => {
    if (!formData.product_code || !formData.quantity || !formData.lot || !formData.expiry_date) {
      Alert.alert(t('fillAllFields'));
      return;
    }

    const quantity = parseInt(formData.quantity);
    if (isNaN(quantity) || quantity <= 0) {
      Alert.alert(t('invalidQuantity'));
      return;
    }

    try {
      setLoading(true);
      const newItem = await addCountedItem(inventoryId, {
        product_code: formData.product_code,
        quantity,
        lot: formData.lot,
        expiry_date: formData.expiry_date,
      });
      setItems([newItem, ...items]);
      setFormData({
        product_code: '',
        quantity: '',
        lot: '',
        expiry_date: '',
      });
    } catch (error) {
      console.error('Error adding item:', error);
      Alert.alert('Error', 'Failed to add item');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = (item: CountedItem) => {
    Alert.alert(
      t('delete'),
      t('confirmDelete'),
      [
        { text: t('no'), style: 'cancel' },
        {
          text: t('yes'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCountedItem(inventoryId, item._id!);
              setItems(items.filter((i) => i._id !== item._id));
            } catch (error) {
              console.error('Error deleting item:', error);
              Alert.alert('Error', 'Failed to delete item');
            }
          },
        },
      ]
    );
  };

  const handleEditSuccess = () => {
    setEditItem(null);
    loadData();
  };

  const handleExport = async () => {
    if (items.length === 0) {
      Alert.alert('Error', 'No items to export');
      return;
    }

    try {
      setLoading(true);
      // Close inventory first
      await closeInventory(inventoryId);
      
      // Get export data
      const exportData = await getExportData(inventoryId);
      
      // Generate Excel file
      const fileUri = await generateExcelReport(exportData);
      
      // Show options: Download or Email
      Alert.alert(
        t('exportTitle'),
        t('exportSuccess'),
        [
          {
            text: t('download'),
            onPress: async () => {
              try {
                await shareExcelFile(fileUri);
              } catch (error) {
                console.error('Error sharing file:', error);
              }
            },
          },
          {
            text: t('sendEmail'),
            onPress: async () => {
              try {
                const storeConfig = await getStoreConfig();
                const isAvailable = await MailComposer.isAvailableAsync();
                
                if (!isAvailable) {
                  Alert.alert('Error', 'Email is not available on this device');
                  return;
                }

                await MailComposer.composeAsync({
                  recipients: storeConfig?.email ? [storeConfig.email] : [],
                  subject: `Inventory Report - ${exportData.inventory.description}`,
                  body: `Attached is the inventory report for ${exportData.inventory.description} dated ${exportData.inventory.date}.`,
                  attachments: [fileUri],
                });
              } catch (error) {
                console.error('Error sending email:', error);
                Alert.alert('Error', 'Failed to send email');
              }
            },
          },
        ]
      );
      
      // Reload to show closed status
      loadData();
    } catch (error) {
      console.error('Error exporting:', error);
      Alert.alert(t('exportError'));
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: CountedItem }) => (
    <View style={styles.itemCard}>
      <View style={styles.itemHeader}>
        <View style={styles.itemCodeContainer}>
          <Ionicons name="barcode-outline" size={20} color="#007AFF" />
          <Text style={styles.itemCode}>{item.product_code}</Text>
        </View>
        <View style={styles.itemActions}>
          <TouchableOpacity onPress={() => setEditItem(item)} style={styles.actionButton}>
            <Ionicons name="create-outline" size={20} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDeleteItem(item)} style={styles.actionButton}>
            <Ionicons name="trash-outline" size={20} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.itemDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{t('quantity')}:</Text>
          <Text style={styles.detailValue}>{item.quantity}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{t('lot')}:</Text>
          <Text style={styles.detailValue}>{item.lot}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{t('expiryDate')}:</Text>
          <Text style={styles.detailValue}>{item.expiry_date}</Text>
        </View>
      </View>
    </View>
  );

  if (loading && !inventory) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!inventory) {
    return null;
  }

  const isClosed = inventory.status === 'closed';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.title} numberOfLines={1}>
              {inventory.description}
            </Text>
            <Text style={styles.subtitle}>{inventory.date}</Text>
          </View>
          {isClosed && (
            <View style={styles.closedBadge}>
              <Text style={styles.closedBadgeText}>{t('closed')}</Text>
            </View>
          )}
        </View>

        {!isClosed && (
          <View style={styles.inputSection}>
            <Text style={styles.sectionTitle}>{t('addItem')}</Text>
            
            <View style={styles.scanButtonContainer}>
              <TouchableOpacity
                style={styles.scanButton}
                onPress={() => setScannerVisible(true)}
              >
                <Ionicons name="scan" size={32} color="#FFFFFF" />
                <Text style={styles.scanButtonText}>{t('scanBarcode')}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('productCode')}</Text>
                <TextInput
                  style={styles.input}
                  value={formData.product_code}
                  onChangeText={(text) => setFormData({ ...formData, product_code: text })}
                  placeholder={t('productCode')}
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('quantity')}</Text>
                <TextInput
                  style={styles.input}
                  value={formData.quantity}
                  onChangeText={(text) => setFormData({ ...formData, quantity: text })}
                  placeholder={t('quantity')}
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('lot')}</Text>
                <TextInput
                  style={styles.input}
                  value={formData.lot}
                  onChangeText={(text) => setFormData({ ...formData, lot: text })}
                  placeholder={t('lot')}
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('expiryDate')}</Text>
                <TextInput
                  style={styles.input}
                  value={formData.expiry_date}
                  onChangeText={(text) => setFormData({ ...formData, expiry_date: text })}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#999"
                />
              </View>

              <TouchableOpacity
                style={styles.addButton}
                onPress={handleAddItem}
                disabled={loading}
              >
                <Ionicons name="add-circle" size={24} color="#FFFFFF" />
                <Text style={styles.addButtonText}>{t('addItem')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.itemsSection}>
          <View style={styles.itemsHeader}>
            <Text style={styles.sectionTitle}>{t('countedItems')}</Text>
            <Text style={styles.itemCount}>{items.length} {t('items')}</Text>
          </View>

          {items.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="cube-outline" size={48} color="#C7C7CC" />
              <Text style={styles.emptyText}>{t('noItems')}</Text>
              <Text style={styles.emptySubtext}>{t('startScanning')}</Text>
            </View>
          ) : (
            <FlatList
              data={items}
              renderItem={renderItem}
              keyExtractor={(item) => item._id || ''}
              scrollEnabled={false}
              contentContainerStyle={styles.itemsList}
            />
          )}
        </View>

        {!isClosed && items.length > 0 && (
          <TouchableOpacity
            style={styles.exportButton}
            onPress={handleExport}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="download" size={24} color="#FFFFFF" />
                <Text style={styles.exportButtonText}>{t('exportAndClose')}</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>

      <BarcodeScanner
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScan={handleScan}
      />

      {editItem && (
        <EditItemModal
          visible={!!editItem}
          item={editItem}
          inventoryId={inventoryId}
          onClose={() => setEditItem(null)}
          onSuccess={handleEditSuccess}
        />
      )}
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
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
  },
  backButton: {
    padding: 4,
  },
  headerInfo: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  subtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  closedBadge: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  closedBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
  },
  inputSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  scanButtonContainer: {
    alignItems: 'center',
  },
  scanButton: {
    backgroundColor: '#34C759',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
    minHeight: 72,
  },
  scanButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  form: {
    gap: 12,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  input: {
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#000',
    minHeight: 48,
  },
  addButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    minHeight: 52,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  itemsSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 16,
  },
  itemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
  },
  itemsList: {
    gap: 12,
  },
  itemCard: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  itemCode: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 4,
  },
  itemDetails: {
    gap: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 14,
    color: '#8E8E93',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#C7C7CC',
    marginTop: 4,
  },
  exportButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 56,
  },
  exportButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
