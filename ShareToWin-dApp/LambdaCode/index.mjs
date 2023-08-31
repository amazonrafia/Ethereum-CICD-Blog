import fs from 'fs'
import { ethers } from "ethers";
import { DynamoDBClient, PutItemCommand, GetItemCommand, ScanCommand, ExecuteStatementCommand } from "@aws-sdk/client-dynamodb";


/*global fetch*/

let dbTable = process.env.DYNAMODB_NAME;
let abiFileName="AssetToken.json";
let accountWallets=[];
let chainProvider=ethers.getDefaultProvider(process.env.NETWORK_ENDPOINT);
let ChainID;
let assetTokenContract=new ethers.Contract(process.env.CONTRACTADDRESS,JSON.parse(fs.readFileSync(`./${abiFileName}`)).abi,chainProvider);
let registeredUsers=[];
let mnemonicSecret="";

(async () => {
    ChainID=(await chainProvider.getNetwork()).chainId;

})();

//lambda Singleton object
let lambdaSingleton=async()=>{
    if(mnemonicSecret==""){
        try{
            let secretValue=await fetch(`http://localhost:2773/secretsmanager/get?secretId=${encodeURIComponent(process.env.SECRET_MGR_STR)}`,{headers: {'X-Aws-Parameters-Secrets-Token': process.env.AWS_SESSION_TOKEN,'Content-Type': 'application/json'}});
            let jsonTxt=await secretValue.json();
            mnemonicSecret=JSON.parse(jsonTxt.SecretString)["/CodeBuild/BesuMnemonicString"];
            for (let count = 0; count < 10; count++) {
                accountWallets.push(ethers.Wallet.fromMnemonic(mnemonicSecret,`m/44'/60'/0'/0/${count}`,ethers.wordlists.en).connect(chainProvider));
            }
            registeredUsers.push({
                'Name': "MarketPlace Admin",
                'LoginName': "Admin",
                'EthereumID': accountWallets[0].address, //the first account will be used by marketplace admin
                'EtherBalance': 0,
                'EscrowBalance': 0
            });
        }
        catch(e){
            console.log('error occurred in get setret from secret manager');
            throw e;
        }
    }
}

//db methods
let getAllItems = async ()=> {
    const client = new DynamoDBClient({ region: "us-east-1" });
    var inputData = {
        TableName: dbTable
    };
    const command = new ScanCommand(inputData);
    try {
        let response = await client.send(command);
        return { 'status': 'Success', 'Msg': '', 'Items': response.Items };
    }
    catch (e) {
        return { 'status': 'Error', 'Msg': JSON.stringify(e), 'Items': [] };
    }
};
let createItemInDb= async (assetId, assetTitle, assetDesc, assetPicUrl, nftID)=> {
    const client = new DynamoDBClient({ region: "us-east-1" });
    var inputData = {
        TableName: dbTable,
        Item: {
                "AssetID": { N: assetId.toString() },
                "AssetTitle": { S: assetTitle },
                "AssetDescription": { S: assetDesc },
                "AssetPicUrl": { S: assetPicUrl },
                "AssetNFTId": { N: nftID }
            }
    };
    
    const command = new PutItemCommand(inputData);
    try {
        let response = await client.send(command);
        return { 'status': 'Success', 'Msg': '', 'data': assetId };
    }
    catch (err) {
        return { 'status': 'Error', 'Msg': err, 'data': "" | err.Message };
    }
};
let getItemsFromDb= async (assetIDs)=> {
    const client = new DynamoDBClient({ region: "us-east-1" });
    let dbItems = [];
    const params = {
        Statement: `SELECT * FROM ${dbTable} WHERE AssetID IN [${assetIDs.toString()}]`
    };
    try {
        let returndata = (await client.send(new ExecuteStatementCommand(params))).Items;
        for (let index = 0; index < returndata.length; index++) {
            dbItems.push({
                "AssetDescription": returndata[index].AssetDescription.S,
                "AssetTitle": returndata[index].AssetTitle.S,
                "AssetPicUrl": returndata[index].AssetPicUrl.S,
                "AssetID": returndata[index].AssetID.N,
                "AssetNFTId": returndata[index].AssetNFTId.N
            });
        }
        return { 'status': 'Success', 'Msg': '', 'Items': dbItems };
    } catch (err) {
        return { 'status': 'Error', 'Msg': JSON.stringify(err), 'Items': [] };
    }
};

