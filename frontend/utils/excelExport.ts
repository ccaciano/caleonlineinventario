import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import XLSX from 'xlsx';
import { ExportData } from '../services/api';

const formatDate = (isoStr: string | undefined | null): string => {
  if (!isoStr) return '';
  try {
    const datePart = isoStr.split('T')[0];
    const [year, month, day] = datePart.split('-');
    return `${day}/${month}/${year}`;
  } catch {
    return '';
  }
};

const buildWmsWorkbook = (data: ExportData): XLSX.WorkBook => {
  const inventory = data.inventory;
  const enderecos = inventory.enderecos || [];

  const rows: any[][] = [
    ['Data de Criação:', formatDate(inventory.date) || inventory.date, '', '', '', '', '', '', '', ''],
    ['Descrição:', inventory.description, '', '', '', '', '', '', '', ''],
    ['Tipo de Contagem:', 'WMS', '', '', '', '', '', '', '', ''],
    [],
    ['Endereço', 'SKU', 'EAN', 'Descrição', 'UM', 'Fator de Conversão', 'Lote', 'Validade', 'Quantidade', 'Total Peças'],
  ];

  for (const addr of enderecos) {
    for (const item of addr.itens) {
      const totalPecas = item.qtd != null && item.fator != null ? item.qtd * item.fator : null;
      rows.push([
        addr.endereco,
        item.codigo ?? null,
        item.EAN ?? null,
        item.descricao ?? null,
        item.unit ?? null,
        item.fator ?? null,
        item.lote ?? null,
        item.validade ? formatDate(item.validade) : null,
        item.qtd ?? null,
        totalPecas,
      ]);
    }
  }

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols'] = [
    { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 6 },
    { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Contagem WMS');
  return workbook;
};

export const shareExcelReport = async (data: ExportData): Promise<void> => {
  const workbook = buildWmsWorkbook(data);

  const sanitizedName = data.inventory.description.replace(/[^a-zA-Z0-9]/g, '_');
  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const fileName = `inventario_wms_${sanitizedName}_${dateStr}.xlsx`;

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
