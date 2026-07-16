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
    // Uso: npm run withdraw <monto_en_sol | "all"> [devnet | mainnet]
    const amountArg = process.argv[2];
    const networkArg = process.argv[3] || "devnet";

    if (!amountArg) {
        console.log("=========================================");
        console.log("Uso:");
        console.log("  npm run withdraw <monto_en_sol | all> [devnet | mainnet]");
        console.log("\nEjemplos:");
        console.log("  npm run withdraw 0.01          -> Retira 0.01 SOL en Devnet");
        console.log("  npm run withdraw all           -> Retira todo el saldo disponible en Devnet");
        console.log("  npm run withdraw all mainnet   -> Retira todo el saldo disponible en Mainnet");
        console.log("=========================================");
        process.exit(1);
    }

    const isMainnet = networkArg.toLowerCase() === "mainnet";
    const network = isMainnet ? "mainnet" : "devnet";

    const secretKey = loadPrivateKey();
    const keypair = Keypair.fromSecretKey(secretKey);
    const address = keypair.publicKey.toBase58();

    console.log("=========================================");
    console.log(`Wallet Solana: ${address}`);
    console.log(`Red seleccionada: Irys ${network.toUpperCase()}`);
    console.log("=========================================");

    const rpcUrl = isMainnet
        ? process.env.SOLANA_MAINNET_RPC || "https://api.mainnet-beta.solana.com"
        : process.env.SOLANA_DEVNET_RPC || clusterApiUrl("devnet");

    try {
        // Inicializar el cargador (Uploader) de Irys
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

        // 1. Consultar balance actual cargado en Irys
        const irysBalance = await uploader.getBalance(address);
        const irysBalanceInSol = uploader.utils.fromAtomic(irysBalance);
        console.log(`Balance actual en Irys: ${irysBalanceInSol.toFixed(9)} SOL (${irysBalance.toString()} unidades atómicas)`);

        if (irysBalance.isZero()) {
            console.log("No tienes saldo disponible para retirar en Irys.");
            process.exit(0);
        }

        let withdrawAmountAtomic;

        if (amountArg.toLowerCase() === "all") {
            // Dejamos un margen pequeño para comisiones de transacción de Solana si aplica
            const SOLANA_FEE_ATOMIC = 5000;
            if (irysBalance.lte(SOLANA_FEE_ATOMIC)) {
                console.error(`Error: El saldo disponible (${irysBalanceInSol.toFixed(9)} SOL) es menor o igual a la tarifa de comisión (0.000005 SOL).`);
                process.exit(1);
            }
            withdrawAmountAtomic = irysBalance.minus(SOLANA_FEE_ATOMIC);
            const withdrawAmountSol = uploader.utils.fromAtomic(withdrawAmountAtomic);
            console.log(`Retirando todo el saldo disponible (restando 0.000005 SOL de comisión): ${withdrawAmountSol.toFixed(9)} SOL...`);
        } else {
            const amountInSol = parseFloat(amountArg);
            if (isNaN(amountInSol) || amountInSol <= 0) {
                console.error("Error: Monto de retiro no válido. Debe ser un número positivo o 'all'.");
                process.exit(1);
            }
            withdrawAmountAtomic = uploader.utils.toAtomic(amountInSol);
            const amountFormatted = uploader.utils.fromAtomic(withdrawAmountAtomic);

            if (withdrawAmountAtomic.gt(irysBalance)) {
                console.error(`Error: El saldo disponible (${irysBalanceInSol.toFixed(9)} SOL) es menor que el monto solicitado (${amountFormatted.toFixed(9)} SOL).`);
                process.exit(1);
            }
            console.log(`Retirando: ${amountFormatted.toFixed(9)} SOL...`);
        }

        // 2. Ejecutar el retiro
        console.log("Enviando solicitud de retiro a Irys...");
        
        let response;
        const uploaderAny = uploader as any;
        if (typeof uploaderAny.withdrawBalance === "function") {
            response = await uploaderAny.withdrawBalance(withdrawAmountAtomic);
        } else if (typeof uploaderAny.withdraw === "function") {
            response = await uploaderAny.withdraw(withdrawAmountAtomic);
        } else {
            throw new Error("No se encontró el método de retiro en la versión actual del SDK.");
        }

        console.log("\n=========================================");
        console.log("¡Retiro exitoso!");
        console.log("Detalles del retiro:");
        console.log(JSON.stringify(response, null, 2));
        console.log("=========================================");

        // 3. Consultar nuevo balance
        const newBalance = await uploader.getBalance(address);
        console.log(`Nuevo balance disponible en Irys: ${uploader.utils.fromAtomic(newBalance).toFixed(9)} SOL`);

    } catch (e: any) {
        console.error("\n❌ Error durante el retiro:");
        console.error(e.message || e);
    }
    console.log("=========================================");
};

main();