//non-routed methods
let getAssetDetail = async (assetid)=> {
    try {
        let assetInfo=await assetTokenContract.getAssetByID(assetid);
        return { salePrice: assetInfo[0].toString(), IsAvailable: assetInfo[1], AssetOwnerAddress: assetInfo[3] };
    }
    catch (err) {
        throw err;
    }
};
let updateRegisteredUserBalance = async ()=>{
        console.log(registeredUsers);
        try{ 
            console.log("************** 2 ********************");
            for(let index=0;index<registeredUsers.length;index++){
                let etherbal= await chainProvider.getBalance(registeredUsers[index].EthereumID);
                let escrowbal=await assetTokenContract.getAccountEscrowMoney(registeredUsers[index].EthereumID);
                registeredUsers[index].EtherBalance=ethers.utils.formatEther(etherbal);
                registeredUsers[index].EscrowBalance=ethers.utils.formatEther(escrowbal);
            }
            console.log("************** 3 ********************");
        }
        catch(e){
            throw e;
        }
};

//get methods to retreive data from the ledger 
let getAllUserInfo= async ()=>{
    try{
        await updateRegisteredUserBalance()
        return registeredUsers;
    }
    catch(e){
        throw e;
    }
};
let addUserToMarketPlace=async ()=>{
        if (registeredUsers.length < accountWallets.length) {
            registeredUsers.push({
                'Name': `Buyer${registeredUsers.length}`,
                'LoginName': `buyer${registeredUsers.length}`,
                'EthereumID': accountWallets[registeredUsers.length].address,
                'EtherBalance': 0,
                'EscrowBalance': 0
            });
            await updateRegisteredUserBalance();
            return {
             "status": 200,
             "responseContent": 'New Buyer is added to marketplace'
            };
        }
        else {
            return {
              "status": 500,
              "responseContent": 'User Limit Reached'
            };
        }
};
let getAllRegisteredAsset = async ()=> {
        let result = await getAllItems();
        let registerAsset = [];
        if (result.status == 'Success') {
            if (result.Items.length > 0) {
                try {
                    for (let index = 0; index < result.Items.length; index++) {
                        registerAsset.push({
                            "AssetDescription": result.Items[index].AssetDescription.S,
                            "AssetTitle": result.Items[index].AssetTitle.S,
                            "AssetPicUrl": result.Items[index].AssetPicUrl.S,
                            "AssetNFTId": result.Items[index].AssetNFTId.N,
                            "AssetID": result.Items[index].AssetID.N,
                        });
                        try {
                            let assetInfo = await getAssetDetail(registerAsset[index].AssetID)
                            registerAsset[index].AssetPrice = assetInfo.salePrice;
                            registerAsset[index].IsAssetOnSale = assetInfo.IsAvailable;
                            registerAsset[index].AssetOwnerAccount = assetInfo.AssetOwnerAddress;
                        }
                        catch (err) {
                            throw err;
                        }
                    }
                    return registerAsset;
                }
                catch (err) {
                    return JSON.stringify({ 'Error': err });
                }
            }
            else {
                return [];
            }
        }
        else {
            return {
              "status": 500,
              "responseContent": result.Msg
            };
        }
    };
