import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { ExportData } from '../services/api';

// Função para converter AAAA-MM-DD para DD/MM/AAAA
const convertFromISO = (isoStr: string): string => {
  if (!isoStr) return '';
  const [year, month, day] = isoStr.split('-');
  return `${day}/${month}/${year}`;
};

export const generateExcelReport = async (data: ExportData): Promise<string> => {
  try {
    // Create workbook
    const wb = XLSX.utils.book_new();

    // Prepare Store Info Data
    const storeInfo = data.store ? [
      ['CONFIGURAÇÃO DA LOJA'],
      ['Código da Loja', data.store.store_id],
      ['Nome da Loja', data.store.store_name],
      ['E-mail', data.store.email],
      ['Celular do Gerente', data.store.manager_phone],
      ['Nome do Gerente', data.store.manager_name],
      [],
      ['INFORMAÇÕES DO INVENTÁRIO'],
      ['Descrição', data.inventory.description],
      ['Data', convertFromISO(data.inventory.date)],
      ['Status', data.inventory.status === 'open' ? 'Aberto' : 'Fechado'],
      ['Total de Itens', data.items.length.toString()],
      [],
    ] : [
      ['INFORMAÇÕES DO INVENTÁRIO'],
      ['Descrição', data.inventory.description],
      ['Data', convertFromISO(data.inventory.date)],
      ['Status', data.inventory.status === 'open' ? 'Aberto' : 'Fechado'],
      ['Total de Itens', data.items.length.toString()],
      [],
    ];

    // Prepare Items Data with ALL fields
    const itemsHeader = [['Código do Produto', 'EAN', 'Descrição', 'Quantidade', 'Lote', 'Validade']];
    const itemsData = data.items.map(item => [
      item.product_code,
      item.ean,
      item.description,
      item.quantity.toString(),
      item.lot,
      convertFromISO(item.expiry_date)
    ]);

    // Combine all data
    const sheetData = [...storeInfo, ...itemsHeader, ...itemsData];

    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // Set column widths for better readability
    ws['!cols'] = [
      { wch: 20 }, // Código do Produto
      { wch: 15 }, // EAN
      { wch: 35 }, // Descrição
      { wch: 12 }, // Quantidade
      { wch: 15 }, // Lote
      { wch: 12 }, // Validade
    ];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Relatório de Inventário');

    // Generate binary string
    const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

    // Create file path with sanitized filename
    const sanitizedDescription = data.inventory.description.replace(/[^a-zA-Z0-9]/g, '_');
    const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const fileName = `inventario_${sanitizedDescription}_${timestamp}.xlsx`;
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
        dialogTitle: 'Compartilhar Relatório de Inventário',
      });
    } else {
      throw new Error('Sharing is not available on this device');
    }
  } catch (error) {
    console.error('Error sharing file:', error);
    throw error;
  }
};
