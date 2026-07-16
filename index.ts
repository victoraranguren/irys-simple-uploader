import { Uploader } from "@irys/upload";
import { Solana } from "@irys/upload-solana";
import { Keypair, clusterApiUrl } from "@solana/web3.js";
import * as fs from "fs";
import dotenv from "dotenv";
import bs58 from "bs58";

dotenv.config();

/**
 * Carga la llave privada desde las variables de entorno o un archivo local.
 */
function loadPrivateKey(): Uint8Array {
    let privateKeyStr = (process.env.PRIVATE_KEY || "").trim();
    if (!privateKeyStr) {
        throw new Error("PRIVATE_KEY environment variable is not set or is empty");
    }

    if (fs.existsSync(privateKeyStr)) {
        try {
            privateKeyStr = fs.readFileSync(privateKeyStr, "utf-8").trim();
        } catch (e) {}
    }

    if (privateKeyStr.startsWith("[") && privateKeyStr.endsWith("]")) {
        try {
            const parsed = JSON.parse(privateKeyStr);
            if (Array.isArray(parsed)) {
                return Uint8Array.from(parsed);
            }
        } catch (e) {}
    }

    try {
        return bs58.decode(privateKeyStr);
    } catch (e) {
        throw new Error(`Failed to parse PRIVATE_KEY: ${(e as Error).message}`);
    }
}

const secretKey = loadPrivateKey();
const keypair = Keypair.fromSecretKey(secretKey);

/**
 * Inicializa y retorna una instancia del Uploader de Irys para Solana
 * @param network 'devnet' | 'mainnet'
 */
export async function getIrysUploader(network: "devnet" | "mainnet") {
    const isMainnet = network === "mainnet";

    // Obtener RPC personalizado si existe, de lo contrario usar RPC por defecto
    const providerUrl = isMainnet
        ? process.env.SOLANA_MAINNET_RPC || "https://api.mainnet-beta.solana.com"
        : process.env.SOLANA_DEVNET_RPC || clusterApiUrl("devnet");

    let uploader;
    if (isMainnet) {
        uploader = await Uploader(Solana)
            .withWallet(keypair.secretKey)
            .withRpc(providerUrl);
    } else {
        uploader = await Uploader(Solana)
            .devnet()
            .withWallet(keypair.secretKey)
            .withRpc(providerUrl);
    }

    console.log(`📡 Conectado exitosamente a Irys ${network.toUpperCase()}`);
    console.log(`💳 Wallet vinculada: ${keypair.publicKey.toBase58()}`);

    return uploader;
}

/**
 * Fondea la cuenta de Irys con una cantidad específica de SOL.
 * @param uploader Instancia del Uploader de Irys
 * @param amountInSol Cantidad de SOL a fondear (ej. 0.01)
 */
export async function fundIrys(uploader: any, amountInSol: number) {
    const fundAmount = uploader.utils.toAtomic(amountInSol);
    console.log(`Fondeando el nodo de Irys con ${amountInSol} SOL...`);
    try {
        const fundTx = await uploader.fund(fundAmount);
        console.log(`¡Fondeo exitoso! ID de Transacción: ${fundTx.id}`);
        return fundTx;
    } catch (e: any) {
        console.error("Error durante el fondeo:", e.message || e);
        throw e;
    }
}

/**
 * Sube una imagen, genera un archivo metadata.json de ejemplo y lo sube a Irys.
 * @param network 'devnet' | 'mainnet'
 */