let listAssetForSale = async () => {
    try {
        let returnObj = await assetTokenContract.getAllAssetOnSale();
        let tempArr = Array.from(returnObj[0]);
        if (tempArr.length > 0) {
            try {
                let dbResult = await getItemsFromDb(tempArr);
                if (dbResult.status == 'Success') {
                    for (let index = 0; index < tempArr.length; index++) {
                        for (let dbIndex = 0; dbIndex < dbResult.Items.length; dbIndex++) {
                            if (dbResult.Items[dbIndex].AssetID == tempArr[index]) {
                                dbResult.Items[dbIndex]['price'] = returnObj[1][index];
                                dbResult.Items[dbIndex]['owner'] = returnObj[2][index];
                                break;
                            }
                        }
                    }
                    return dbResult.Items;
                }
                else {
                    return JSON.stringify({ 'Error': dbResult.Msg });
                }
            }
            catch (innerErr) {
                throw innerErr;
            }
        }
        else {
            return [];
        }
    }
    catch (err) {
        return { 'status': 'Error', 'ErrorMsg': err };
    }
}
let getAccountEscrowBalance = async(accountid) => {
    try {
        let returnObj = await assetTokenContract.getAccountEscrowMoney(accountid);
        let x = parseFloat(returnObj);
        return JSON.stringify(x);
    }
    catch (err) {
        return { 'status': 'Error', 'ErrorMsg': err };
    }
};
let getAccountEtherBalance = async(accountid) => {
    try {
        let bal= await chainProvider.getBalance(accountid);
        return ethers.utils.formatUnits(bal ,'ether');
    }
    catch (err) {
        return { 'status': 'Error', 'ErrorMsg': err };
    }
};
let showAccountAssets = async(accountid) =>{
    try {
        let returnObj = await assetTokenContract.getAssetsOwnedByAccount(accountid);
        let tempArr = Array.from(returnObj);
        if (tempArr.length > 0) {
            try {
                let dbResult = await getItemsFromDb(tempArr);
                if (dbResult.status == 'Success') {
                    return dbResult.Items;
                }
                else {
                    return JSON.stringify({ 'Error': dbResult.Msg });
                }
            }
            catch (innerErr) {
                throw innerErr;
            }

        }
        else {
            return [];
        }

    }
    catch (err) {
        return { 'status': 'Error', 'ErrorMsg': err };
    }
};
// Post methods that changes the ledger
let registerNewAsset =  async (salePrice, ownerAddress, assetTitle, assetDesc, assetUrl)=> {
    var assetId = Math.floor((Math.random() * 10000));
    var metadataUri = "http://value-to-come.com";
    try {
        //get the wallet associated with ownerAddress
        let signerContract;
        for(let count=0;count<accountWallets.length;count++){
            if(accountWallets[count].address===ownerAddress){
                signerContract=assetTokenContract.connect(accountWallets[count]);
                break;
            }
        }
        let returnObj = await signerContract.registerAsset(assetId, salePrice, metadataUri,{gasPrice: '20000000000', gasLimit: 5000000});
        let txtReceipt=await returnObj.wait();
        
        let TokenID;
        txtReceipt.events.map(item=>{
            if(item.event==="AssetRegistered"){
                TokenID=ethers.utils.defaultAbiCoder.decode(["uint256"],item.data)[0].toString();
            }  
        });
        let tranSummary={'TransactionHash': txtReceipt.transactionHash, 'BlockHash': txtReceipt.blockHash, 'TokenID':TokenID};
        //create record in the db
        let result = await createItemInDb(assetId, assetTitle, assetDesc, assetUrl, TokenID);
        if (result.status == 'Success') {
            return { 'status': 'Asset Registered', 'TranSummary': tranSummary };
        }
        else {
            return { 'status': 'Error', 'ErrorMsg': result.Msg };
        }
    }
    catch (err) {
        return { 'status': 'Error', 'ErrorMsg': err };
    }
};    
let sendEscrowBalance = async(actAddress, escrowAmount)=> {
    let walletSigner;
    for (let count = 0; count < accountWallets.length; count++) {
        if (accountWallets[count].address === actAddress) {
            walletSigner = accountWallets[count];
            break;
        }
    }
    let tx = { to: process.env.CONTRACTADDRESS, from:actAddress,value: ethers.utils.parseUnits(escrowAmount.toString(),"ether"),chainId: ChainID, gasLimit: 5000000 };
    try {
        let txResult = await walletSigner.sendTransaction(tx);
        return txResult;
    }
    catch (err) {
        return { 'status': 'Error', 'ErrorMsg': err };
    }
};
let transferAsset = async(fromAccount, toAccount, assetID) => {
    let signerContract;
    for (let count = 0; count < accountWallets.length; count++) {
        if (accountWallets[count].address === fromAccount) {
            signerContract = assetTokenContract.connect(accountWallets[count]);
            break;
        }
    }
    try {
        let returnObj = await signerContract.transferAsset(toAccount, assetID, true, { gasPrice: '20000000000', gasLimit: 5000000 });
        let txtReceipt = await returnObj.wait();
        return { 'status': 'Token Transfered', 'Transaction Receipt':txtReceipt };
    }
    catch (err) {
        return { 'status': 'Error', 'ErrorMsg': err };
    }
};    
let putAssetOnSale = async(fromAccount, salePrice, assetID)=> {
    let signerContract;
    for (let count = 0; count < accountWallets.length; count++) {
        if (accountWallets[count].address === fromAccount) {
            signerContract = assetTokenContract.connect(accountWallets[count]);
            break;
        }
    }
    try {
        let returnObj = await signerContract.putAssetOnMarket(salePrice, assetID, { gasPrice: '20000000000', gasLimit: 5000000 });
        let txtReceipt = await returnObj.wait();
        return { 'status': 'Property is put on the market' };
    }
    catch (err) {
        return { 'status': 'Error', 'ErrorMsg': JSON.stringify(err) };
    }
};

