import { Uploader } from "@irys/upload";
import { Solana } from "@irys/upload-solana";
import { Keypair, clusterApiUrl } from "@solana/web3.js";
import * as fs from "fs";
import dotenv from "dotenv";
import bs58 from "bs58";

dotenv.config();

/**
 * Loads the private key from environment variables or a local file.
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
 * Initializes and returns an instance of the Irys Uploader for Solana.
 * @param network 'devnet' | 'mainnet'
 */
export async function getIrysUploader(network: "devnet" | "mainnet") {
    const isMainnet = network === "mainnet";

    // Get custom RPC if configured, otherwise use default RPC
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

    console.log(`📡 Successfully connected to Irys ${network.toUpperCase()}`);
    console.log(`💳 Linked wallet: ${keypair.publicKey.toBase58()}`);

    return uploader;
}

/**
 * Funds the Irys account node with a specific amount of SOL.
 * @param uploader Irys Uploader instance
 * @param amountInSol Amount of SOL to fund (e.g. 0.01)
 */
export async function fundIrys(uploader: any, amountInSol: number) {
    const fundAmount = uploader.utils.toAtomic(amountInSol);
    console.log(`Funding Irys node with ${amountInSol} SOL...`);
    try {
        const fundTx = await uploader.fund(fundAmount);
        console.log(`Funding successful! Transaction ID: ${fundTx.id}`);
        return fundTx;
    } catch (e: any) {
        console.error("Error during funding:", e.message || e);
        throw e;
    }
}

/**
 * Uploads an image, generates an example metadata.json file, and uploads it to Irys.
 * @param network 'devnet' | 'mainnet'
 */
export async function uploadAssets(network: "devnet" | "mainnet") {
    console.log("=========================================");
    console.log(`🚀 Starting upload process on Irys (${network.toUpperCase()})...`);
    console.log("=========================================");

    const uploader = await getIrysUploader(network);
    const address = keypair.publicKey.toBase58();

    const imagePath = "./files/image.jpg";
    const metadataPath = "./files/metadata.json";

    if (!fs.existsSync(imagePath)) {
        throw new Error(`Image file not found at: ${imagePath}`);
    }

    // Step 1: Upload Image
    console.log("\n[1/3] Uploading Image file...");
    const imageTags = [{ name: "Content-Type", value: "image/jpeg" }];
    const imageReceipt = await uploader.uploadFile(imagePath, { tags: imageTags });
    const imageUrl = `https://gateway.irys.xyz/${imageReceipt.id}`;
    console.log(`✅ Image uploaded successfully: ${imageUrl}`);

    // Step 2: Create example metadata.json using the uploaded image URL
    console.log("\n[2/3] Generating example metadata.json file...");
    const metadataObj = {
        name: "Irys Educational Collection",
        symbol: "EDUIRYS",
        description: "This is an example NFT created for educational content on uploading with Irys and Solana.",
        image: imageUrl,
        attributes: [
            {
                trait_type: "Class",
                value: "Software Development"
            },
            {
                trait_type: "Platform",
                value: "Solana + Irys"
            },
            {
                trait_type: "Educational",
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

    // Save locally
    fs.writeFileSync(metadataPath, JSON.stringify(metadataObj, null, 2), "utf-8");
    console.log(`✅ metadata.json file saved locally at: ${metadataPath}`);

    // Step 3: Upload metadata.json to Irys
    console.log("\n[3/3] Uploading metadata.json file to Irys...");
    const metadataTags = [{ name: "Content-Type", value: "application/json" }];
    const metadataReceipt = await uploader.uploadFile(metadataPath, { tags: metadataTags });
    const metadataUrl = `https://gateway.irys.xyz/${metadataReceipt.id}`;
    console.log(`✅ Metadata JSON uploaded successfully: ${metadataUrl}`);

    // Generate a detailed log in Markdown format for record keeping or study
    const logPath = "./upload-log.md";
    const logContent = `# File Upload Log - Irys (${network.toUpperCase()})

This log records the upload of educational content using the Irys SDK.

## Creator Wallet
* **Public Address:** \`${address}\`

## Uploaded Files
1. **Example Image:**
   * **Local path:** \`${imagePath}\`
   * **Irys Transaction ID:** \`${imageReceipt.id}\`
   * **Direct link:** [${imageUrl}](${imageUrl})

2. **NFT Metadata (JSON):**
   * **Local path:** \`${metadataPath}\`
   * **Irys Transaction ID:** \`${metadataReceipt.id}\`
   * **Direct link:** [${metadataUrl}](${metadataUrl})

---
*Upload date: ${new Date().toISOString()}*
`;

    fs.writeFileSync(logPath, logContent, "utf-8");
    console.log(`\n=========================================`);
    console.log(`🎉 Process completed successfully!`);
    console.log(`Log generated at: ${logPath}`);
    console.log(`=========================================`);

    return { imageUrl, metadataUrl };
}

const main = async () => {
    const networkArg = (process.argv[2] || "devnet").toLowerCase() as "devnet" | "mainnet";
    const network = networkArg === "mainnet" ? "mainnet" : "devnet";

    try {
        const uploader = await getIrysUploader(network);
        
        // Query Irys balance before uploading
        const initialBalance = await uploader.getBalance(keypair.publicKey.toBase58());
        const balanceInSol = uploader.utils.fromAtomic(initialBalance);
        console.log(`Current Irys balance: ${balanceInSol.toString()} SOL`);

        // If balance is zero or near zero, and we are on devnet, alert about funding
        if (initialBalance.isZero()) {
            console.log("\n⚠️  Your Irys balance is 0 SOL!");
            console.log("Note: To upload files, you must fund the node first.");
            console.log("You can use the withdraw/funding scripts or a faucet if you are on Devnet.");
            console.log("If you want to automatically fund 0.005 SOL for this test, you can modify the code.");
            
            // Optional auto-funding to facilitate testing on devnet
            if (network === "devnet") {
                console.log("\nAttempting auto-funding of 0.002 SOL on Devnet...");
                try {
                    await fundIrys(uploader, 0.002);
                } catch (fundErr: any) {
                    console.log("Could not auto-fund (make sure your Solana wallet has Devnet SOL balance).");
                }
            }
        }

        await uploadAssets(network);

        // Query final Irys balance
        const finalBalance = await uploader.getBalance(keypair.publicKey.toBase58());
        console.log(`Final Irys balance: ${uploader.utils.fromAtomic(finalBalance).toString()} SOL`);

    } catch (e: any) {
        console.error("❌ An error occurred in the main process:", e.message || e);
    }
};

main();

