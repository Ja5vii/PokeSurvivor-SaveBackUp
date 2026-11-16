# 🛡️ PokéSurvivor Vault Pro (v3.0)

**Gestor profesional de copias de seguridad locales, verificación criptográfica SHA-256 y bóveda de emergencia para PokéSurvivor.**

> ⚠️ **AVISO LEGAL / DESCARGO DE RESPONSABILIDAD (DISCLAIMER):**  
> Esta extensión es una herramienta independiente desarrollada por la comunidad con fines exclusivamente técnicos y de respaldo personal. **No está afiliada, asociada, autorizada, respaldada ni conectada oficialmente de ninguna manera con PokéSurvivor**, sus desarrolladores, ni con The Pokémon Company, Nintendo, Creatures Inc. o Game Freak. Todos los nombres, marcas y activos del juego pertenecen a sus respectivos propietarios.

---

## 🎯 ¿Para qué sirve esta herramienta?

Al jugar a **PokéSurvivor** desde navegadores web (especialmente en entornos restrictivos, navegadores gestionados por organizaciones, modo invitado o sesiones sin sincronización en la nube), el progreso local puede perderse al cerrar la pestaña o limpiar la caché.

**PokéSurvivor Vault Pro** permite:
1. **Exportar tu partida completa** a un archivo `.json` en tu ordenador.
2. **Almacenar una copia de emergencia** en la bóveda interna de la extensión (`chrome.storage.local`).
3. **Restaurar tu progreso** en el mismo navegador o migrarlo a otro equipo en segundos.

---

## ✨ Características Principales

* **Extracción Integral Multi-Almacenamiento:** Captura simultáneamente `localStorage`, `sessionStorage`, `cookies` y bases de datos `IndexedDB`.
* **Serialización Binaria Segura (Base64):** Preserva estructuras binarias (`ArrayBuffer` / `Uint8Array`) sin pérdida de datos al convertir a JSON.
* **Verificación de Integridad SHA-256:** Cada copia exportada incluye una firma criptográfica única. Si el archivo se corrompe o se altera manualmente, la extensión bloquea la restauración para proteger tu partida activa.
* **Bóveda Interna de Emergencia:** Guarda automáticamente el último respaldo dentro del almacenamiento aislado de la extensión como doble red de seguridad.
* **Protección Antisobrescritura:** Requiere doble confirmación antes de reemplazar los datos actuales del navegador.
* **100% Local y Privado:** No envía datos a servidores externos ni recopila telemetría. Todo ocurre en tu dispositivo.

---

## 📂 Estructura del Proyecto

Asegúrate de tener estos **4 archivos** dentro de la misma carpeta (`PokeSurvivor-Vault-Pro/`):

```text
PokeSurvivor-Vault-Pro/
├── manifest.json   # Configuración y permisos de la extensión (Manifest V3)
├── popup.html      # Interfaz gráfica de usuario
├── popup.js        # Lógica de extracción, cifrado SHA-256 e inyección
└── icon.png        # Icono de la extensión (128x128 px recomendado)
```

---

## 🚀 Guía de Instalación (Modo Desarrollador)

Compatible con **Google Chrome, Microsoft Edge, Brave, Opera y Vivaldi**:

1. **Descarga o crea la carpeta** con los 4 archivos indicados arriba (`manifest.json`, `popup.html`, `popup.js` e `icon.png`).
2. Abre tu navegador y escribe en la barra de direcciones:
   * En Chrome / Brave / Opera: `chrome://extensions`
   * En Edge: `edge://extensions`
3. Activa el interruptor **Modo de desarrollador** (*Developer mode*) situado en la esquina superior derecha.
4. Haz clic en el botón **Cargar descomprimida** (*Load unpacked*).
5. Selecciona la carpeta `PokeSurvivor-Vault-Pro`.
6. *(Opcional)* Haz clic en el icono de la pieza de puzle 🧩 en la barra superior del navegador y pulsa el icono de **fijar (chincheta)** para tener el acceso directo siempre visible.

---

## 📖 Cómo Usar la Extensión

### 💾 Hacer una Copia de Seguridad (Exportar)
1. Abre la pestaña de **PokéSurvivor** con tu partida cargada.
2. Haz clic en el icono de **PokéSurvivor Vault Pro**.
3. Pulsa **Exportar Archivo + Bóveda**.
4. Se descargará un archivo `PokeSurvivor_Vault_YYYY-MM-DDTHH-MM.json` en tu carpeta de Descargas y se actualizará la bóveda interna.

### 📂 Restaurar desde un Archivo (`.json`)
1. Abre la web de **PokéSurvivor** y haz clic en el icono de la extensión.
2. Pulsa **Restaurar desde Archivo (.json)** y selecciona tu copia de seguridad.
3. La extensión validará la firma **SHA-256**. Por seguridad, vuelve a seleccionar el archivo cuando te lo pida para confirmar la sobrescritura.
4. La página se recargará automáticamente con tu progreso restaurado.

### ⚡ Restaurar desde la Bóveda Interna
1. Si perdiste tus datos locales al cerrar el navegador, abre el juego y pulsa **Restaurar Última Bóveda**.
2. Vuelve a pulsar el botón antes de 4 segundos para confirmar y la partida se inyectará de inmediato.

---

## 🛠️ Solución de Problemas Frecuentes

* **"Abre la pestaña de PokéSurvivor primero":** Por seguridad, la extensión solo opera cuando la pestaña activa corresponde al dominio del juego o a un archivo local (`file://`).
* **"El botón Cargar descomprimida está desactivado":** Estás utilizando un navegador gestionado por una empresa o centro educativo con políticas restrictivas. Usa un perfil personal no gestionado o un navegador portable.
* **"Fallo SHA-256":** El archivo `.json` está incompleto o ha sido modificado manualmente. Utiliza una copia anterior o la bóveda interna.
