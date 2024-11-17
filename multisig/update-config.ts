/**
 * In this example, we will first create a multisig with two signers, then we
 * will update the config to add a third signer.
 */

import "dotenv/config";
import {
  createKernelAccount,
  createZeroDevPaymasterClient,
  createKernelAccountClient,
} from "@zerodev/sdk";
import { http, createPublicClient, zeroAddress } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import {
  createWeightedECDSAValidator,
  getUpdateConfigCall,
  getCurrentSigners,
  getValidatorAddress,
} from "@zerodev/weighted-ecdsa-validator";
import { WeightedValidatorAbi } from "./abi";
import { entryPoint } from "./main";
import { KERNEL_V3_1 } from "@zerodev/sdk/constants";

if (
  !process.env.BUNDLER_RPC ||
  !process.env.PAYMASTER_RPC ||
  !process.env.PRIVATE_KEY
) {
  throw new Error("BUNDLER_RPC or PAYMASTER_RPC or PRIVATE_KEY is not set");
}

const publicClient = createPublicClient({
  transport: http(process.env.BUNDLER_RPC),
  chain: sepolia,
});

const signer1 = privateKeyToAccount(generatePrivateKey());
const signer2 = privateKeyToAccount(generatePrivateKey());
const signer3 = privateKeyToAccount(generatePrivateKey());
console.log("signer1:", signer1.address);
console.log("signer2:", signer2.address);
console.log("signer3:", signer3.address);

const main = async () => {
  const multisigValidator = await createWeightedECDSAValidator(publicClient, {
    entryPoint,
    config: {
      threshold: 100,
      signers: [
        { address: signer1.address, weight: 50 },
        { address: signer2.address, weight: 50 },
      ],
    },
    signers: [signer1, signer2],
    kernelVersion: KERNEL_V3_1,
  });

  const account = await createKernelAccount(publicClient, {
    entryPoint,
    plugins: {
      sudo: multisigValidator,
    },
    kernelVersion: KERNEL_V3_1,
  });

  const kernelPaymaster = createZeroDevPaymasterClient({
    chain: sepolia,
    transport: http(process.env.PAYMASTER_RPC),
  });

  const kernelClient = createKernelAccountClient({
    account,
    chain: sepolia,
    bundlerTransport: http(process.env.BUNDLER_RPC),
    paymaster: {
      getPaymasterData(userOperation) {
        return kernelPaymaster.sponsorUserOperation({ userOperation });
      },
    },
  });

  console.log("My account:", kernelClient.account.address);

  console.log("sending userOp with signer 1 and 2...");
  const op1Hash = await kernelClient.sendUserOperation({
    callData: "0x",
  });

  await kernelClient.waitForUserOperationReceipt({
    hash: op1Hash,
  });

  console.log("userOp sent");

  const currentSigners = await getCurrentSigners(publicClient, {
    entryPoint,
    multiSigAccountAddress: account.address,
    kernelVersion: KERNEL_V3_1,
  });

  console.log("current signers:", currentSigners);

  console.log("sending second userOp with signer 1 and 2...");
  await kernelClient.sendTransaction({
    to: zeroAddress,
    value: BigInt(0),
    data: "0x",
  });
  console.log("second userOp sent");

  const storageBefore = await publicClient.readContract({
    address: getValidatorAddress(entryPoint, KERNEL_V3_1),
    abi: WeightedValidatorAbi,
    functionName: "weightedStorage",
    args: [account.address],
  });

  console.log("weigthed storage:", storageBefore);

  console.log("updating config to add signer 3...");
  await kernelClient.sendTransaction(
    getUpdateConfigCall(entryPoint, KERNEL_V3_1, {
      threshold: 100,
      signers: [
        { address: signer1.address, weight: 50 },
        { address: signer2.address, weight: 50 },
        { address: signer3.address, weight: 50 },
      ],
    })
  );

  console.log("userOp sent");

  const storageAfter = await publicClient.readContract({
    address: getValidatorAddress(entryPoint, KERNEL_V3_1),
    abi: WeightedValidatorAbi,
    functionName: "weightedStorage",
    args: [account.address],
  });

  console.log("new weigthed storage:", storageAfter);

  const multisigValidator2 = await createWeightedECDSAValidator(publicClient, {
    entryPoint,
    signers: [signer1, signer2, signer3],
    kernelVersion: KERNEL_V3_1,
  });

  const account2 = await createKernelAccount(publicClient, {
    entryPoint,
    address: account.address,
    plugins: {
      sudo: multisigValidator2,
    },
    kernelVersion: KERNEL_V3_1,
  });

  const kernelClient2 = createKernelAccountClient({
    account: account2,
    chain: sepolia,
    bundlerTransport: http(process.env.BUNDLER_RPC),
    paymaster: {
      getPaymasterData(userOperation) {
        return kernelPaymaster.sponsorUserOperation({ userOperation });
      },
    },
  });

  console.log("sending userOp with signer 1, 2 and 3...");
  await kernelClient2.sendTransaction({
    to: zeroAddress,
    value: BigInt(0),
    data: "0x",
  });
  console.log("userOp sent");

  console.log("sending userOp with signer 1 and 2 again...");
  await kernelClient.sendTransaction({
    to: zeroAddress,
    value: BigInt(0),
    data: "0x",
  });
  console.log("userOp sent");

  const multisigValidator3 = await createWeightedECDSAValidator(publicClient, {
    entryPoint,
    signers: [signer2, signer3],
    kernelVersion: KERNEL_V3_1,
  });

  const account3 = await createKernelAccount(publicClient, {
    entryPoint,
    address: account.address,
    plugins: {
      sudo: multisigValidator3,
    },
    kernelVersion: KERNEL_V3_1,
  });

  const kernelClient3 = createKernelAccountClient({
    account: account3,
    chain: sepolia,
    bundlerTransport: http(process.env.BUNDLER_RPC),
    paymaster: {
      getPaymasterData(userOperation) {
        return kernelPaymaster.sponsorUserOperation({ userOperation });
      },
    },
  });

  console.log("sending userOp with signer 2 and 3 again...");
  await kernelClient3.sendTransaction({
    to: zeroAddress,
    value: BigInt(0),
    data: "0x",
  });
  console.log("userOp sent");

  const multisigValidator4 = await createWeightedECDSAValidator(publicClient, {
    entryPoint,
    signers: [signer1, signer3],
    kernelVersion: KERNEL_V3_1,
  });

  const account4 = await createKernelAccount(publicClient, {
    entryPoint,
    address: account.address,
    plugins: {
      sudo: multisigValidator4,
    },
    kernelVersion: KERNEL_V3_1,
  });

  const kernelClient4 = createKernelAccountClient({
    account: account4,
    chain: sepolia,
    bundlerTransport: http(process.env.BUNDLER_RPC),
    paymaster: {
      getPaymasterData(userOperation) {
        return kernelPaymaster.sponsorUserOperation({ userOperation });
      },
    },
  });

  console.log("sending userOp with signer 1 and 3...");

  await kernelClient4.sendTransaction({
    to: zeroAddress,
    value: BigInt(0),
    data: "0x",
  });

  console.log("userOp sent");
};

main();
