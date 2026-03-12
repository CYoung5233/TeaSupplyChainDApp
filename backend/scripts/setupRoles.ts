import hre from "hardhat";
import { network } from "hardhat";

const { ethers } = (await network.connect()) as any;

async function main() {


  const contractAddress = "DEPLOYED_ADDRESS";

  const tea = await ethers.getContractAt("Tea", contractAddress);

  const [admin] = await ethers.getSigners();

  console.log("Admin:", await admin.getAddress());

  const farmerRole = await tea.FARMER_ROLE();
  const processorRole = await tea.PROCESSOR_ROLE();
  const distributorRole = await tea.DISTRIBUTOR_ROLE();
  const exporterRole = await tea.DISTRIBUTOR_ROLE();
  const retailerRole = await tea.DISTRIBUTOR_ROLE();

  const farmer = "FARMER_WALLET";
  const processor = "PROCESSOR_WALLET";
  const distributor = "DISTRIBUTOR_WALLET";
  const exporter = "EXPORTER_WALLET";
  const retailer = "RETAILER_WALLET";

  await tea.grantRole(farmerRole, farmer);
  await tea.grantRole(processorRole, processor);
  await tea.grantRole(distributorRole, distributor);
  await tea.grantRole(exporterRole, exporter);
  await tea.grantRole(retailerRole, retailer);

  console.log("Roles granted");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});