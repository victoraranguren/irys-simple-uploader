import { Uploader } from "@irys/upload";
import { Solana } from "@irys/upload-solana";
import { Keypair, Connection, clusterApiUrl } from "@solana/web3.js";
import * as fs from "fs";
import dotenv from "dotenv";
import bs58 from "bs58";

dotenv.config();

/**
 * Carga la llave privada desde las variables de entorno o un archivo local.
 * Soporta formato de array JSON [1,2,...] o string Base58.
 */
function loadPrivateKey(): Uint8Array {
    let privateKeyStr = (process.env.PRIVATE_KEY || "").trim();
    if (!privateKeyStr) {
        throw new Error("La variable de entorno PRIVATE_KEY no está configurada.");
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
        throw new Error(`Error al decodificar PRIVATE_KEY: ${(e as Error).message}`);
    }
}

const main = async () => {
    // Leer red del argumento (por defecto devnet)
    const networkArg = (process.argv[2] || "devnet").toLowerCase() as "devnet" | "mainnet";
    const isMainnet = networkArg === "mainnet";
    const network = isMainnet ? "mainnet" : "devnet";

    const secretKey = loadPrivateKey();
    const keypair = Keypair.fromSecretKey(secretKey);
    const address = keypair.publicKey.toBase58();

    console.log("=========================================");
    console.log(`Wallet Solana: ${address}`);
    console.log(`Red consultada: ${network.toUpperCase()}`);
    console.log("=========================================");

    // 1. Obtener balance directamente en la blockchain de Solana
    const rpcUrl = isMainnet
        ? process.env.SOLANA_MAINNET_RPC || "https://api.mainnet-beta.solana.com"
        : process.env.SOLANA_DEVNET_RPC || clusterApiUrl("devnet");

    const connection = new Connection(rpcUrl, "confirmed");
    try {
        const solBalance = await connection.getBalance(keypair.publicKey);
        console.log(`Saldo de Wallet en Solana: ${(solBalance / 1e9).toFixed(9)} SOL`);
    } catch (e: any) {
        console.error("Error al obtener saldo de Solana:", e.message || e);
    }

    // 2. Obtener balance fondeado en el nodo de Irys
    try {
        let uploader;
        if (isMainnet) {
            uploader = await Uploader(Solana)
                .withWallet(keypair.secretKey)
                .withRpc(rpcUrl);
        } else {
            uploader = await Uploader(Solana)
                .devnet()
                .withWallet(keypair.secretKey)
                .withRpc(rpcUrl);
        }
        
        const irysBalance = await uploader.getBalance(address);
        console.log(`Saldo disponible en Irys: ${uploader.utils.fromAtomic(irysBalance).toFixed(9)} SOL (${irysBalance.toString()} unidades atómicas)`);
    } catch (e: any) {
        console.error("Error al conectar con Irys u obtener el saldo:", e.message || e);
    }
    console.log("=========================================");
};

main();
