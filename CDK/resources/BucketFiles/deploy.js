const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const contractFolder = './contracts/';
  let deployedContractAddresses=[];
  let contractFileNames=fs.readdirSync(contractFolder);
  for(let count=0;count<contractFileNames.length;count++){
    let contractName=contractFileNames[count].substring(0,contractFileNames[count].indexOf("."));
    let deployingContractFactory= await hre.ethers.getContractFactory(contractName);
    let contractToDeploy = await deployingContractFactory.deploy();
    let deployedContract=await contractToDeploy.deployed();
    let addressObj={"contractName":contractName, "contractAddress":deployedContract.address};
    
    deployedContractAddresses.push(addressObj);
  }
  console.log(deployedContractAddresses[0].contractAddress);
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
