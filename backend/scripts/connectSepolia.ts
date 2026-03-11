import { network } from "hardhat";

async function main() {
    console.log("---------------- Checking connection ----------------\n");
    // Connect explicitly to the configured network
    const { ethers: sepoliaEthers } = await network.connect("sepolia");

    // If this returns a block then connection is successful
    const blockNumber = await sepoliaEthers.provider.getBlockNumber();
    console.log("Sepolia block number:", blockNumber);

    const [deployer] = await sepoliaEthers.getSigners();
    const balance = await sepoliaEthers.provider.getBalance(await deployer.getAddress());
    console.log("Deployer balance (ETH):", sepoliaEthers.formatEther(balance));
    console.log("\n---- If a block number has been returned then connection is successful ----");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});