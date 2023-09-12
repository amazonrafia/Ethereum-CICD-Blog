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
## Deploy CDK

1. Clone this repository to get the cdk stack locally on your computer

```console
git clone https://github.com/amazonrafia/Ethereum-CICD-Blog.git
```
2. Go to CDK folder
```console
cd Ethereum-CICD-Blog/CDK
```
3. Deploy CDK stack
```console
cdk deploy
```
4. Update Secret Manager
When CDK stack is deployed, it will create the entire CI/CD infrastructure and start the CI/CD pipeline. The pipleline will compile and deploy the smart contract on Hyperledger Besu and will enter into a stage where it will wait for manual approval to move to Goerli deployment stage. Before manually approving, make sure AMB Billing token url and mnemonics related to accounts in Goerli network are entered into the secret manager. 
