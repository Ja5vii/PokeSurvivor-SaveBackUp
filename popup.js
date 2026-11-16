const statusEl = document.getElementById('status');
const vaultInfoEl = document.getElementById('vaultInfo');
const restoreVaultBtn = document.getElementById('restoreVaultBtn');
let pendingPayload = null;

function setStatus(msg, type = '') {
  statusEl.textContent = msg;
  statusEl.className = type;
}

// Generar firma SHA-256 para integridad de datos
async function computeSHA256(str) {
  const buf = new TextEncoder().encode(str);
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Actualizar estado de la bóveda interna al abrir el popup
async function refreshVaultUI() {
  const { internalVault } = await chrome.storage.local.get('internalVault');
  if (internalVault && internalVault.meta) {
    const fecha = new Date(internalVault.meta.timestamp).toLocaleString();
    vaultInfoEl.textContent = `Último respaldo: ${fecha}`;
    restoreVaultBtn.style.display = 'flex';
  } else {
    vaultInfoEl.textContent = 'Sin copias en bóveda todavía.';
    restoreVaultBtn.style.display = 'none';
  }
}
refreshVaultUI();

async function getValidTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || (!tab.url.includes('pokesurvivor') && !tab.url.startsWith('file://'))) {
    setStatus('⚠️ Abre la pestaña de PokéSurvivor primero.', 'err');
    return null;
  }
  return tab;
}

