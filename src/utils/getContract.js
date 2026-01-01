import { ethers } from "ethers";
export const getContract = (address, abi, signerOrProvider) => new ethers.Contract(address, abi, signerOrProvider);