export async function uploadAssets(network: "devnet" | "mainnet") {
    console.log("=========================================");
    console.log(`🚀 Iniciando proceso de subida en Irys (${network.toUpperCase()})...`);
    console.log("=========================================");

    const uploader = await getIrysUploader(network);
    const address = keypair.publicKey.toBase58();

    const imagePath = "./files/image.jpg";
    const metadataPath = "./files/metadata.json";

    if (!fs.existsSync(imagePath)) {
        throw new Error(`No se encontró la imagen en: ${imagePath}`);
    }

    // Paso 1: Subir Imagen
    console.log("\n[1/3] Subiendo archivo de Imagen...");
    const imageTags = [{ name: "Content-Type", value: "image/jpeg" }];
    const imageReceipt = await uploader.uploadFile(imagePath, { tags: imageTags });
    const imageUrl = `https://gateway.irys.xyz/${imageReceipt.id}`;
    console.log(`✅ Imagen subida con éxito: ${imageUrl}`);

    // Paso 2: Crear metadata.json de ejemplo usando la URL de la imagen
    console.log("\n[2/3] Generando archivo metadata.json de ejemplo...");
    const metadataObj = {
        name: "Colección Educativa Irys",
        symbol: "EDUIRYS",
        description: "Este es un NFT de ejemplo creado para el contenido educativo de subidas con Irys y Solana.",
        image: imageUrl,
        attributes: [
            {
                trait_type: "Clase",
                value: "Desarrollo de Software"
            },
            {
                trait_type: "Plataforma",
                value: "Solana + Irys"
            },
            {
                trait_type: "Educativo",
                value: "true"
            }
        ],
        properties: {
            files: [
                {
                    uri: imageUrl,
                    type: "image/jpeg"
                }
            ],
            category: "image"
        }
    };

    // Escribir localmente
    fs.writeFileSync(metadataPath, JSON.stringify(metadataObj, null, 2), "utf-8");
    console.log(`✅ Archivo metadata.json guardado localmente en: ${metadataPath}`);

    // Paso 3: Subir metadata.json a Irys
    console.log("\n[3/3] Subiendo archivo metadata.json a Irys...");
    const metadataTags = [{ name: "Content-Type", value: "application/json" }];
    const metadataReceipt = await uploader.uploadFile(metadataPath, { tags: metadataTags });
    const metadataUrl = `https://gateway.irys.xyz/${metadataReceipt.id}`;
    console.log(`✅ Metadata JSON subido con éxito: ${metadataUrl}`);

    // Generar un log detallado en formato Markdown para registro o estudio
    const logPath = "./upload-log.md";
    const logContent = `# Log de Subida de Archivos - Irys (${network.toUpperCase()})

Este log registra la subida del contenido educativo utilizando el SDK de Irys.

## Wallet del Creador
* **Dirección Pública:** \`${address}\`

## Archivos Subidos
1. **Imagen de Ejemplo:**
   * **Ruta local:** \`${imagePath}\`
   * **Irys Transaction ID:** \`${imageReceipt.id}\`
   * **Enlace de acceso directo:** [${imageUrl}](${imageUrl})

2. **Metadatos del NFT (JSON):**
   * **Ruta local:** \`${metadataPath}\`
   * **Irys Transaction ID:** \`${metadataReceipt.id}\`
   * **Enlace de acceso directo:** [${metadataUrl}](${metadataUrl})

---
*Fecha de subida: ${new Date().toISOString()}*
`;

    fs.writeFileSync(logPath, logContent, "utf-8");
    console.log(`\n=========================================`);
    console.log(`🎉 ¡Proceso completado con éxito!`);
    console.log(`Log generado en: ${logPath}`);
    console.log(`=========================================`);

    return { imageUrl, metadataUrl };
}

const main = async () => {
    const networkArg = (process.argv[2] || "devnet").toLowerCase() as "devnet" | "mainnet";
    const network = networkArg === "mainnet" ? "mainnet" : "devnet";

    try {
        const uploader = await getIrysUploader(network);
        
        // Consultar balance en Irys antes de subir
        const initialBalance = await uploader.getBalance(keypair.publicKey.toBase58());
        const balanceInSol = uploader.utils.fromAtomic(initialBalance);
        console.log(`Balance actual en Irys: ${balanceInSol.toString()} SOL`);

        // Si el balance es cero o casi cero, y estamos en devnet, podemos alertar sobre el fondeo
        if (initialBalance.isZero()) {
            console.log("\n⚠️  ¡Tu balance en Irys es 0 SOL!");
            console.log("Nota: Para subir archivos debes fondear el nodo primero.");
            console.log("Puedes usar el script para fondear o usar un faucet si estás en Devnet.");
            console.log("Si deseas fondear automáticamente 0.005 SOL para esta prueba, puedes modificar el código.");
            
            // Fondeo automático opcional para facilitar las pruebas en devnet
            if (network === "devnet") {
                console.log("\nIntentando autofondear 0.002 SOL en Devnet...");
                try {
                    await fundIrys(uploader, 0.002);
                } catch (fundErr: any) {
                    console.log("No se pudo fondear automáticamente (asegúrate de que tu wallet Solana tiene saldo Devnet SOL).");
                }
            }
        }

        await uploadAssets(network);

        // Consultar balance final en Irys
        const finalBalance = await uploader.getBalance(keypair.publicKey.toBase58());
        console.log(`Balance final en Irys: ${uploader.utils.fromAtomic(finalBalance).toString()} SOL`);

    } catch (e: any) {
        console.error("❌ Ocurrió un error en el proceso principal:", e.message || e);
    }
};

main();
