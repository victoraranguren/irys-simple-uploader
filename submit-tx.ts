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
        throw new Error("PRIVATE_KEY environment variable is not configured.");
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
        throw new Error(`Failed to decode PRIVATE_KEY: ${(e as Error).message}`);
    }
}

const main = async () => {
    const txId = process.argv[2];
    const networkArg = process.argv[3] || "devnet";
    
    if (!txId) {
        console.error("Error: Please provide the Solana transaction ID/Signature.");
        console.error("Example: npm run submit-tx <SOLANA_TX_SIGNATURE> [devnet | mainnet]");
        process.exit(1);
    }

    const isMainnet = networkArg.toLowerCase() === "mainnet";
    const network = isMainnet ? "mainnet" : "devnet";

    const secretKey = loadPrivateKey();
    const keypair = Keypair.fromSecretKey(secretKey);
    const address = keypair.publicKey.toBase58();

    console.log(`Solana Wallet: ${address}`);
    console.log(`Attempting to sync manual funding transaction: ${txId}...`);

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

        // Register/submit the Solana transaction signature to the Irys node
        const response = await uploader.funder.submitFundTransaction(txId);
        console.log("Transaction successfully synced with Irys node!");
        console.log("Irys response:", response);

        // Query updated balance
        const finalBalance = await uploader.getBalance(address);
        console.log(`New available balance in Irys: ${uploader.utils.fromAtomic(finalBalance).toString()} SOL`);
    } catch (e: any) {
        console.error("Error registering transaction with Irys:", e.message || e);
    }
};

main();

