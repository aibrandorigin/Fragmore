import { collection, getDocs, Timestamp } from 'firebase/firestore';
import { getTableName } from 'drizzle-orm';
import { firestore } from '../lib/firebase.ts';
import { FIREBASE_PROJECT_ID, FIRESTORE_DATABASE_ID } from '../lib/firebase-admin.ts';
import * as schema from '../db/schema.ts';

const EXTRA_FIRESTORE_COLLECTIONS = ['cms', 'returns', 'integrations', 'analytics', 'visitors'];

function unwrapFirestoreValue(val: any): any {
  if (val === null || val === undefined) return val;
  if (Array.isArray(val)) {
    return val.map((item) => unwrapFirestoreValue(item));
  }
  if (val instanceof Date) {
    return val.toISOString();
  }
  if (val instanceof Timestamp || (typeof val === 'object' && typeof val.toDate === 'function')) {
    try {
      return val.toDate().toISOString();
    } catch {
      return String(val);
    }
  }
  if (typeof val === 'object') {
    if (val.__fsNestedArray === true && Array.isArray(val.items)) {
      return val.items.map((item: any) => unwrapFirestoreValue(item));
    }
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      out[k] = unwrapFirestoreValue(v);
    }
    return out;
  }
  return val;
}

export function getAllFirestoreCollectionNames(): string[] {
  const names = new Set<string>();
  for (const val of Object.values(schema)) {
    if (val && typeof val === 'object' && Symbol.for('drizzle:Name') in val) {
      names.add(getTableName(val as any));
    }
  }
  for (const extra of EXTRA_FIRESTORE_COLLECTIONS) {
    names.add(extra);
  }
  return Array.from(names);
}

export interface CompleteDatabaseSnapshot {
  meta: {
    application: string;
    databaseProvider: string;
    projectId: string;
    firestoreDatabaseId: string;
    exportedAt: string;
    exportedBy: string;
    totalCollections: number;
    nonEmptyCollections: number;
    totalDocuments: number;
    collectionCounts: Record<string, number>;
  };
  collections: Record<string, Array<Record<string, any>>>;
}

export async function readCompleteFirestoreDatabase(
  exportedBy: string
): Promise<CompleteDatabaseSnapshot> {
  const collectionNames = getAllFirestoreCollectionNames();
  const collections: Record<string, Array<Record<string, any>>> = {};
  const collectionCounts: Record<string, number> = {};
  let totalDocuments = 0;
  let nonEmptyCollections = 0;

  // Fetch in bounded batches of 6 collections to protect the 1GB RAM budget
  const BATCH_SIZE = 6;
  for (let i = 0; i < collectionNames.length; i += BATCH_SIZE) {
    const batch = collectionNames.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (colName) => {
        try {
          const snap = await getDocs(collection(firestore, colName));
          const docs: Array<Record<string, any>> = [];
          snap.forEach((docSnap) => {
            const raw = docSnap.data();
            const unwrapped = unwrapFirestoreValue(raw);
            docs.push({
              _docId: docSnap.id,
              ...(unwrapped && typeof unwrapped === 'object' ? unwrapped : { value: unwrapped })
            });
          });
          return { colName, docs };
        } catch (err: any) {
          console.warn(`[DB Backup] Skipping unreadable collection "${colName}":`, err?.message || err);
          return { colName, docs: [] as Array<Record<string, any>> };
        }
      })
    );

    for (const { colName, docs } of results) {
      collections[colName] = docs;
      collectionCounts[colName] = docs.length;
      if (docs.length > 0) {
        nonEmptyCollections += 1;
        totalDocuments += docs.length;
      }
    }
  }

  return {
    meta: {
      application: 'FRAGMORÉ Business OS & Storefront',
      databaseProvider: 'Firebase Firestore',
      projectId: FIREBASE_PROJECT_ID,
      firestoreDatabaseId: FIRESTORE_DATABASE_ID,
      exportedAt: new Date().toISOString(),
      exportedBy,
      totalCollections: collectionNames.length,
      nonEmptyCollections,
      totalDocuments,
      collectionCounts
    },
    collections
  };
}

function sanitizeExcelCellValue(val: any): any {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number' || typeof val === 'boolean') return val;
  if (val instanceof Date) return val.toISOString();
  let str = typeof val === 'object' ? JSON.stringify(val) : String(val);
  if (/^[=+\-@\t\r]/.test(str) || /^[=+\-@\t\r]/.test(str.trimStart())) {
    str = `'${str}`;
  }
  if (str.length > 32000) {
    str = str.slice(0, 32000) + '...[TRUNCATED]';
  }
  return str;
}

