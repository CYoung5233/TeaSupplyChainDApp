import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Chip, TextField } from "@mui/material";
import {
  getWeb3,
  getChainId,
  isMetaMaskInstalled,
  requestAccounts,
  switchToSepolia,
} from "../web3/web3";
import { getTeaContract } from "../web3/contract";
import {
  CONTRACT_ADDRESS,
  SEPOLIA_CHAIN_ID,
  SEPOLIA_CHAIN_NAME,
  SEPOLIA_EXPLORER,
} from "../config";

const stateLabels = [
  "Registered",
  "Processed",
  "Exported",
  "Distributed",
  "Retail",
  "Consumed",
];

const formatAddress = (value) => {
  if (!value) return "";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
};

const epochFromDate = (value) => {
  if (!value) return 0;
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? 0 : Math.floor(ts / 1000);
};

const formatEpoch = (value) => {
  const num = Number(value);
  if (!num) return "—";
  const date = new Date(num * 1000);
  return date.toLocaleDateString();
};

const normalizeBatch = (raw) => {
  if (!raw) return null;
  return {
    batchId: raw.batchId ?? raw[0],
    farmerBatchId: raw.farmerBatchId ?? raw[1],
    origin: raw.origin ?? raw[2],
    harvestDate: raw.harvestDate ?? raw[3],
    packagedDate: raw.packagedDate ?? raw[4],
    processingMethod: raw.processingMethod ?? raw[5],
    certifications: raw.certifications ?? raw[6],
    currentOwner: raw.currentOwner ?? raw[7],
    state: raw.state ?? raw[8],
    farmer: raw.farmer ?? raw[9],
    processor: raw.processor ?? raw[10],
    latestExporter: raw.latestExporter ?? raw[11],
    latestDistributor: raw.latestDistributor ?? raw[12],
    latestRetailer: raw.latestRetailer ?? raw[13],
  };
};

