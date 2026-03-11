import hre from "hardhat";
import { network } from "hardhat";
const { ethers } = await network.connect();

async function main() {


  const contractAddress = "YOUR_DEPLOYED_ADDRESS";

  const tea = await ethers.getContractAt("Tea", contractAddress);

  const [admin] = await ethers.getSigners();

  console.log("Admin:", await admin.getAddress());

  const farmerRole = await tea.FARMER_ROLE();
  const processorRole = await tea.PROCESSOR_ROLE();
  const distributorRole = await tea.DISTRIBUTOR_ROLE();

  const farmer = "FARMER_WALLET";
  const processor = "PROCESSOR_WALLET";
  const distributor = "DISTRIBUTOR_WALLET";

  await tea.grantRole(farmerRole, farmer);
  await tea.grantRole(processorRole, processor);
  await tea.grantRole(distributorRole, distributor);

  console.log("Roles granted");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});