import { ethers } from "ethers";

let accountWallets = [];
let mnemonicStr = ethers.Wallet.createRandom().mnemonic.phrase;
console.log(`\n`);
console.log("****************************************** Mnemonic String *********************************************\n");
console.log(mnemonicStr);
console.log(`\n`);
console.log("****************************************** 10 Accounts from Mnemonic ****************************************\n");
for (let count = 0; count < 10; count++) {
    accountWallets.push(ethers.Wallet.fromMnemonic(mnemonicStr, `m/44'/60'/0'/0/${count}`, ethers.wordlists.en));
    console.log(`Account ${count+1} Public Key: ${accountWallets[count].address}`);
    console.log(`Account ${count+1} Private Key: ${accountWallets[count].privateKey}`);
    console.log(`\n`);
}