// EXTRACCIÓN SEGURA (LocalStorage + SessionStorage + Cookies + IndexedDB)
document.getElementById('exportBtn').addEventListener('click', async () => {
  const tab = await getValidTab();
  if (!tab) return;

  setStatus('Extrayendo y firmando datos...');

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: async () => {
      function serializeValue(val) {
        if (val instanceof ArrayBuffer || ArrayBuffer.isView(val)) {
          const bytes = new Uint8Array(val.buffer || val);
          let binary = '';
          for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
          return { __binaryBase64: btoa(binary) };
        }
        return val;
      }

      const rawState = {
        localStorage: { ...localStorage },
        sessionStorage: { ...sessionStorage },
        cookies: document.cookie,
        indexedDB: {}
      };

      if (window.indexedDB && indexedDB.databases) {
        const dbs = await indexedDB.databases();
        for (const dbInfo of dbs) {
          if (!dbInfo.name) continue;
          rawState.indexedDB[dbInfo.name] = await new Promise((resolve) => {
            const req = indexedDB.open(dbInfo.name);
            req.onsuccess = () => {
              const db = req.result;
              const stores = Array.from(db.objectStoreNames);
              if (stores.length === 0) return resolve({});
              const tx = db.transaction(stores, 'readonly');
              const dbData = {};
              let pending = stores.length;
              stores.forEach((storeName) => {
                const store = tx.objectStore(storeName);
                const items = [];
                store.openCursor().onsuccess = (e) => {
                  const cursor = e.target.result;
                  if (cursor) {
                    items.push({ key: cursor.key, value: serializeValue(cursor.value) });
                    cursor.continue();
                  } else {
                    dbData[storeName] = items;
                    if (--pending === 0) resolve(dbData);
                  }
                };
              });
            };
            req.onerror = () => resolve({});
          });
        }
      }
      return rawState;
    }
  }, async (results) => {
    if (chrome.runtime.lastError || !results || !results[0] || !results[0].result) {
      setStatus('❌ Error al acceder a los datos del juego.', 'err');
      return;
    }

    const payload = results[0].result;
    const payloadString = JSON.stringify(payload);
    const checksum = await computeSHA256(payloadString);

    const backupPackage = {
      meta: {
        app: 'PokeSurvivorVaultPro',
        version: '3.0',
        timestamp: new Date().toISOString(),
        sha256: checksum
      },
      payload
    };

    // 1. Guardar en bóveda interna de la extensión
    await chrome.storage.local.set({ internalVault: backupPackage });
    await refreshVaultUI();

    // 2. Descargar archivo .json firmado
    const blob = new Blob([JSON.stringify(backupPackage, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);

    const a = document.createElement('a');
    a.href = url;
    a.download = `PokeSurvivor_Vault_${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);

    setStatus('✅ Guardado en PC y Bóveda (SHA-256 OK).', 'ok');
  });
});

// INYECCIÓN SEGURA EN EL JUEGO
async function injectBackupToTab(tab, backupPackage) {
  setStatus('Restaurando partida de forma segura...');
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    args: [backupPackage.payload],
    func: async (payload) => {
      function deserializeValue(val) {
        if (val && typeof val === 'object' && val.__binaryBase64) {
          const binary = atob(val.__binaryBase64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          return bytes.buffer;
        }
        return val;
      }

      if (payload.localStorage) {
        localStorage.clear();
        Object.entries(payload.localStorage).forEach(([k, v]) => localStorage.setItem(k, v));
      }

      if (payload.sessionStorage) {
        sessionStorage.clear();
        Object.entries(payload.sessionStorage).forEach(([k, v]) => sessionStorage.setItem(k, v));
      }

      if (payload.cookies) {
        payload.cookies.split(';').forEach(c => {
          if (c.trim()) document.cookie = c.trim() + '; path=/';
        });
      }

      if (payload.indexedDB) {
        for (const [dbName, stores] of Object.entries(payload.indexedDB)) {
          await new Promise((resolve) => {
            const req = indexedDB.open(dbName);
            req.onsuccess = () => {
              const db = req.result;
              const validStores = Object.keys(stores).filter(s => db.objectStoreNames.contains(s));
              if (validStores.length === 0) return resolve();
              const tx = db.transaction(validStores, 'readwrite');
              validStores.forEach((storeName) => {
                const store = tx.objectStore(storeName);
                store.clear();
                stores[storeName].forEach((item) => {
                  const cleanVal = deserializeValue(item.value);
                  try { store.put(cleanVal, item.key); } catch { store.put(cleanVal); }
                });
              });
              tx.oncomplete = () => resolve();
              tx.onerror = () => resolve();
            };
            req.onerror = () => resolve();
          });
        }
      }
      location.reload();
    }
  }, () => {
    pendingPayload = null;
    setStatus('✅ Partida restaurada. Recargando juego...', 'ok');
  });
}

// RESTAURAR DESDE ARCHIVO EXTERNO CON VALIDACIÓN SHA-256
document.getElementById('importBtn').addEventListener('click', async () => {
  const tab = await getValidTab();
  if (tab) document.getElementById('fileInput').click();
});

document.getElementById('fileInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const tab = await getValidTab();
  if (!tab) return;

  try {
    const parsed = JSON.parse(await file.text());
    if (!parsed.meta || parsed.meta.app !== 'PokeSurvivorVaultPro' || !parsed.payload) {
      setStatus('❌ Formato de archivo no reconocido.', 'err');
      return;
    }

    const calculatedHash = await computeSHA256(JSON.stringify(parsed.payload));
    if (calculatedHash !== parsed.meta.sha256) {
      setStatus('🚨 Archivo alterado o corrupto (Fallo SHA-256).', 'err');
      return;
    }

    if (pendingPayload !== parsed.meta.sha256) {
      pendingPayload = parsed.meta.sha256;
      setStatus('⚠️ Firma válida. Vuelve a seleccionar el archivo para confirmar sobrescritura.', 'warn');
      return;
    }

    await injectBackupToTab(tab, parsed);
  } catch {
    setStatus('❌ Error leyendo el archivo JSON.', 'err');
  } finally {
    e.target.value = '';
  }
});

// RESTAURAR DESDE BÓVEDA INTERNA (DOBLE CLIC DE SEGURIDAD)
let vaultConfirm = false;
restoreVaultBtn.addEventListener('click', async () => {
  const tab = await getValidTab();
  if (!tab) return;

  const { internalVault } = await chrome.storage.local.get('internalVault');
  if (!internalVault) return;

  if (!vaultConfirm) {
    vaultConfirm = true;
    restoreVaultBtn.textContent = '⚠️ Pulsa de nuevo para confirmar';
    restoreVaultBtn.classList.add('btn-confirm');
    setStatus('Esto sobrescribirá la partida actual.', 'warn');
    setTimeout(() => {
      vaultConfirm = false;
      restoreVaultBtn.textContent = '⚡ Restaurar Última Bóveda';
      restoreVaultBtn.classList.remove('btn-confirm');
    }, 4000);
    return;
  }

  vaultConfirm = false;
  restoreVaultBtn.textContent = '⚡ Restaurar Última Bóveda';
  restoreVaultBtn.classList.remove('btn-confirm');
  await injectBackupToTab(tab, internalVault);
});
