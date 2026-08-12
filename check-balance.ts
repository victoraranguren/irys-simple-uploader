import { Uploader } from "@irys/upload";
import { Solana } from "@irys/upload-solana";
import { Keypair, Connection, clusterApiUrl } from "@solana/web3.js";
import * as fs from "fs";
import dotenv from "dotenv";
import bs58 from "bs58";

dotenv.config();

/**
 * Loads the private key from environment variables or a local file.
 * Supports JSON array format [1,2,...] or Base58 string.
 */
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
    // Read network from command line argument (defaults to devnet)
    const networkArg = (process.argv[2] || "devnet").toLowerCase() as "devnet" | "mainnet";
    const isMainnet = networkArg === "mainnet";
    const network = isMainnet ? "mainnet" : "devnet";

    const secretKey = loadPrivateKey();
    const keypair = Keypair.fromSecretKey(secretKey);
    const address = keypair.publicKey.toBase58();

    console.log("=========================================");
    console.log(`Solana Wallet: ${address}`);
    console.log(`Queried Network: ${network.toUpperCase()}`);
    console.log("=========================================");

    // 1. Get balance directly on the Solana blockchain
    const rpcUrl = isMainnet
        ? process.env.SOLANA_MAINNET_RPC || "https://api.mainnet-beta.solana.com"
        : process.env.SOLANA_DEVNET_RPC || clusterApiUrl("devnet");

    const connection = new Connection(rpcUrl, "confirmed");
    try {
        const solBalance = await connection.getBalance(keypair.publicKey);
        console.log(`Solana Wallet Balance: ${(solBalance / 1e9).toFixed(9)} SOL`);
    } catch (e: any) {
        console.error("Error fetching Solana balance:", e.message || e);
    }

    // 2. Get funded balance on the Irys node
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
        console.log(`Available Irys balance: ${uploader.utils.fromAtomic(irysBalance).toFixed(9)} SOL (${irysBalance.toString()} atomic units)`);
    } catch (e: any) {
        console.error("Error connecting to Irys or fetching balance:", e.message || e);
    }
    console.log("=========================================");
};

main();

