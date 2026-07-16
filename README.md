# Irys Solana Uploader - Ejemplo Educativo

Este repositorio es una guía práctica simplificada y educativa para aprender a utilizar **Irys** (anteriormente Bundlr) para cargar archivos de forma permanente y descentralizada a Arweave usando una **wallet de Solana (SOL)** en las redes de **Devnet** o **Mainnet**.

El objetivo es enseñar cómo conectar una wallet, consultar balances, fondear el nodo del cargador de Irys, subir una imagen, generar un archivo de metadatos (`metadata.json`) estándar y subir dicho JSON. Este flujo es la base para la creación de NFTs descentralizados en Solana.

---

## 📚 ¿Qué es Irys?

**Irys** es una red de escalado de procedencia de datos descentralizada. Permite subir datos a **Arweave** (un almacenamiento permanente en el que se paga una única vez y los datos duran para siempre) de manera rápida, confiable y con soporte para pagar las tarifas utilizando tokens de otras cadenas populares como Solana (SOL), Ethereum (ETH), Polygon (MATIC), etc.

### Conceptos Clave
1. **Permanencia**: Los archivos subidos a Arweave mediante Irys se almacenan de por vida.
2. **Nodo/Cargador (Uploader)**: Irys mantiene nodos a los que subes tus archivos. Para realizar cargas, debes transferir fondos (en este caso SOL) de tu wallet Solana al nodo de Irys (proceso llamado *Funding*).
3. **Conversión Atómica**: Las cantidades se manejan en la unidad mínima del token (en Solana, *lamports*, donde 1 SOL = $10^9$ lamports). El SDK proporciona herramientas de conversión (`utils.toAtomic` y `utils.fromAtomic`).

---

## 🛠️ Requisitos Previos

- **Node.js** (versión 16 o superior).
- **TypeScript** instalado globalmente o mediante dependencias del proyecto.
- Una **Wallet de Solana** con saldo en SOL (sea Devnet SOL para pruebas o Mainnet SOL para producción).

---

## 🚀 Configuración Inicial

1. **Instalar Dependencias**:
   ```bash
   npm install
   ```

2. **Configurar Variables de Entorno**:
   Copia el archivo de ejemplo `.env.example` y renómbralo a `.env`:
   ```bash
   cp .env.example .env
   ```
   Abre el archivo `.env` e ingresa tu llave privada de Solana. El formato puede ser:
   - Un string de Base58 (ej. extraído de Phantom o Solflare).
   - Un Array JSON de números (ej. del archivo de llave privada generado por la CLI de Solana: `[122, 45, 99...]`).

   *Opcional*: Si tienes endpoints RPC propios (por ejemplo, en Helius, QuickNode o Alchemy), puedes configurarlos bajo `SOLANA_DEVNET_RPC` o `SOLANA_MAINNET_RPC`.

3. **Colocar la Imagen de Prueba**:
   Asegúrate de tener un archivo de imagen en la ruta `files/image.jpg`. Este repositorio incluye una de ejemplo, pero puedes reemplazarla por la que desees.

---

## 🖥️ Scripts y Uso

Este proyecto expone varios comandos útiles mapeados en el `package.json` para facilitar la interacción y el aprendizaje:

### 1. Consultar Balances
Muestra el saldo actual en tu wallet de Solana y el saldo precargado disponible en el nodo de Irys.
```bash
# Para Devnet (por defecto)
npm run balance

# Para Mainnet
npm run balance mainnet
```

### 2. Subir Imagen y Generar Metadatos (Proceso Principal)
Este script realiza todo el flujo de forma secuencial:
1. Inicializa el cargador de Irys para la red especificada.
2. Comprueba el balance en Irys. (Si estás en Devnet y tu saldo es 0, intentará fondear automáticamente 0.002 SOL si tu wallet tiene fondos).
3. Sube la imagen local `files/image.jpg`.
4. Obtiene la URL de Irys/Arweave de la imagen subida.
5. Crea un archivo `files/metadata.json` con los metadatos estándar del NFT e inyecta la URL de la imagen.
6. Sube el archivo `metadata.json` a Irys.
7. Genera un log estructurado en `upload-log.md` con los enlaces finales.

```bash
# Para Devnet
npm run start

# Para Mainnet
npm run start mainnet
```

### 3. Retirar Fondos de Irys
Si has depositado más SOL del necesario en el nodo de Irys y deseas devolverlo a tu wallet de Solana, puedes realizar un retiro.
```bash
# Retirar una cantidad específica (ej. 0.005 SOL) en Devnet
npm run withdraw 0.005

# Retirar TODO el saldo disponible en Devnet
npm run withdraw all

# Retirar TODO el saldo disponible en Mainnet
npm run withdraw all mainnet
```

### 4. Sincronizar Transacción Manual (submit-tx)
Si realizas un fondeo de forma manual en la blockchain de Solana y la transacción no se refleja en el balance de Irys, puedes registrar la firma (Signature) de la transacción directamente con este script:
```bash
npm run submit-tx <SOLANA_TX_SIGNATURE> [devnet | mainnet]
```

---

## 📂 Estructura del Repositorio

- [index.ts](./index.ts): Archivo principal de ejecución que maneja la inicialización, la subida de imagen, la generación y la subida de metadatos.
- [check-balance.ts](./check-balance.ts): Script de utilidad para comprobar los balances en la wallet y en el nodo de Irys.
- [withdraw.ts](./withdraw.ts): Script de utilidad para retirar los fondos depositados en Irys de vuelta a la wallet.
- [submit-tx.ts](./submit-tx.ts): Utilidad para notificar manualmente firmas de transacción al nodo de Irys en caso de retraso en la sincronización.
- `files/`: Carpeta que contiene la imagen de prueba `image.jpg` y donde se guardará localmente el archivo `metadata.json`.


---

## 🔗 Referencias y Documentación Oficial de Irys

Para profundizar más en el funcionamiento del protocolo, te sugerimos revisar la documentación oficial:

- **Irys Developer Docs**: [https://docs.irys.xyz](https://docs.irys.xyz)
- **Concepto de Funding**: [https://docs.irys.xyz/learn/funding](https://docs.irys.xyz/learn/funding)
- **Carga de Archivos (Uploading)**: [https://docs.irys.xyz/developer-resources/uploading](https://docs.irys.xyz/developer-resources/uploading)
- **Irys SDK en GitHub**: [https://github.com/irys-xyz/js-sdk](https://github.com/irys-xyz/js-sdk)
