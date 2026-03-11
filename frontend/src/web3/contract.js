import TeaABI from "../abi/Tea.json";
import { CONTRACT_ADDRESS } from "../config";
import { getWeb3 } from "./web3";

export const getTeaContract = (web3Instance) => {
  const web3 = web3Instance || getWeb3();
  return new web3.eth.Contract(TeaABI.abi, CONTRACT_ADDRESS);
};