export const handler = async(event) => {
    await lambdaSingleton();
    try{
        let urlPath= "" + event.rawPath;
        let urlParam="";
        if(urlPath.lastIndexOf("/")>0){
            urlParam=urlPath.substring(urlPath.lastIndexOf("/")+1);
            urlPath=urlPath.substring(0,urlPath.lastIndexOf("/"));
        }
        let resValue = {};
        let bodyPayload;
        
        switch (urlPath) {
            case '/':
                resValue = await getAllRegisteredAsset();
                break;
            case '/createregistration':
                bodyPayload=JSON.parse(event.body);
                resValue = await registerNewAsset(bodyPayload["salePrice"], bodyPayload["ownerAddress"], bodyPayload["assetTitle"], bodyPayload["assetDesc"], bodyPayload["assetUrl"]);
                break;
            case '/users':
                resValue = await getAllUserInfo();
                break;
            case '/addbuyer':
                resValue = await addUserToMarketPlace();
                break;
            case '/assetsforsale':
                resValue = await listAssetForSale();
                break;
            case '/escrow':
                resValue = await getAccountEscrowBalance(urlParam);
                break;
            case '/ether':
                resValue = await getAccountEtherBalance(urlParam);
                break;
            case '/assets':
                resValue = await showAccountAssets(urlParam);
                break;
            case '/sendEscrow':
                bodyPayload=JSON.parse(event.body);
                resValue = await sendEscrowBalance(bodyPayload["actAccount"],bodyPayload["escrowAmount"]);
                break;
            case '/transfer':
                bodyPayload=JSON.parse(event.body);
                resValue = await transferAsset(bodyPayload["fromAccount"], bodyPayload["toAccount"], bodyPayload["assetID"])
                break;
            case '/assetonmarket':
                bodyPayload=JSON.parse(event.body);
                resValue = await putAssetOnSale(bodyPayload["fromAccount"],bodyPayload["salePrice"],bodyPayload["assetID"]);
                break;
            case '/abitesting':
                //resValue=this.getAbiFromFile();
                break;
            default:
                resValue = { "Error": `Invalid Url: ${JSON.stringify(event.rawPath)}` };
        }
        return {
            "status": 200,
            "responseContent": resValue
        };
        
    }
    catch(e){
        return {
            "status": 500,
            "responseContent": JSON.stringify(e)
        };
    }
};
