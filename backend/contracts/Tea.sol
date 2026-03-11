// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract Tea is AccessControl {

    // Roles
    bytes32 public constant FARMER_ROLE = keccak256("FARMER_ROLE");
    bytes32 public constant PROCESSOR_ROLE = keccak256("PROCESSOR_ROLE");
    bytes32 public constant EXPORTER_ROLE = keccak256("EXPORTER_ROLE");
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");
    bytes32 public constant RETAILER_ROLE = keccak256("RETAILER_ROLE");
    bytes32 public constant END_CONSUMER_ROLE = keccak256("END_CONSUMER_ROLE");

    // Batch State Machine
    enum BatchState {
        Registered,
        Processed,
        Exported,
        Distributed,
        Retail,
        Consumed
    }

    // Tea Batch Struct
    struct TeaBatch {
        uint256 batchId;
        string farmerBatchId;
        string origin;
        uint256 harvestDate;
        uint256 packagedDate;
        string processingMethod;
        string certifications;
        address currentOwner;
        BatchState state;
        address farmer;
        address processor;
        address latestExporter;
        address latestDistributor;
        address latestRetailer;
    }

    // Ownership Transfer Struct
    struct PendingTransfer {
        address from;
        address to;
        bool exists;
    }

    // Storage
    uint256 private nextBatchId = 1;

    mapping(uint256 => TeaBatch) public batches;
    mapping(uint256 => PendingTransfer) public pendingTransfers;

    // Events
    event BatchRegistered(uint256 batchId, string farmerBatchId, address owner);
    event BatchProcessed(uint256 batchId);
    event BatchExported(uint256 batchId);
    event BatchDistributed(uint256 batchId);
    event BatchRetail(uint256 batchId);
    event BatchConsumed(uint256 batchId);

    event TransferProposed(uint256 batchId, address from, address to);
    event TransferCompleted(uint256 batchId, address from, address to);

    // Constructor
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // Modifiers
    modifier batchExists(uint256 batchId) {
        require(batchId > 0 && batchId < nextBatchId, "Batch does not exist");
        _;
    }

    modifier onlyOwner(uint256 batchId) {
        require(batches[batchId].currentOwner == msg.sender, "Not batch owner");
        _;
    }

    // Register Batch (Farmer)
    function registerBatch(
        string memory farmerBatchId,
        string memory origin,
        uint256 harvestDate,
        string memory certifications
    ) public onlyRole(FARMER_ROLE) {

        uint256 batchId = nextBatchId++;

        batches[batchId] = TeaBatch({
            batchId: batchId,
            farmerBatchId: farmerBatchId,
            origin: origin,
            harvestDate: harvestDate,
            packagedDate: 0,
            processingMethod: "",
            certifications: certifications,
            currentOwner: msg.sender,
            state: BatchState.Registered,
            farmer: msg.sender,
            processor: address(0),
            latestExporter: address(0),
            latestDistributor: address(0),
            latestRetailer: address(0)
        });

        emit BatchRegistered(batchId, farmerBatchId, msg.sender);
    }

    // Process Batch
    function processBatch(uint256 batchId, uint256 packagedDate, string memory processingMethod)
        public
        batchExists(batchId)
        onlyOwner(batchId)
        onlyRole(PROCESSOR_ROLE)
    {
        TeaBatch storage batch = batches[batchId];
        require(
            batch.state == BatchState.Registered,
            "Invalid state for processing"
        );

        batch.packagedDate = packagedDate;
        batch.processingMethod = processingMethod;
        batch.processor = msg.sender;
        batch.state = BatchState.Processed;

        emit BatchProcessed(batchId);
    }

    // Export Batch
    function exportBatch(uint256 batchId)
        public
        batchExists(batchId)
        onlyOwner(batchId)
        onlyRole(EXPORTER_ROLE)
    {
        TeaBatch storage batch = batches[batchId];

        require(
            batch.state == BatchState.Processed ||
            batch.state == BatchState.Exported ||
            batch.state == BatchState.Distributed,
            "Invalid state for export"
        );
        
        batch.latestExporter = msg.sender;
        batch.state = BatchState.Exported;

        emit BatchExported(batchId);
    }

    // Distribute Batch
    function distributeBatch(uint256 batchId)
        public
        batchExists(batchId)
        onlyOwner(batchId)
        onlyRole(DISTRIBUTOR_ROLE)
    {
        TeaBatch storage batch = batches[batchId];

        require(
            batch.state == BatchState.Processed ||
            batch.state == BatchState.Exported ||
            batch.state == BatchState.Distributed,
            "Invalid state for distribution"
        );

        batch.latestDistributor = msg.sender;
        batch.state = BatchState.Distributed;

        emit BatchDistributed(batchId);
    }

    // Mark Retail
    function markRetail(uint256 batchId)
        public
        batchExists(batchId)
        onlyOwner(batchId)
        onlyRole(RETAILER_ROLE)
    {
        TeaBatch storage batch = batches[batchId];

        require(
            batch.state == BatchState.Distributed,
            "Batch must be distributed first"
        );

        batch.latestRetailer = msg.sender;
        batch.state = BatchState.Retail;

        emit BatchRetail(batchId);
    }

    // Consumer Purchase
    function consumeBatch(uint256 batchId)
        public
        batchExists(batchId)
        onlyOwner(batchId)
        onlyRole(END_CONSUMER_ROLE)
    {
        TeaBatch storage batch = batches[batchId];

        require(batch.state == BatchState.Retail, "Not available for consumer");

        batch.state = BatchState.Consumed;

        emit BatchConsumed(batchId);
    }

    // Ownership Transfer
    // Step 1: Seller proposes
    function proposeTransfer(uint256 batchId, address to)
        public
        batchExists(batchId)
        onlyOwner(batchId)
    {
        require(to != address(0), "Invalid address");

        pendingTransfers[batchId] = PendingTransfer({
            from: msg.sender,
            to: to,
            exists: true
        });

        emit TransferProposed(batchId, msg.sender, to);
    }

    // Step 2: Buyer accepts
    function acceptTransfer(uint256 batchId)
        public
        batchExists(batchId)
    {
        PendingTransfer storage transfer = pendingTransfers[batchId];

        require(transfer.exists, "No pending transfer");
        require(transfer.to == msg.sender, "Not transfer recipient");

        require(batches[batchId].currentOwner == transfer.from, "Owner changed");
        batches[batchId].currentOwner = msg.sender;

        emit TransferCompleted(batchId, transfer.from, msg.sender);

        delete pendingTransfers[batchId];
    }

    // Query Batch
    function getBatch(uint256 batchId)
        public
        view
        batchExists(batchId)
        returns (TeaBatch memory)
    {
        return batches[batchId];
    }

    function getBatchBasic(uint256 batchId)
        public
        view
        returns (
            uint256,
            string memory,
            string memory,
            uint256,
            uint256,
            address,
            BatchState
        )
    {
        TeaBatch memory b = batches[batchId];

        return (
            b.batchId,
            b.farmerBatchId,
            b.origin,
            b.harvestDate,
            b.packagedDate,
            b.currentOwner,
            b.state
        );
    }

    function getCurrentBatchId() public view returns (uint256) {
        return nextBatchId - 1;
    }

    //Ensures that accidentally sent funds won't be lost forever (bad practice but it's just on a testnet)
    
    receive() external payable {}

    function withdrawETH(address payable to)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(to != address(0), "Invalid address");

        uint256 balance = address(this).balance;

        require(balance > 0, "No ETH to withdraw");

        (bool success, ) = to.call{value: balance}("");

        require(success, "Transfer failed");
    }

}
