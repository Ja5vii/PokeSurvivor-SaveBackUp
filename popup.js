const statusEl = document.getElementById('status');

function setStatus(msg, type = '') {
  statusEl.textContent = msg;
  statusEl.className = type ? `status-${type}` : '';
}

async function getValidTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || (!tab.url.includes('pokesurvivor') && !tab.url.startsWith('file://'))) {
    setStatus('⚠️ Abre la pestaña de PokéSurvivor primero.', 'err');
    return null;
  }
  return tab;
}

// EXPORTAR PARTIDA (LocalStorage + IndexedDB)
document.getElementById('exportBtn').addEventListener('click', async () => {
  const tab = await getValidTab();
  if (!tab) return;

  setStatus('Extrayendo datos del juego...');

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: async () => {
      const dump = {
        app: 'PokeSurvivorBackup',
        version: '2.0',
        date: new Date().toISOString(),
        origin: window.location.origin,
        localStorage: { ...localStorage },
        indexedDB: {}
      };

      if (window.indexedDB && indexedDB.databases) {
        const dbs = await indexedDB.databases();
        for (const dbInfo of dbs) {
          if (!dbInfo.name) continue;
          dump.indexedDB[dbInfo.name] = await new Promise((resolve) => {
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
                    items.push({ key: cursor.key, value: cursor.value });
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
      return JSON.stringify(dump, null, 2);
    }
  }, (results) => {
    if (chrome.runtime.lastError || !results || !results[0]) {
      setStatus('❌ Error al leer los datos de la web.', 'err');
      return;
    }

    const jsonString = results[0].result;
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const fecha = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);

    const a = document.createElement('a');
    a.href = url;
    a.download = `PokeSurvivor_Save_${fecha}.json`;
    a.click();
    URL.revokeObjectURL(url);

    setStatus('✅ Copia descargada correctamente.', 'ok');
  });
});

// IMPORTAR PARTIDA
document.getElementById('importBtn').addEventListener('click', async () => {
  const tab = await getValidTab();
  if (!tab) return;
  document.getElementById('fileInput').click();
});

document.getElementById('fileInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const tab = await getValidTab();
  if (!tab) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);

    if (parsed.app !== 'PokeSurvivorBackup') {
      setStatus('❌ Archivo no válido para este juego.', 'err');
      return;
    }

    setStatus('Restaurando partida...');

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      args: [parsed],
      func: async (backup) => {
        // 1. Restaurar LocalStorage
        if (backup.localStorage) {
          localStorage.clear();
          Object.entries(backup.localStorage).forEach(([k, v]) => {
            localStorage.setItem(k, v);
          });
        }

        // 2. Restaurar IndexedDB
        if (backup.indexedDB) {
          for (const [dbName, stores] of Object.entries(backup.indexedDB)) {
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
                    try {
                      store.put(item.value, item.key);
                    } catch {
                      store.put(item.value);
                    }
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
      setStatus('✅ Partida restaurada. Recargando...', 'ok');
    });
  } catch (err) {
    setStatus('❌ El archivo JSON está dañado.', 'err');
  } finally {
    e.target.value = '';
  }
});