function makeUniqueExcelSheetName(rawName: string, usedNames: Set<string>): string {
  // Excel forbids: \ / ? * [ ] : and max length is 31
  const cleaned = rawName.replace(/[\\/?*[\]:]/g, '_').slice(0, 31) || 'Sheet';
  if (!usedNames.has(cleaned.toLowerCase())) {
    usedNames.add(cleaned.toLowerCase());
    return cleaned;
  }
  for (let idx = 2; idx < 999; idx++) {
    const suffix = `_${idx}`;
    const candidate = `${cleaned.slice(0, 31 - suffix.length)}${suffix}`;
    if (!usedNames.has(candidate.toLowerCase())) {
      usedNames.add(candidate.toLowerCase());
      return candidate;
    }
  }
  const fallback = `Col_${usedNames.size}`;
  usedNames.add(fallback.toLowerCase());
  return fallback;
}

export async function generateCompleteDatabaseXlsxBuffer(
  snapshot: CompleteDatabaseSnapshot
): Promise<{ buffer: Buffer; fileName: string }> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = snapshot.meta.exportedBy || 'FRAGMORÉ Super Admin';
  workbook.created = new Date();
  workbook.company = 'FRAGMORÉ PRIVATE LIMITED';

  const usedSheetNames = new Set<string>();

  // 1. Summary Index Sheet
  const summarySheet = workbook.addWorksheet(makeUniqueExcelSheetName('Database Summary', usedSheetNames), {
    views: [{ state: 'frozen', ySplit: 8 }]
  });

  summarySheet.mergeCells('A1:D1');
  const titleCell = summarySheet.getCell('A1');
  titleCell.value = 'FRAGMORÉ — COMPLETE FIREBASE FIRESTORE DATABASE BACKUP';
  titleCell.font = { bold: true, size: 14, color: { argb: 'FFFAF8F4' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF24211D' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  summarySheet.getRow(1).height = 28;

  const metaRows = [
    ['Database Provider', snapshot.meta.databaseProvider],
    ['Firebase Project ID', snapshot.meta.projectId],
    ['Firestore Database ID', snapshot.meta.firestoreDatabaseId],
    ['Exported At (UTC)', snapshot.meta.exportedAt],
    ['Exported By', snapshot.meta.exportedBy]
  ];
  metaRows.forEach((r, idx) => {
    const rowNum = idx + 2;
    summarySheet.getCell(`A${rowNum}`).value = r[0];
    summarySheet.getCell(`A${rowNum}`).font = { bold: true };
    summarySheet.getCell(`B${rowNum}`).value = r[1];
  });

  summarySheet.getRow(8).values = ['Collection Name', 'Worksheet Name', 'Document Count', 'Status'];
  summarySheet.getRow(8).font = { bold: true, color: { argb: 'FFFAF8F4' } };
  summarySheet.getRow(8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF24211D' } };
  summarySheet.autoFilter = 'A8:D8';

  const sheetMap = new Map<string, string>();
  let summaryRowIdx = 9;

  for (const [colName, docs] of Object.entries(snapshot.collections)) {
    const sheetTitle = docs.length > 0 ? makeUniqueExcelSheetName(colName, usedSheetNames) : '-';
    if (docs.length > 0) {
      sheetMap.set(colName, sheetTitle);
    }
    const row = summarySheet.getRow(summaryRowIdx++);
    row.values = [colName, sheetTitle, docs.length, docs.length > 0 ? 'POPULATED' : 'EMPTY'];
  }

  const totalRow = summarySheet.getRow(summaryRowIdx);
  totalRow.getCell(1).value = 'TOTAL DOCUMENTS';
  totalRow.getCell(1).font = { bold: true };
  totalRow.getCell(3).value = {
    formula: `SUM(C9:C${summaryRowIdx - 1})`,
    result: snapshot.meta.totalDocuments
  };
  totalRow.getCell(3).font = { bold: true };

  summarySheet.columns = [
    { width: 38 },
    { width: 34 },
    { width: 18 },
    { width: 16 }
  ];

  // 2. Worksheet per populated collection
  for (const [colName, docs] of Object.entries(snapshot.collections)) {
    if (!docs.length) continue;
    const sheetTitle = sheetMap.get(colName);
    if (!sheetTitle) continue;

    const ws = workbook.addWorksheet(sheetTitle, {
      views: [{ state: 'frozen', ySplit: 1 }]
    });

    const keySet = new Set<string>(['_docId']);
    for (const docItem of docs) {
      for (const k of Object.keys(docItem)) {
        keySet.add(k);
      }
    }
    const colKeys = Array.from(keySet);

    ws.columns = colKeys.map((k) => ({
      header: k,
      key: k,
      width: Math.min(44, Math.max(14, k.length + 4))
    }));

    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFAF8F4' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF24211D' } };

    for (const docItem of docs) {
      const cleanRow: Record<string, any> = {};
      for (const k of colKeys) {
        cleanRow[k] = sanitizeExcelCellValue(docItem[k]);
      }
      ws.addRow(cleanRow);
    }

    if (colKeys.length > 0) {
      ws.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: colKeys.length }
      };
    }
  }

  const rawBuf = await workbook.xlsx.writeBuffer();
  const buffer = Buffer.from(rawBuf as ArrayBuffer);
  const dateTag = new Date().toISOString().slice(0, 10);
  return {
    buffer,
    fileName: `FRAGMORE_Complete_Database_${dateTag}.xlsx`
  };
}
