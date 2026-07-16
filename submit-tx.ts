import { Uploader } from "@irys/upload";
import { Solana } from "@irys/upload-solana";
import { Keypair, clusterApiUrl } from "@solana/web3.js";
import * as fs from "fs";
import dotenv from "dotenv";
import bs58 from "bs58";

dotenv.config();

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
    const txId = process.argv[2];
    const networkArg = process.argv[3] || "devnet";
    
    if (!txId) {
        console.error("Error: Por favor proporciona el ID/Firma de la transacción de Solana.");
        console.error("Ejemplo: npm run submit-tx <SOLANA_TX_SIGNATURE> [devnet | mainnet]");
        process.exit(1);
    }

    const isMainnet = networkArg.toLowerCase() === "mainnet";
    const network = isMainnet ? "mainnet" : "devnet";

    const secretKey = loadPrivateKey();
    const keypair = Keypair.fromSecretKey(secretKey);
    const address = keypair.publicKey.toBase58();

    console.log(`Wallet Solana: ${address}`);
    console.log(`Intentando sincronizar transacción de fondeo manual: ${txId}...`);

    const rpcUrl = isMainnet
        ? process.env.SOLANA_MAINNET_RPC || "https://api.mainnet-beta.solana.com"
        : process.env.SOLANA_DEVNET_RPC || clusterApiUrl("devnet");

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

        // Registrar/enviar la firma de la transacción de Solana al nodo de Irys
        const response = await uploader.funder.submitFundTransaction(txId);
        console.log("¡Transacción sincronizada con el nodo de Irys con éxito!");
        console.log("Respuesta de Irys:", response);

        // Consultar el balance actualizado
        const finalBalance = await uploader.getBalance(address);
        console.log(`Nuevo balance disponible en Irys: ${uploader.utils.fromAtomic(finalBalance).toString()} SOL`);
    } catch (e: any) {
        console.error("Error al registrar la transacción en Irys:", e.message || e);
    }
};

main();
