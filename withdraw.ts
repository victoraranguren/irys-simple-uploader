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
    // Usage: npm run withdraw <amount_in_sol | "all"> [devnet | mainnet]
    const amountArg = process.argv[2];
    const networkArg = process.argv[3] || "devnet";

    if (!amountArg) {
        console.log("=========================================");
        console.log("Usage:");
        console.log("  npm run withdraw <amount_in_sol | all> [devnet | mainnet]");
        console.log("\nExamples:");
        console.log("  npm run withdraw 0.01          -> Withdraws 0.01 SOL on Devnet");
        console.log("  npm run withdraw all           -> Withdraws all available balance on Devnet");
        console.log("  npm run withdraw all mainnet   -> Withdraws all available balance on Mainnet");
        console.log("=========================================");
        process.exit(1);
    }

    const isMainnet = networkArg.toLowerCase() === "mainnet";
    const network = isMainnet ? "mainnet" : "devnet";

    const secretKey = loadPrivateKey();
    const keypair = Keypair.fromSecretKey(secretKey);
    const address = keypair.publicKey.toBase58();

    console.log("=========================================");
    console.log(`Solana Wallet: ${address}`);
    console.log(`Selected Network: Irys ${network.toUpperCase()}`);
    console.log("=========================================");

    const rpcUrl = isMainnet
        ? process.env.SOLANA_MAINNET_RPC || "https://api.mainnet-beta.solana.com"
        : process.env.SOLANA_DEVNET_RPC || clusterApiUrl("devnet");

    try {
        // Initialize the Irys Uploader
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

        // 1. Query current balance loaded on Irys
        const irysBalance = await uploader.getBalance(address);
        const irysBalanceInSol = uploader.utils.fromAtomic(irysBalance);
        console.log(`Current Irys balance: ${irysBalanceInSol.toFixed(9)} SOL (${irysBalance.toString()} atomic units)`);

        if (irysBalance.isZero()) {
            console.log("You have no available balance to withdraw on Irys.");
            process.exit(0);
        }

        let withdrawAmountAtomic;

        if (amountArg.toLowerCase() === "all") {
            // Leave a small margin for Solana transaction fees if applicable
            const SOLANA_FEE_ATOMIC = 5000;
            if (irysBalance.lte(SOLANA_FEE_ATOMIC)) {
                console.error(`Error: Available balance (${irysBalanceInSol.toFixed(9)} SOL) is less than or equal to the transaction fee (0.000005 SOL).`);
                process.exit(1);
            }
            withdrawAmountAtomic = irysBalance.minus(SOLANA_FEE_ATOMIC);
            const withdrawAmountSol = uploader.utils.fromAtomic(withdrawAmountAtomic);
            console.log(`Withdrawing all available balance (subtracting 0.000005 SOL fee): ${withdrawAmountSol.toFixed(9)} SOL...`);
        } else {
            const amountInSol = parseFloat(amountArg);
            if (isNaN(amountInSol) || amountInSol <= 0) {
                console.error("Error: Invalid withdrawal amount. Must be a positive number or 'all'.");
                process.exit(1);
            }
            withdrawAmountAtomic = uploader.utils.toAtomic(amountInSol);
            const amountFormatted = uploader.utils.fromAtomic(withdrawAmountAtomic);

            if (withdrawAmountAtomic.gt(irysBalance)) {
                console.error(`Error: Available balance (${irysBalanceInSol.toFixed(9)} SOL) is less than the requested amount (${amountFormatted.toFixed(9)} SOL).`);
                process.exit(1);
            }
            console.log(`Withdrawing: ${amountFormatted.toFixed(9)} SOL...`);
        }

        // 2. Execute withdrawal
        console.log("Sending withdrawal request to Irys...");
        
        let response;
        const uploaderAny = uploader as any;
        if (typeof uploaderAny.withdrawBalance === "function") {
            response = await uploaderAny.withdrawBalance(withdrawAmountAtomic);
        } else if (typeof uploaderAny.withdraw === "function") {
            response = await uploaderAny.withdraw(withdrawAmountAtomic);
        } else {
            throw new Error("Withdrawal method not found in the current SDK version.");
        }

        console.log("\n=========================================");
        console.log("Withdrawal successful!");
        console.log("Withdrawal details:");
        console.log(JSON.stringify(response, null, 2));
        console.log("=========================================");

        // 3. Query new balance
        const newBalance = await uploader.getBalance(address);
        console.log(`New available balance in Irys: ${uploader.utils.fromAtomic(newBalance).toFixed(9)} SOL`);

    } catch (e: any) {
        console.error("\n❌ Error during withdrawal:");
        console.error(e.message || e);
    }
    console.log("=========================================");
};

main();

