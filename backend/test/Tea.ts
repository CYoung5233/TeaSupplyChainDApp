import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = (await network.connect()) as any;

const toEpoch = (isoDate: string) => Math.floor(Date.parse(isoDate) / 1000);
const expectRevert = (promise: any, reason: string) =>
  (expect as any)(promise).to.be.revertedWith(reason);
const expectCustomError = (promise: any, contract: any, errorName: string) =>
  (expect as any)(promise).to.be.revertedWithCustomError(contract, errorName);

let tea: any;
let accounts: any[];
let roles: Record<string, string>;

const ADMIN = 0;
const FARMER = 1;
const PROCESSOR = 2;
const EXPORTER = 3;
const DISTRIBUTOR = 4;
const RETAILER = 5;
const CONSUMER = 6;
const OUTSIDER = 7;

async function transferOwnership(batchId: number, fromIndex: number, toIndex: number) {
  await tea.connect(accounts[fromIndex]).proposeTransfer(batchId, accounts[toIndex].address);
  await tea.connect(accounts[toIndex]).acceptTransfer(batchId);
}

describe("Tea", function () {
  beforeEach(async function () {
    accounts = await ethers.getSigners();

    const Tea = await ethers.getContractFactory("Tea");
    tea = await Tea.deploy();
    await tea.waitForDeployment();

    roles = {
      FARMER_ROLE: await tea.FARMER_ROLE(),
      PROCESSOR_ROLE: await tea.PROCESSOR_ROLE(),
      EXPORTER_ROLE: await tea.EXPORTER_ROLE(),
      DISTRIBUTOR_ROLE: await tea.DISTRIBUTOR_ROLE(),
      RETAILER_ROLE: await tea.RETAILER_ROLE(),
      END_CONSUMER_ROLE: await tea.END_CONSUMER_ROLE(),
    };

    await tea.grantRole(roles.FARMER_ROLE, accounts[FARMER].address);
    await tea.grantRole(roles.PROCESSOR_ROLE, accounts[PROCESSOR].address);
    await tea.grantRole(roles.EXPORTER_ROLE, accounts[EXPORTER].address);
    await tea.grantRole(roles.DISTRIBUTOR_ROLE, accounts[DISTRIBUTOR].address);
    await tea.grantRole(roles.RETAILER_ROLE, accounts[RETAILER].address);
    await tea.grantRole(roles.END_CONSUMER_ROLE, accounts[CONSUMER].address);
  });

  it("Test 1: Register batch sets initial fields", async function () {
    await tea
      .connect(accounts[FARMER])
      .registerBatch("F-001", "Hangzhou", toEpoch("2025-03-01"), "Organic");

    const batch = await tea.getBatch(1);
    expect(batch.batchId).to.equal(1n);
    expect(batch.farmerBatchId).to.equal("F-001");
    expect(batch.origin).to.equal("Hangzhou");
    expect(batch.currentOwner).to.equal(accounts[FARMER].address);
    expect(batch.state).to.equal(0n);
  });

  it("Test 2: Register batch without farmer role fails", async function () {
    await expectCustomError(
      tea
        .connect(accounts[OUTSIDER])
        .registerBatch("F-001", "Hangzhou", toEpoch("2025-03-01"), "Organic"),
      tea,
      "AccessControlUnauthorizedAccount"
    );
  });

  it("Test 3: Processing requires ownership", async function () {
    await tea
      .connect(accounts[FARMER])
      .registerBatch("F-002", "Yunnan", toEpoch("2025-03-02"), "Single estate");

    await expectRevert(
      tea
        .connect(accounts[PROCESSOR])
        .processBatch(1, toEpoch("2025-03-05"), "Pan-fried"),
      "Not batch owner"
    );

    await transferOwnership(1, FARMER, PROCESSOR);

    await tea
      .connect(accounts[PROCESSOR])
      .processBatch(1, toEpoch("2025-03-05"), "Pan-fried");

    const batch = await tea.getBatch(1);
    expect(batch.processor).to.equal(accounts[PROCESSOR].address);
    expect(batch.state).to.equal(1n);
  });

  it("Test 4: Distribution before export and export after distribution", async function () {
    await tea
      .connect(accounts[FARMER])
      .registerBatch("F-003", "Darjeeling", toEpoch("2025-03-03"), "FTGFOP1");

    await transferOwnership(1, FARMER, PROCESSOR);
    await tea
      .connect(accounts[PROCESSOR])
      .processBatch(1, toEpoch("2025-03-06"), "Oxidized");

    await transferOwnership(1, PROCESSOR, DISTRIBUTOR);
    await tea.connect(accounts[DISTRIBUTOR]).distributeBatch(1);

    let batch = await tea.getBatch(1);
    expect(batch.state).to.equal(3n);

    await transferOwnership(1, DISTRIBUTOR, EXPORTER);
    await tea.connect(accounts[EXPORTER]).exportBatch(1);

    batch = await tea.getBatch(1);
    expect(batch.state).to.equal(2n);
  });

  it("Test 5: Export can be repeated", async function () {
    await tea
      .connect(accounts[FARMER])
      .registerBatch("F-004", "Assam", toEpoch("2025-03-02"), "Fair Trade");

    await transferOwnership(1, FARMER, PROCESSOR);
    await tea
      .connect(accounts[PROCESSOR])
      .processBatch(1, toEpoch("2025-03-05"), "CTC");

    await transferOwnership(1, PROCESSOR, EXPORTER);
    await tea.connect(accounts[EXPORTER]).exportBatch(1);
    await tea.connect(accounts[EXPORTER]).exportBatch(1);

    const batch = await tea.getBatch(1);
    expect(batch.state).to.equal(2n);
  });

  it("Test 6: Must distribute before retail, and retail before consume", async function () {
    await tea
      .connect(accounts[FARMER])
      .registerBatch("F-005", "Fujian", toEpoch("2025-03-01"), "Organic");

    await transferOwnership(1, FARMER, PROCESSOR);
    await tea
      .connect(accounts[PROCESSOR])
      .processBatch(1, toEpoch("2025-03-05"), "Withered");

    await transferOwnership(1, PROCESSOR, RETAILER);
    await expectRevert(
      tea.connect(accounts[RETAILER]).markRetail(1),
      "Batch must be distributed first"
    );

    await transferOwnership(1, RETAILER, DISTRIBUTOR);
    await tea.connect(accounts[DISTRIBUTOR]).distributeBatch(1);

    await transferOwnership(1, DISTRIBUTOR, RETAILER);
    await tea.connect(accounts[RETAILER]).markRetail(1);

    await transferOwnership(1, RETAILER, CONSUMER);
    await tea.connect(accounts[CONSUMER]).consumeBatch(1);

    const batch = await tea.getBatch(1);
    expect(batch.state).to.equal(5n);
  });

  it("Test 7: getBatchBasic and getCurrentBatchId", async function () {
    await tea
      .connect(accounts[FARMER])
      .registerBatch("F-006", "Shizuoka", toEpoch("2025-03-07"), "Single estate");

    const current = await tea.getCurrentBatchId();
    expect(current).to.equal(1n);

    const basic = await tea.getBatchBasic(1);
    expect(basic[0]).to.equal(1n);
    expect(basic[1]).to.equal("F-006");
    expect(basic[2]).to.equal("Shizuoka");
    expect(basic[5]).to.equal(accounts[FARMER].address);
  });

  it("Test 8: Admin withdraw and non-admin blocked", async function () {
    await expectCustomError(
      tea.connect(accounts[OUTSIDER]).withdrawETH(accounts[OUTSIDER].address),
      tea,
      "AccessControlUnauthorizedAccount"
    );

    await accounts[ADMIN].sendTransaction({
      to: await tea.getAddress(),
      value: ethers.parseEther("0.02"),
    });

    await tea.connect(accounts[ADMIN]).withdrawETH(accounts[ADMIN].address);

    const balance = await ethers.provider.getBalance(await tea.getAddress());
    expect(balance).to.equal(0n);
  });

  it("Test 9: Non-existent batch reverts", async function () {
    await expectRevert(tea.getBatch(99), "Batch does not exist");
  });
});
