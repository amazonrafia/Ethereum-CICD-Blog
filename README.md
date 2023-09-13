# Implement a CI/CD pipeline for Ethereum smart contract development on AWS 
This repository contains CDK project to implement a CI/CD pipleline for smart contract development as discussed in the following blogs

[Implement a CI/CD pipeline for Ethereum smart contract development on AWS – Part 1](https://aws.amazon.com/blogs/database/implement-a-ci-cd-pipeline-for-ethereum-smart-contract-development-on-aws-part-1/)
[Implement a CI/CD pipeline for Ethereum smart contract development on AWS – Part 2](https://aws.amazon.com/blogs/database/implement-a-ci-cd-pipeline-for-ethereum-smart-contract-development-on-aws-part-2/)


## Prerequisites

1. [Node.js](https://nodejs.org)
2. An active AWS account
3. AWS CLI (https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-getting-started.html)

## CDK Setup

Change the ACCOUNT-NUMBER and REGION in the below command for your own AWS account and region

```console
npm uninstall -g cdk
npm install -g aws-cdk
cdk bootstrap aws://ACCOUNT-NUMBER/REGION 
```
## Generate a random mnemonic and update Besu Genesis file and cdk-stack.ts file (optional step)
The repository is already configured with a default mnemonic to be used with Hyperledger Besu network. 

**Do not use these mnemonic with with any Testnet or Mainnet**

If you wish to change this default mnemonic with a new randomly generated mnemonic then follow these steps. 

1. Go to Mnemonic-Generator folder 
```console
cd Mnemonic-Generator
```
2. Install dependencies of this utility
```console
npm install
```
3. Generate a new mnemonic phrase and 10 accounts with public private keys
```console
node index.mjs
```
4. Enter this mnemonic in the cdk-stack.ts file so it is the mnemonic associated with accounts in the Besu network. The cdk-stack.ts file is located in the CDK/lib folder.
```console
cd ../CDK/lib
```
open the file and look for secrets manager construct shown below:

```console
let secMgrSecrets=new secretsmanager.Secret(this, "AMB-CICD-Blog-Secrets", {
      secretName: "AMB-CICD-Blog-Secrets",
      description: "Captures all the secrets required by CodeBuild and ShareToWinLambda",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      secretObjectValue:{
        "/CodeBuild/BesuMnemonicString":cdk.SecretValue.unsafePlainText("Enter the new mnemonic here"),
        "/CodeBuild/GeorliMnemonicString":cdk.SecretValue.unsafePlainText("To be entered"),
        "/CodeBuild/MainnetMnemonicString":cdk.SecretValue.unsafePlainText("To be entered"),
        "/CodeBuild/AccessKey":cdk.SecretValue.unsafePlainText("To be entered"),
        "/CodeBuild/SecretKey":cdk.SecretValue.unsafePlainText("To be entered"),
        "/CodeBuild/BillingTokenUrl":cdk.SecretValue.unsafePlainText("To be entered"),
      }
    });
```

5. Change the test accounts that get created when Besu node starts by entering the public keys of the accounts generated in step 3

6. Go to `dev.json` file under `CDK\resources\BucketFiles\dev.json` and change all the public key with the public keys generated in step 3. E.g in the below code snippet "bc477F8Aa5BDdF2cAB1216Dd3B341718DeC3af6F" is the public key of the first account, "1e6EF65FE43715a509b1947630e33910247660D2" is the key of the second account and so on. 

:::
"alloc": {
      "bc477F8Aa5BDdF2cAB1216Dd3B341718DeC3af6F": {
        "balance": "0xad78ebc5ac6200000"
      },
      "1e6EF65FE43715a509b1947630e33910247660D2": {
        "balance": "0xad78ebc5ac6200000"
      },
      .
      .
      .
    }
:::

## Deploy CDK

1. Clone this repository to get the cdk stack locally on your computer

```console
git clone https://github.com/amazonrafia/Ethereum-CICD-Blog.git
```
2. Go to CDK folder
```console
cd Ethereum-CICD-Blog/CDK
```
3. Install project dependencies
```console
npm install
```
4. Deploy CDK stack
```console
cdk deploy
```
5. Type yes when asked "Do you wish to deploy these changes"

6. Update Secret Manager
When CDK stack is deployed, it will create the entire CI/CD infrastructure and start the CI/CD pipeline. The pipleline will compile and deploy the smart contract on Hyperledger Besu and will enter into a stage where it will wait for manual approval to move to Goerli deployment stage. Before manually approving, make sure AMB Billing token url and mnemonics related to accounts in Goerli network are entered into the secret manager. 
