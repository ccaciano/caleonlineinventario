import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import XLSX from 'xlsx';
import { ExportData } from '../services/api';

const formatDate = (isoStr: string | undefined): string => {
  if (!isoStr) return '';
  try {
    const datePart = isoStr.split('T')[0];
    const [year, month, day] = datePart.split('-');
    return `${day}/${month}/${year}`;
  } catch {
    return '';
  }
};

const buildLojaWorkbook = (data: ExportData): XLSX.WorkBook => {
  const items = data.items || [];

  // ---- Aba "Produtos": somatória por código (ignora lote e validade) ----
  const productMap = new Map<string, number>();
  for (const item of items) {
    const code = item.product_code || '';
    productMap.set(code, (productMap.get(code) || 0) + (item.quantity || 0));
  }

  const prodRows: any[][] = [['CÓDIGO', 'QUANTIDADE']];
  productMap.forEach((qty, code) => prodRows.push([code, qty]));

  const prodSheet = XLSX.utils.aoa_to_sheet(prodRows);
  prodSheet['!cols'] = [{ wch: 25 }, { wch: 15 }];

  // ---- Aba "Lotes": somatória por código + lote + validade ----
  type LoteKey = string;
  const loteMap = new Map<LoteKey, { code: string; lot: string; expiry: string; qty: number }>();

  for (const item of items) {
    const code = item.product_code || '';
    const lot = item.lot || '';
    const expiry = item.expiry_date || '';
    const key: LoteKey = `${code}||${lot}||${expiry}`;
    const existing = loteMap.get(key);
    if (existing) {
      existing.qty += item.quantity || 0;
    } else {
      loteMap.set(key, { code, lot, expiry, qty: item.quantity || 0 });
    }
  }

  const loteRows: any[][] = [['CÓDIGO PRODUTO', 'LOTE', 'QUANTIDADE', 'DATA FABRICAÇÃO', 'DATA VALIDADE']];
  loteMap.forEach(({ code, lot, expiry, qty }) => {
    loteRows.push([code, lot, qty, '', formatDate(expiry)]);
  });

  const loteSheet = XLSX.utils.aoa_to_sheet(loteRows);
  loteSheet['!cols'] = [{ wch: 25 }, { wch: 18 }, { wch: 12 }, { wch: 18 }, { wch: 15 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, prodSheet, 'Produtos');
  XLSX.utils.book_append_sheet(workbook, loteSheet, 'Lotes');
  return workbook;
};

export const shareExcelReport = async (data: ExportData): Promise<void> => {
  const workbook = buildLojaWorkbook(data);

  const sanitizedName = data.inventory.description.replace(/[^a-zA-Z0-9]/g, '_');
  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const fileName = `inventario_${sanitizedName}_${dateStr}.xlsx`;

  if (Platform.OS === 'web') {
    XLSX.writeFile(workbook, fileName);
    return;
  }

  const excelBase64 = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
  const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

  try {
    await FileSystem.writeAsStringAsync(fileUri, excelBase64, { encoding: 'base64' });
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: 'Compartilhar Relatório de Inventário',
    });
  } catch (error) {
    console.error('Erro ao exportar Excel:', error);
    throw error;
  }
};
