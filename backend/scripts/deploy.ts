import { network } from "hardhat";
const { ethers } = (await network.connect()) as any;


async function main() {
    console.log("---------------- Deploying ----------------\n");
    const Tea = await ethers.getContractFactory("Tea");
    const tea = await Tea.deploy();
    const deployTx = tea.deploymentTransaction();
    await tea.waitForDeployment();

    console.log("Tea Supply Chain contract deployed to:", await tea.getAddress());
    console.log("Deployment TX:", deployTx?.hash);
    console.log("Etherscan:", `https://sepolia.etherscan.io/tx/${deployTx?.hash}`);

    console.log("\n---------------- Finished deploying ----------------");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
