export interface BulkRow {
  id: string;           // local UUID for React key
  file: File;
  title: string;
  subjectId: string;
  year: string;
  semester: string;
  status: 'idle' | 'uploading' | 'done' | 'error';
  errorMsg?: string;
  forceUpload?: boolean;
}

const DB_NAME = 'BulkUploadDraftDB';
const STORE_NAME = 'drafts';
const DB_VERSION = 1;

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

export async function saveBulkUploadDraft(rows: BulkRow[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const clearRequest = store.clear();
    clearRequest.onerror = () => reject(clearRequest.error);

    clearRequest.onsuccess = () => {
      if (rows.length === 0) {
        resolve();
        return;
      }

      let completed = 0;
      let failed = false;

      rows.forEach((row) => {
        // Map 'uploading' to 'idle' when storing so that on restore we don't display a stuck spinner
        const serializedRow: BulkRow = {
          id: row.id,
          file: row.file,
          title: row.title,
          subjectId: row.subjectId,
          year: row.year,
          semester: row.semester,
          status: row.status === 'uploading' ? 'idle' : row.status,
          errorMsg: row.errorMsg,
          forceUpload: row.forceUpload,
        };

        const addRequest = store.add(serializedRow);
        addRequest.onerror = () => {
          if (!failed) {
            failed = true;
            reject(addRequest.error);
          }
        };
        addRequest.onsuccess = () => {
          completed++;
          if (completed === rows.length && !failed) {
            resolve();
          }
        };
      });
    };
  });
}

export async function getBulkUploadDraft(): Promise<BulkRow[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

export async function clearBulkUploadDraft(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}