export default function Home() {
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState("");
  const [balance, setBalance] = useState("");
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [batchQueryId, setBatchQueryId] = useState("");
  const [batch, setBatch] = useState(null);
  const [roleIds, setRoleIds] = useState({});
  const [accountRoles, setAccountRoles] = useState([]);
  const [registerForm, setRegisterForm] = useState({
    farmerBatchId: "",
    origin: "",
    harvestDate: "",
    certifications: "",
  });
  const [processForm, setProcessForm] = useState({
    batchId: "",
    packagedDate: "",
    processingMethod: "",
  });
  const [simpleBatchId, setSimpleBatchId] = useState("");
  const [transferForm, setTransferForm] = useState({
    batchId: "",
    to: "",
  });
  const [acceptBatchId, setAcceptBatchId] = useState("");
  const [grantForm, setGrantForm] = useState({ role: "FARMER_ROLE", address: "" });

  const connected = !!account;
  const onSepolia = chainId === SEPOLIA_CHAIN_ID;

  const contract = useMemo(() => {
    if (!connected) return null;
    try {
      const web3 = getWeb3();
      return getTeaContract(web3);
    } catch {
      return null;
    }
  }, [connected]);

  const loadBalance = async (address) => {
    if (!address || !isMetaMaskInstalled()) {
      setBalance("");
      return;
    }
    try {
      const web3 = getWeb3();
      const raw = await web3.eth.getBalance(address);
      const eth = Number(web3.utils.fromWei(raw, "ether"));
      setBalance(`${eth.toFixed(4)} ETH`);
    } catch {
      setBalance("");
    }
  };

  useEffect(() => {
    if (!isMetaMaskInstalled()) return;
    const handleAccounts = (accounts) => {
      const next = accounts?.[0] || "";
      setAccount(next);
      loadBalance(next);
    };
    const handleChain = (newChainId) => {
      setChainId(newChainId || "");
      if (account) {
        loadBalance(account);
      }
    };

    window.ethereum.on("accountsChanged", handleAccounts);
    window.ethereum.on("chainChanged", handleChain);

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccounts);
      window.ethereum.removeListener("chainChanged", handleChain);
    };
  }, []);

  const connectWallet = async () => {
    if (!isMetaMaskInstalled()) {
      setNotice({ type: "error", message: "MetaMask is required to use this DApp." });
      return;
    }
    try {
      setBusy(true);
      const accounts = await requestAccounts();
      const currentChainId = await getChainId();
      const next = accounts?.[0] || "";
      setAccount(next);
      setChainId(currentChainId || "");
      await loadBalance(next);
      setNotice(null);
    } catch (err) {
      setNotice({ type: "error", message: err?.message || "Wallet connection failed." });
    } finally {
      setBusy(false);
    }
  };

  const requireReady = () => {
    if (!connected) {
      setNotice({ type: "error", message: "Connect your wallet first." });
      return false;
    }
    if (!onSepolia) {
      setNotice({ type: "warning", message: "Switch to Sepolia before sending transactions." });
      return false;
    }
    if (!contract) {
      setNotice({ type: "error", message: "Contract is not ready." });
      return false;
    }
    return true;
  };

  const handleSwitch = async () => {
    try {
      const switched = await switchToSepolia();
      if (!switched) {
        setNotice({
          type: "warning",
          message:
            "Sepolia is not added to your wallet. Add it manually in MetaMask, then retry.",
        });
      }
    } catch (err) {
      setNotice({ type: "error", message: err?.message || "Network switch failed." });
    }
  };

  const loadRoles = async () => {
    if (!requireReady()) return;
    try {
      setBusy(true);
      const ids = {
        FARMER_ROLE: await contract.methods.FARMER_ROLE().call(),
        PROCESSOR_ROLE: await contract.methods.PROCESSOR_ROLE().call(),
        EXPORTER_ROLE: await contract.methods.EXPORTER_ROLE().call(),
        DISTRIBUTOR_ROLE: await contract.methods.DISTRIBUTOR_ROLE().call(),
        RETAILER_ROLE: await contract.methods.RETAILER_ROLE().call(),
        END_CONSUMER_ROLE: await contract.methods.END_CONSUMER_ROLE().call(),
      };
      setRoleIds(ids);
      setNotice({ type: "success", message: "Role IDs loaded." });
    } catch (err) {
      setNotice({ type: "error", message: err?.message || "Failed to load roles." });
    } finally {
      setBusy(false);
    }
  };

  const checkMyRoles = async () => {
    if (!requireReady()) return;
    try {
      setBusy(true);
      const ids = {
        FARMER_ROLE: await contract.methods.FARMER_ROLE().call(),
        PROCESSOR_ROLE: await contract.methods.PROCESSOR_ROLE().call(),
        EXPORTER_ROLE: await contract.methods.EXPORTER_ROLE().call(),
        DISTRIBUTOR_ROLE: await contract.methods.DISTRIBUTOR_ROLE().call(),
        RETAILER_ROLE: await contract.methods.RETAILER_ROLE().call(),
        END_CONSUMER_ROLE: await contract.methods.END_CONSUMER_ROLE().call(),
      };
      setRoleIds(ids);
      const entries = await Promise.all(
        Object.entries(ids).map(async ([name, id]) => {
          const has = await contract.methods.hasRole(id, account).call();
          return has ? name : null;
        })
      );
      const active = entries.filter(Boolean);
      setAccountRoles(active);
      setNotice({
        type: "success",
        message: active.length
          ? `Roles found: ${active.join(", ")}`
          : "No roles found for this account.",
      });
    } catch (err) {
      setNotice({ type: "error", message: err?.message || "Role check failed." });
    } finally {
      setBusy(false);
    }
  };

  const sendTx = async (method, successMessage) => {
    if (!requireReady()) return;
    try {
      setBusy(true);
      await method.send({ from: account });
      setNotice({ type: "success", message: successMessage });
    } catch (err) {
      setNotice({ type: "error", message: err?.message || "Transaction failed." });
    } finally {
      setBusy(false);
    }
  };

  const queryBatch = async () => {
    if (!contract) {
      setNotice({ type: "error", message: "Connect your wallet to query batches." });
      return;
    }
    try {
      setBusy(true);
      const raw = await contract.methods.getBatch(batchQueryId).call();
      setBatch(normalizeBatch(raw));
      setNotice(null);
    } catch (err) {
      setNotice({ type: "error", message: err?.message || "Batch lookup failed." });
      setBatch(null);
    } finally {
      setBusy(false);
    }
  };

  const grantRole = async () => {
    if (!requireReady()) return;
    const roleId = roleIds[grantForm.role];
    if (!roleId) {
      setNotice({ type: "warning", message: "Load role IDs first." });
      return;
    }
    await sendTx(
      contract.methods.grantRole(roleId, grantForm.address),
      `Granted ${grantForm.role} to ${formatAddress(grantForm.address)}`
    );
  };

  return (
    <div className="container py-4">
      <section className="hero">
        <div className="badge-soft mb-3">Tea Supply Chain DApp</div>
        <h1 className="hero-title">Trace every leaf from farm to cup.</h1>
        <p className="hero-subtitle">
          Verify origin, processing, and custody in one transparent ledger. Built
          on Sepolia with on-chain provenance, role-based updates, and immutable
          event history.
        </p>
      </section>

      <div className="row g-4">
        <div className="col-12 col-lg-4">
          <div className="glass-panel p-4 mb-4">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <div>
                <div className="section-title">Wallet Status</div>
                <div className="h5 mb-1">{connected ? "Connected" : "Disconnected"}</div>
              </div>
              <Chip
                className="status-chip"
                color={onSepolia ? "success" : "warning"}
                label={onSepolia ? SEPOLIA_CHAIN_NAME : "Wrong network"}
              />
            </div>

            <div className="mb-3">
              <div className="text-muted small">Account</div>
              <div className="copy-box">{account || "Not connected"}</div>
            </div>

            <div className="mb-3">
              <div className="text-muted small">Sepolia Balance</div>
              <div className="copy-box">
                {onSepolia && balance ? balance : "—"}
              </div>
            </div>

            <div className="mb-3">
              <div className="text-muted small">Contract</div>
              <div className="copy-box">{CONTRACT_ADDRESS}</div>
              <a
                className="small"
                href={`${SEPOLIA_EXPLORER}/address/${CONTRACT_ADDRESS}`}
                target="_blank"
                rel="noreferrer"
              >
                View on Etherscan
              </a>
            </div>

            <div className="d-flex flex-column gap-2">
              <Button
                variant="contained"
                disabled={busy}
                onClick={connectWallet}
              >
                {connected ? "Reconnect Wallet" : "Connect Wallet"}
              </Button>
              <Button
                variant="outlined"
                disabled={busy || onSepolia}
                onClick={handleSwitch}
              >
                Switch to Sepolia
              </Button>
            </div>
          </div>

          <div className="glass-panel p-4">
            <div className="section-title mb-2">Lookup Batch</div>
            <div className="d-flex gap-2">
              <TextField
                label="Batch ID"
                size="small"
                value={batchQueryId}
                onChange={(event) => setBatchQueryId(event.target.value)}
                fullWidth
              />
              <Button variant="contained" onClick={queryBatch} disabled={busy}>
                Fetch
              </Button>
            </div>

            {batch && (
              <div className="mt-3">
                <div className="section-title">Batch Details</div>
                <div className="mt-2">
                  <div><strong>ID:</strong> {batch.batchId}</div>
                  <div><strong>Farmer Batch:</strong> {batch.farmerBatchId}</div>
                  <div><strong>Origin:</strong> {batch.origin}</div>
                  <div><strong>Harvest Date:</strong> {formatEpoch(batch.harvestDate)}</div>
                  <div><strong>Packaged Date:</strong> {formatEpoch(batch.packagedDate)}</div>
                  <div><strong>Processing:</strong> {batch.processingMethod}</div>
                  <div><strong>Certifications:</strong> {batch.certifications}</div>
                  <div><strong>Owner:</strong> {formatAddress(batch.currentOwner)}</div>
                  <div><strong>State:</strong> {stateLabels[Number(batch.state)] || batch.state}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="col-12 col-lg-8">
          {notice && (
            <Alert severity={notice.type} className="mb-3">
              {notice.message}
            </Alert>
          )}

          <div className="glass-panel p-4 mb-4">
            <div className="section-title mb-3">Role Administration</div>
            <div className="d-flex flex-wrap gap-2 mb-3">
              <Button variant="outlined" onClick={loadRoles} disabled={busy}>
                Load Role IDs
              </Button>
              <Button variant="outlined" onClick={checkMyRoles} disabled={busy}>
                Check My Roles
              </Button>
              {Object.keys(roleIds).length > 0 && (
                <span className="muted">Loaded {Object.keys(roleIds).length} roles</span>
              )}
            </div>

            {accountRoles.length > 0 && (
              <div className="d-flex flex-wrap gap-2 mb-3">
                {accountRoles.map((role) => (
                  <Chip key={role} label={role} color="success" />
                ))}
              </div>
            )}

            <div className="row g-3 align-items-end">
              <div className="col-12 col-md-5">
                <label className="form-label">Role</label>
                <select
                  className="form-select"
                  value={grantForm.role}
                  onChange={(event) =>
                    setGrantForm((prev) => ({ ...prev, role: event.target.value }))
                  }
                >
                  {[
                    "FARMER_ROLE",
                    "PROCESSOR_ROLE",
                    "EXPORTER_ROLE",
                    "DISTRIBUTOR_ROLE",
                    "RETAILER_ROLE",
                    "END_CONSUMER_ROLE",
                  ].map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-12 col-md-5">
                <TextField
                  label="Wallet Address"
                  size="small"
                  value={grantForm.address}
                  onChange={(event) =>
                    setGrantForm((prev) => ({ ...prev, address: event.target.value }))
                  }
                  fullWidth
                />
              </div>
              <div className="col-12 col-md-2 d-grid">
                <Button variant="contained" onClick={grantRole} disabled={busy}>
                  Grant
                </Button>
              </div>
            </div>
          </div>

          <div className="glass-panel p-4">
            <div className="section-title mb-3">Batch Actions</div>
            <div className="action-grid">
              <div className="card border-0 shadow-sm">
                <div className="card-body">
                  <div className="card-title mb-2">Register Batch</div>
                  <div className="mb-2">
                    <TextField
                      label="Farmer Batch ID"
                      size="small"
                      value={registerForm.farmerBatchId}
                      onChange={(event) =>
                        setRegisterForm((prev) => ({
                          ...prev,
                          farmerBatchId: event.target.value,
                        }))
                      }
                      fullWidth
                    />
                  </div>
                  <div className="mb-2">
                    <TextField
                      label="Origin"
                      size="small"
                      value={registerForm.origin}
                      onChange={(event) =>
                        setRegisterForm((prev) => ({ ...prev, origin: event.target.value }))
                      }
                      fullWidth
                    />
                  </div>
                  <div className="mb-2">
                    <TextField
                      label="Harvest Date"
                      type="date"
                      size="small"
                      value={registerForm.harvestDate}
                      onChange={(event) =>
                        setRegisterForm((prev) => ({
                          ...prev,
                          harvestDate: event.target.value,
                        }))
                      }
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                    />
                  </div>
                  <div className="mb-2">
                    <TextField
                      label="Certifications"
                      size="small"
                      value={registerForm.certifications}
                      onChange={(event) =>
                        setRegisterForm((prev) => ({
                          ...prev,
                          certifications: event.target.value,
                        }))
                      }
                      fullWidth
                    />
                  </div>
                  <Button
                    variant="contained"
                    disabled={busy}
                    onClick={() =>
                      contract &&
                      sendTx(
                        contract.methods.registerBatch(
                          registerForm.farmerBatchId,
                          registerForm.origin,
                          epochFromDate(registerForm.harvestDate),
                          registerForm.certifications
                        ),
                        "Batch registered"
                      )
                    }
                  >
                    Register
                  </Button>
                </div>
              </div>

              <div className="card border-0 shadow-sm">
                <div className="card-body">
                  <div className="card-title mb-2">Process Batch</div>
                  <div className="mb-2">
                    <TextField
                      label="Batch ID"
                      size="small"
                      value={processForm.batchId}
                      onChange={(event) =>
                        setProcessForm((prev) => ({ ...prev, batchId: event.target.value }))
                      }
                      fullWidth
                    />
                  </div>
                  <div className="mb-2">
                    <TextField
                      label="Packaged Date"
                      type="date"
                      size="small"
                      value={processForm.packagedDate}
                      onChange={(event) =>
                        setProcessForm((prev) => ({
                          ...prev,
                          packagedDate: event.target.value,
                        }))
                      }
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                    />
                  </div>
                  <div className="mb-2">
                    <TextField
                      label="Processing Method"
                      size="small"
                      value={processForm.processingMethod}
                      onChange={(event) =>
                        setProcessForm((prev) => ({
                          ...prev,
                          processingMethod: event.target.value,
                        }))
                      }
                      fullWidth
                    />
                  </div>
                  <Button
                    variant="contained"
                    disabled={busy}
                    onClick={() =>
                      contract &&
                      sendTx(
                        contract.methods.processBatch(
                          processForm.batchId,
                          epochFromDate(processForm.packagedDate),
                          processForm.processingMethod
                        ),
                        "Batch processed"
                      )
                    }
                  >
                    Process
                  </Button>
                </div>
              </div>

              <div className="card border-0 shadow-sm">
                <div className="card-body">
                  <div className="card-title mb-2">Export Batch</div>
                  <div className="mb-2">
                    <TextField
                      label="Batch ID"
                      size="small"
                      value={simpleBatchId}
                      onChange={(event) => setSimpleBatchId(event.target.value)}
                      fullWidth
                    />
                  </div>
                  <Button
                    variant="contained"
                    disabled={busy}
                    onClick={() =>
                      contract &&
                      sendTx(contract.methods.exportBatch(simpleBatchId), "Batch exported")
                    }
                  >
                    Export
                  </Button>
                </div>
              </div>

              <div className="card border-0 shadow-sm">
                <div className="card-body">
                  <div className="card-title mb-2">Distribute Batch</div>
                  <div className="mb-2">
                    <TextField
                      label="Batch ID"
                      size="small"
                      value={simpleBatchId}
                      onChange={(event) => setSimpleBatchId(event.target.value)}
                      fullWidth
                    />
                  </div>
                  <Button
                    variant="contained"
                    disabled={busy}
                    onClick={() =>
                      contract &&
                      sendTx(
                        contract.methods.distributeBatch(simpleBatchId),
                        "Batch distributed"
                      )
                    }
                  >
                    Distribute
                  </Button>
                </div>
              </div>

              <div className="card border-0 shadow-sm">
                <div className="card-body">
                  <div className="card-title mb-2">Mark Retail</div>
                  <div className="mb-2">
                    <TextField
                      label="Batch ID"
                      size="small"
                      value={simpleBatchId}
                      onChange={(event) => setSimpleBatchId(event.target.value)}
                      fullWidth
                    />
                  </div>
                  <Button
                    variant="contained"
                    disabled={busy}
                    onClick={() =>
                      contract &&
                      sendTx(contract.methods.markRetail(simpleBatchId), "Batch retail set")
                    }
                  >
                    Retail
                  </Button>
                </div>
              </div>

              <div className="card border-0 shadow-sm">
                <div className="card-body">
                  <div className="card-title mb-2">Consume Batch</div>
                  <div className="mb-2">
                    <TextField
                      label="Batch ID"
                      size="small"
                      value={simpleBatchId}
                      onChange={(event) => setSimpleBatchId(event.target.value)}
                      fullWidth
                    />
                  </div>
                  <Button
                    variant="contained"
                    disabled={busy}
                    onClick={() =>
                      contract &&
                      sendTx(contract.methods.consumeBatch(simpleBatchId), "Batch consumed")
                    }
                  >
                    Consume
                  </Button>
                </div>
              </div>

              <div className="card border-0 shadow-sm">
                <div className="card-body">
                  <div className="card-title mb-2">Propose Transfer</div>
                  <div className="mb-2">
                    <TextField
                      label="Batch ID"
                      size="small"
                      value={transferForm.batchId}
                      onChange={(event) =>
                        setTransferForm((prev) => ({
                          ...prev,
                          batchId: event.target.value,
                        }))
                      }
                      fullWidth
                    />
                  </div>
                  <div className="mb-2">
                    <TextField
                      label="Recipient Address"
                      size="small"
                      value={transferForm.to}
                      onChange={(event) =>
                        setTransferForm((prev) => ({ ...prev, to: event.target.value }))
                      }
                      fullWidth
                    />
                  </div>
                  <Button
                    variant="contained"
                    disabled={busy}
                    onClick={() =>
                      contract &&
                      sendTx(
                        contract.methods.proposeTransfer(transferForm.batchId, transferForm.to),
                        "Transfer proposed"
                      )
                    }
                  >
                    Propose
                  </Button>
                </div>
              </div>

              <div className="card border-0 shadow-sm">
                <div className="card-body">
                  <div className="card-title mb-2">Accept Transfer</div>
                  <div className="mb-2">
                    <TextField
                      label="Batch ID"
                      size="small"
                      value={acceptBatchId}
                      onChange={(event) => setAcceptBatchId(event.target.value)}
                      fullWidth
                    />
                  </div>
                  <Button
                    variant="contained"
                    disabled={busy}
                    onClick={() =>
                      contract &&
                      sendTx(
                        contract.methods.acceptTransfer(acceptBatchId),
                        "Transfer accepted"
                      )
                    }
                  >
                    Accept
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer>
        <div className="container">
          <div className="section-title mb-2">Notes</div>
          <div className="muted">
            Transactions require the connected account to hold the appropriate role.
            Ownership must be transferred between roles using the transfer workflow.
          </div>
        </div>
      </footer>
    </div>
  );
}
