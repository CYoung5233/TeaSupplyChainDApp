import { network } from "hardhat";
const { ethers } = (await network.connect()) as any;

async function main() {
    console.log("---------------- Checking connection ----------------\n");
    // If this returns a block then connection is successful
    const blockNumber = await ethers.provider.getBlockNumber();
    console.log("Sepolia block number:", blockNumber);

    const [deployer] = await ethers.getSigners();
    const balance = await ethers.provider.getBalance(await deployer.getAddress());
    console.log("Deployer balance (ETH):", ethers.formatEther(balance));
    console.log("\n---- If a block number has been returned then connection is successful ----");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
