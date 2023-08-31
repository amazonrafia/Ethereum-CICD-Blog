import * as chai from 'chai';
import * as faker from '@faker-js/faker';
import * as ethers from 'ethers';
import fs from 'fs';

describe('Smart Contract Test',()=>{
    let chainProvider=ethers.getDefaultProvider(process.env.NETWORK_ENDPOINT);
    let contractAdd=process.env.CONTRACT_ADDRESS;
    let assetTokenContract = new ethers.Contract(contractAdd, JSON.parse(fs.readFileSync(`test/${process.env.CONTRACTFILENAME}`)).abi, chainProvider);
    
    let accountWallets = [];
    let escrowAmount=1;
    let assetOwnerAccount = 1 //faker.datatype.number({min: 1,max: 5}); 
    
    before(async () => {
        let mnemonic = process.env.MNEMONIC_STRING;
        for (let count = 0; count < 10; count++) {
            accountWallets.push(ethers.Wallet.fromMnemonic(mnemonic, `m/44'/60'/0'/0/${count}`, ethers.wordlists.en).connect(chainProvider));
        } 
    });

    describe('Escrow Balance Testing',()=>{
        it('Get Initial Escrow Balance',async()=>{
            let accountInitialBalance=-1;
            let accountid=accountWallets[assetOwnerAccount];
            let returnObj = await assetTokenContract.getAccountEscrowMoney(accountid.address);
            accountInitialBalance=parseFloat(returnObj);
            chai.expect(accountInitialBalance).to.greaterThanOrEqual(0);
        });
        it('Send Escrow Money',async()=>{
            chai.expect(async(done)=>{
                let walletSigner=accountWallets[assetOwnerAccount];
                let ChainID=(await chainProvider.getNetwork()).chainId;
                let tx = { to:  contractAdd, from:walletSigner.address,value: ethers.utils.parseUnits(escrowAmount.toString(),"ether"),chainId: ChainID, gasLimit: 5000000 };
                let txResult = await walletSigner.sendTransaction(tx);
                let txReceipt=await txResult.wait();
                done();
            }).to.not.Throw
        });
    });     
});