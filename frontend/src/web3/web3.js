import Web3 from "web3";
import { SEPOLIA_CHAIN_ID } from "../config";

export const isMetaMaskInstalled = () => typeof window !== "undefined" && !!window.ethereum;

export const getWeb3 = () => {
  if (!isMetaMaskInstalled()) {
    throw new Error("MetaMask is not available in this browser.");
  }
  return new Web3(window.ethereum);
};

export const requestAccounts = async () => {
  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  return accounts || [];
};

export const requestAccountSelection = async () => {
  return window.ethereum.request({
    method: "wallet_requestPermissions",
    params: [{ eth_accounts: {} }],
  });
};

export const revokeAccountPermissions = async () => {
  return window.ethereum.request({
    method: "wallet_revokePermissions",
    params: [{ eth_accounts: {} }],
  });
};

export const getChainId = async () => {
  const chainId = await window.ethereum.request({ method: "eth_chainId" });
  return chainId;
};

export const switchToSepolia = async () => {
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: SEPOLIA_CHAIN_ID }],
    });
    return true;
  } catch (err) {
    if (err?.code === 4902) {
      return false;
    }
    throw err;
  }
};
