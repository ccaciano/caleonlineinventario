import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { ExportData } from '../services/api';

export const generateExcelReport = async (data: ExportData): Promise<string> => {
  try {
    // Create workbook
    const wb = XLSX.utils.book_new();

    // Prepare Store Info Data
    const storeInfo = data.store ? [
      ['Store Configuration'],
      ['Store ID', data.store.store_id],
      ['Store Name', data.store.store_name],
      ['Email', data.store.email],
      ['Manager Phone', data.store.manager_phone],
      ['Manager Name', data.store.manager_name],
      [],
      ['Inventory Information'],
      ['Description', data.inventory.description],
      ['Date', data.inventory.date],
      ['Status', data.inventory.status],
      ['Total Items', data.items.length.toString()],
      [],
    ] : [
      ['Inventory Information'],
      ['Description', data.inventory.description],
      ['Date', data.inventory.date],
      ['Status', data.inventory.status],
      ['Total Items', data.items.length.toString()],
      [],
    ];

    // Prepare Items Data
    const itemsHeader = [['Product Code', 'Quantity', 'Lot', 'Expiry Date']];
    const itemsData = data.items.map(item => [
      item.product_code,
      item.quantity.toString(),
      item.lot,
      item.expiry_date
    ]);

    // Combine all data
    const sheetData = [...storeInfo, ...itemsHeader, ...itemsData];

    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory Report');

    // Generate binary string
    const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

    // Create file path
    const fileName = `inventory_${data.inventory.description.replace(/\s+/g, '_')}_${Date.now()}.xlsx`;
    const fileUri = FileSystem.documentDirectory + fileName;

    // Write file
    await FileSystem.writeAsStringAsync(fileUri, wbout, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return fileUri;
  } catch (error) {
    console.error('Error generating Excel report:', error);
    throw error;
  }
};

export const shareExcelFile = async (fileUri: string): Promise<void> => {
  try {
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Share Inventory Report',
      });
    } else {
      throw new Error('Sharing is not available on this device');
    }
  } catch (error) {
    console.error('Error sharing file:', error);
    throw error;
  }
};
