// 알고랜드 sdk를 사용하기 위해
const algosdk = require('algosdk');
const crypto = require('crypto');
const fs = require('fs');
const axios = require("axios");
// 해시맵
const HashMap  = require ('hashmap') ;

// 스마트컨트랙트 실행에 필요한 json파일을 로드하기 위해
const jsonFile = fs.readFileSync(`${__dirname}/config.json`, 'utf8');

const configJson = JSON.parse(jsonFile);


/* 
    계정주소를 이용해서 계정정보 확인
    입력: 계정주소
    출력: {account 정보 json객체}
*/
const selectAccountInfo = async (addr) => {
    return new Promise(async function(resolve, reject){
        //algod 노드 접근 토큰
        nodeToken = configJson.SmartContractParams.token; 

        //algod 노드 ip 주소
        ipAddress = configJson.SmartContractParams.ip_address;
        
        //algod 노드 포트 
        port = configJson.SmartContractParams.port;

        let algodClient = new algosdk.Algodv2({"X-Algo-API-Token" : nodeToken}, ipAddress, port);
    
        let account_info = (await algodClient.accountInformation(addr).do());

        return resolve(account_info)
    });
};

const selectAccountAmountInfo = async (addr) => {
    return new Promise(async function(resolve, reject){
        try{
            //algod 노드 접근 토큰
            nodeToken = configJson.SmartContractParams.token; 

            //algod 노드 ip 주소
            ipAddress = configJson.SmartContractParams.ip_address;
            
            //algod 노드 포트 
            port = configJson.SmartContractParams.port;

            let algodClient = new algosdk.Algodv2({"X-Algo-API-Token" : nodeToken}, ipAddress, port);
        
            let account_info = (await algodClient.accountInformation(addr).do());

            // piggle amount
            const tokenId = configJson.SmartContractParams.token_id;
            const bubblyTokenId = configJson.SmartContractParams.bubbly_token_id;

            const piggleAmount = await checkTokenAmount(account_info, tokenId);

            let bubbleAmount = await checkTokenAmount(account_info, bubblyTokenId);
            if(bubbleAmount == "empty") {
                bubbleAmount = "not opt-in"
            }
            
            return resolve({"code" : 200, 
                            "msg" : "계정정보 조회 완료", 
                            "accountInfo" : {
                                "addr" : addr,
                                "Nova" : account_info.amount,
                                "piggle" : piggleAmount,
                                "bubble" : bubbleAmount
                            }  
                        });
        } catch(err) {
            return resolve({"code" : 500, "msg" : "계정정보 조회 실패", "error" : "" + err});
        }
    });
};


// 계정의 주소와 sk(트랜잭션을 전송할 때 사용하는 세션키)를 얻기 위한 함수
const getPk = function(devMnemonic){
    return new Promise(async function(resolve, reject){
        const devAddr = algosdk.mnemonicToSecretKey(devMnemonic);

        return resolve(devAddr);
    });
};

/*
    개발사 계정 => addr계정으로 입력한 수만큼 Nova 보내기
*/
const sendToAddrByDevAddrWithAmount = function(addr,amount){
    return new Promise(async function(resolve, reject){
        //algod 노드 접근 토큰
        nodeToken = configJson.SmartContractParams.token; 
        //algod 노드 ip 주소
        ipAddress = configJson.SmartContractParams.ip_address;
        //algod 노드 포트 
        port = configJson.SmartContractParams.port;
        //개발사 계정주소
        devAddress = configJson.SmartContractParams.dev_address; 
        //개발사 니모닉(우리계정니모닉)
        devMnemonic = configJson.SmartContractParams.dev_mnemonic; 

        try{
            let algodClient = new algosdk.Algodv2({"X-Algo-API-Token" : nodeToken}, ipAddress, port);

            let params = await algodClient.getTransactionParams().do();
            //const devAddr = await algosdk.mnemonicToSecretKey(devMnemonic);
            const devAddr = await getPk(devMnemonic);

            let txn = {
                "from": devAddress,
                "to": addr,
                "amount": amount,
                "fee": params.fee,
                "firstRound": params.firstRound,
                "lastRound": params.lastRound,
                "genesisID": params.genesisID,
                "genesisHash": params.genesisHash,
                "note": new Uint8Array(0),
            };

            console.log("txn: " + txn);
            console.log("devAddr.sk: " + devAddr.sk);

            const signedTxn = algosdk.signTransaction(txn, devAddr.sk);

            const sendTx = await algodClient.sendRawTransaction(signedTxn.blob).do();
            console.log("Transaction sent with ID " + sendTx.txId);
            
            await waitForConfirmation(algodClient, sendTx.txId)
            // 계정정보 가져오고 최소 노바양 체크
            const accountObj = await selectAccountInfo(addr);
            return resolve({"code": 200, "msg" : "계정에게 Nova 전송 완료.", "amount" : accountObj.amount});
        } catch(err){
            console.log(err);
            return resolve({"code": 500, "msg" : "계정에게 Nova 전송 실패.", "error" : "" + err});
        }
    })
}

/*
    addr계정 => 개발사 계정으로 입력한 수만큼 Nova 보내기
*/
const sendToDevByAddrWithAmount = function(mnemonic, addr,amount){
    return new Promise(async function(resolve, reject){
        //algod 노드 접근 토큰
        nodeToken = configJson.SmartContractParams.token; 
        //algod 노드 ip 주소
        ipAddress = configJson.SmartContractParams.ip_address;
        //algod 노드 포트 
        port = configJson.SmartContractParams.port;
        //개발사 계정주소
        devAddress = configJson.SmartContractParams.dev_address; 


        try{
            let algodClient = new algosdk.Algodv2({"X-Algo-API-Token" : nodeToken}, ipAddress, port);

            let params = await algodClient.getTransactionParams().do();
            //const devAddr = await algosdk.mnemonicToSecretKey(devMnemonic);
            const devAddr = await getPk(mnemonic);

            let txn = {
                "from": addr,
                "to": devAddress,
                "amount": amount,
                "fee": params.fee,
                "firstRound": params.firstRound,
                "lastRound": params.lastRound,
                "genesisID": params.genesisID,
                "genesisHash": params.genesisHash,
                "note": new Uint8Array(0),
            };

            console.log("txn: " + txn);
            console.log("devAddr.sk: " + devAddr.sk);

            const signedTxn = algosdk.signTransaction(txn, devAddr.sk);
            const sendTx = await algodClient.sendRawTransaction(signedTxn.blob).do();
            console.log("Transaction sent with ID " + sendTx.txId);
            
            await waitForConfirmation(algodClient, sendTx.txId)
            return resolve("success");
        } catch(err){
            console.log(err);
            return resolve({"code": 500, "msg" : "개발사 계정에게 Nova 전송 실패.", "error" : "" + err});
        }
    })
}


/*
    개발사 계정 => addrList에 속해있는 각 계정에게 입력한 수만큼 Nova 보내기
*/
const sendToAddrListByDevAddrWithAmount = function(addrList,amount){
    return new Promise(async function(resolve, reject){
        //algod 노드 접근 토큰
        nodeToken = configJson.SmartContractParams.token; 
        //algod 노드 ip 주소
        ipAddress = configJson.SmartContractParams.ip_address;
        //algod 노드 포트 
        port = configJson.SmartContractParams.port;
        //개발사 계정주소
        devAddress = configJson.SmartContractParams.dev_address; 
        //개발사 니모닉(우리계정니모닉)
        devMnemonic = configJson.SmartContractParams.dev_mnemonic; 

        try{
            const devAddr = await getPk(devMnemonic);

            let params = await algodClient.getTransactionParams().do();

            let algodClient = new algosdk.Algodv2({"X-Algo-API-Token" : nodeToken}, ipAddress, port);

            for(let i = 0; i < addrList.length; i++){
                makePaymentTxn(devAddress, addr, amount);
            }

            let txn = {
                "from": devAddress,
                "to": addr,
                "amount": amount,
                "fee": params.fee,
                "firstRound": params.firstRound,
                "lastRound": params.lastRound,
                "genesisID": params.genesisID,
                "genesisHash": params.genesisHash,
                "note": new Uint8Array(0),
            };

            console.log("txn: " + txn);
            console.log("devAddr.sk: " + devAddr.sk);

            const signedTxn = algosdk.signTransaction(txn, devAddr.sk);
            const sendTx = await algodClient.sendRawTransaction(signedTxn.blob).do();
            console.log("Transaction sent with ID " + sendTx.txId);
            
            await waitForConfirmation(algodClient, sendTx.txId)
            return resolve("success");
        } catch(err){
            console.log(err);
            return resolve({"code": 500, "msg" : "sendToAddrListByDevAddrWithAmount 실패.", "error" : "" + err});
        }
    })
}

/* 
    토큰 옵트인
    입력: 옵트인 할 계정주소, 옵트인할 토큰 아이디
    출력: {account 정보 json객체}
*/
const tokenOptIn = function(user_mnemonic, assetID){
    return new Promise(async function(resolve, reject){
        console.log("assetID")
        console.log(assetID)
        let nodeToken;
        let ipAddress;
        let port;
        let params;
        let userAddr;
        let sender;
        let recipient;

        try{
            //algod 노드 접근 토큰
            nodeToken = configJson.SmartContractParams.token; 
            //algod 노드 ip 주소
            ipAddress = configJson.SmartContractParams.ip_address;
            //algod 노드 포트 
            port = configJson.SmartContractParams.port;

            algodClient = new algosdk.Algodv2({"X-Algo-API-Token" : nodeToken}, ipAddress, port);

            params = await algodClient.getTransactionParams().do();

            userAddr = await getPk(user_mnemonic);

            params = await algodClient.getTransactionParams().do();
            params.fee = 1000;
            params.flatFee = true;

            sender = userAddr.addr;
            recipient = sender;
            revocationTarget = undefined;
            closeRemainderTo = undefined;
            amount = 0;
            note = new Uint8Array(0);
            
            assetID = Number(assetID);    
            
            // 계정정보 가져오고 최소 노바양 체크
            const accountObj = await selectAccountInfo(sender);

            if(accountObj.amount - accountObj['min-balance'] < 101000){
                return resolve({"code": 500, "msg" : "옵트인을 위한 최소 Nova양이 부족합니다.", "error" : "보유량: " + accountObj.amount + "Nova 최소 요구량: " + (accountObj['min-balance'] + 101000)+ "Nova"});
            }
        } catch(err) {
            console.log(err);
            return resolve({"code":500, "msg":"노드정보 조회에 실패했습니다.", "error": "" + err})
        }

        try{
            // signing and sending "txn" allows sender to begin accepting asset specified by creator and index
            let opttxn = algosdk.makeAssetTransferTxnWithSuggestedParams(sender, recipient, closeRemainderTo, revocationTarget,amount, note, assetID, params);
            console.log("userAddr.sk: " + userAddr.sk);

            // Must be signed by the account wishing to opt in to the asset    
            rawSignedTxn = opttxn.signTxn(userAddr.sk);
            let opttx = await algodClient.sendRawTransaction(rawSignedTxn).do();

            // wait for transaction to be confirmed
            await waitForConfirmation(algodClient, opttx.txId);
            return resolve({"code":200, "msg":"옵트인에 성공했습니다."});
        } catch(err){
            console.log(err);
            return resolve({"code":500, "msg":"옵트인에 실패했습니다.", "error": "" + err})
        }
    })
};


/* 
    토큰 전송
    입력: 보내는 사람의 니모닉, 받는 사람의 니모닉
    출력: {account 정보 json객체}
*/
const transferToken = async (sender_mnemonic, receiverAddr, assetID, amount) => {
    return new Promise(async function(resolve, reject){
        try{
            //algod 노드 접근 토큰
            nodeToken = configJson.SmartContractParams.token; 
            //algod 노드 ip 주소
            ipAddress = configJson.SmartContractParams.ip_address;
            //algod 노드 포트 
            port = configJson.SmartContractParams.port;

            let algodClient = await new algosdk.Algodv2({"X-Algo-API-Token" : nodeToken}, ipAddress, port);

            let params = await algodClient.getTransactionParams().do();

            const senderAddr = algosdk.mnemonicToSecretKey(sender_mnemonic);

            params = await algodClient.getTransactionParams().do();
            params.fee = 1000;
            params.flatFee = true;

            sender = senderAddr.addr;

            // 계정정보 가져오고 최소 노바양 체크
            const accountObj = await selectAccountInfo(sender);
            
            console.log("accountObj.amount: " + accountObj.amount)
            console.log("accountObj['min-balance']: " + accountObj['min-balance'])

            if(accountObj.amount - accountObj['min-balance'] < 1000){
                return resolve({"code" : 500, "msg" : "트랜잭션을 위한 최소 Nova양이 부족합니다", "error" : "보유량: " + accountObj.amount + "Nova 최소 요구량: " + (accountObj['min-balance'] + 1000) + "Nova"});
            }

            const tokenAmount = await checkTokenAmount(accountObj, assetID);

            if(tokenAmount == "empty"){
                return resolve({"code" : 500, "msg" : "해당 토큰을 보유하고 있지 않습니다.", "error" : ""});
            }

            // 보유한 버블양이 nft가격보다 적다면
            if(Number(tokenAmount) < Number(amount)){
                return resolve({"code" : 500, "msg" : "보유한 토큰양이 전송하려는 토큰양보다 적습니다.", "error" : "보유토큰양 : " + tokenAmount});
            }

            if(accountObj.amount < 1000) {
                return resolve({"code" : 500, "msg" : "Nova가 부족합니다.", "error" : "보유Nova : " + accountObj.amount});
            }

            recipient = receiverAddr;
            revocationTarget = undefined;
            closeRemainderTo = undefined;
            note = new Uint8Array(0)
                
            assetID = Number(assetID);

            // signing and sending "txn" will send "amount" assets from "sender" to "recipient"
            let xtxn = algosdk.makeAssetTransferTxnWithSuggestedParams(sender, recipient, closeRemainderTo, revocationTarget, amount,  note, assetID, params);
            
            // Must be signed by the account sending the asset  
            rawSignedTxn = xtxn.signTxn(senderAddr.sk)

            let xtx = (await algodClient.sendRawTransaction(rawSignedTxn).do());
            //console.log("Transaction : " + xtx.txId);
            
            // wait for transaction to be confirmed
            await waitForConfirmation(algodClient, xtx.txId);

            //await printAssetHolding(algodclient, receiverAddr.addr, assetID);
            return resolve({"code" : 200, "msg" : "토큰 전송완료"});
        } catch(err){
            console.log(err);
            return resolve({"code" : 500, "msg" : "토큰 전송 중 에러 발생", "error" : "" + err});
        }
    });
};

/* 
    여러명에게 토큰 전송
*/
const transferTokenToAddrs = async (sender_mnemonic, receiverAddrArr, assetID, amount, rewardAmountArr) => {
    return new Promise(async function(resolve, reject){
        try{
            //algod 노드 접근 토큰
            nodeToken = configJson.SmartContractParams.token; 
            //algod 노드 ip 주소
            ipAddress = configJson.SmartContractParams.ip_address;
            //algod 노드 포트 
            port = configJson.SmartContractParams.port;

            let algodClient = new algosdk.Algodv2({"X-Algo-API-Token" : nodeToken}, ipAddress, port);

            let params = await algodClient.getTransactionParams().do();

            const senderAddr = algosdk.mnemonicToSecretKey(sender_mnemonic);

            params = await algodClient.getTransactionParams().do();
            params.fee = 1000;
            params.flatFee = true;

            let sender = senderAddr.addr;
            let sk = senderAddr.sk;

            // 토큰 전송 위한 tx 생성
            // 트랜잭션 배열에 각 트랜잭션 넣기
            let txns = [];
            for(let i = 0; i < receiverAddrArr.length; i++){
                let params = await algodClient.getTransactionParams().do()
                params.fee = 1000;
                params.flatFee = true;

                recipient = receiverAddrArr[i];
                revocationTarget = undefined;
                closeRemainderTo = undefined;
                note = new Uint8Array(0)
                    
                assetID = Number(assetID);

                // signing and sending "txn" will send "amount" assets from "sender" to "recipient"
                let txn;
                // amount가 동일
                if(amount != null) {
                    txn = algosdk.makeAssetTransferTxnWithSuggestedParams(sender, recipient, closeRemainderTo, revocationTarget, amount,  note, assetID, params);
                } else {
                // amount가 다름
                    txn = algosdk.makeAssetTransferTxnWithSuggestedParams(sender, recipient, closeRemainderTo, revocationTarget, rewardAmountArr[i],  note, assetID, params);
                }

                txns.push(txn)
                console.log(txn)
            }

            // 트랜잭션 그룹 생성
            algosdk.assignGroupID(txns);

            // 트랜잭션 그룹의 각 트랜잭션 서명
            let signed = []
            for(let i = 0; i < txns.length; i++){
                // Sign each transaction in the group 
                signed.push(txns[i].signTxn(sk))
            }

            // 트랜잭션 그룹 네트워크로 전송
            let tx = (await algodClient.sendRawTransaction(signed).do());
            console.log("Transaction : " + tx.txId);

            // 트랜잭션이 처리될 때까지 4라운드 동안 기다림
            confirmedTxn = await algosdk.waitForConfirmation(algodClient, tx.txId, 4);
            //Get the completed Transaction
            console.log("여러명에게 토큰전송하는 Transaction " + tx.txId + " confirmed in round " + confirmedTxn["confirmed-round"]);

            //await printAssetHolding(algodclient, receiverAddr.addr, assetID);
            return resolve({"code" : 200, "msg" : "토큰 전송완료"});
        } catch(err){
            console.log(err);
            return resolve({"code" : 500, "msg" : "토큰 전송 중 에러 발생", "error" : "" + err});
        }
    });
};


// 트랜잭션이 완료될 때까지 대기
const waitForConfirmation = async function (algodclient, txId) {
    let response = await algodclient.status().do();
    let lastround = response["last-round"];
    while (true) {
        const pendingInfo = await algodclient.pendingTransactionInformation(txId).do();
        if (pendingInfo["confirmed-round"] !== null && pendingInfo["confirmed-round"] > 0) {
            //Got the completed Transaction
            console.log("Transaction " + txId + " confirmed in round " + pendingInfo["confirmed-round"]);
            break;
        }
        lastround++;
        await algodclient.statusAfterBlock(lastround).do();
    }
};


/**
 * 
 * @param  mnemonic => 토큰을 생성할 계정의 니모닉 
 * @param  unitName => 토큰 단위
 * @param  assetName => 토큰 명
 * @param  amount => 발행할 토큰 양
 * @returns 
 */
const createToken = async function createAsset(mnemonic, unitName, assetName, amount) {
    return new Promise(async function(resolve, reject){
        try{
            if(unitName.length > 8){
                return resolve("unitName은 8글자 이내로 만들어주세요.")
            }
    
            //algod 노드 접근 토큰
            nodeToken = configJson.SmartContractParams.token; 
            //algod 노드 ip 주소
            ipAddress = configJson.SmartContractParams.ip_address;
            //algod 노드 포트 
            port = configJson.SmartContractParams.port;
    
            const algodClient = await new algosdk.Algodv2({"X-Algo-API-Token" : nodeToken}, ipAddress, port);
            console.log("algod client");
    
            const account = await getPk(mnemonic);
            console.log("account: " + account.addr);
    
            console.log("==> CREATE ASSET");
            //Check account balance    
            const accountInfo = await algodClient.accountInformation(account.addr).do();
            const startingAmount = accountInfo.amount;
            
            console.log("account balance: %d microNovas", startingAmount);
    
            // 계정정보 가져오고 최소 노바양 체크
            const accountObj = await selectAccountInfo(account.addr);
    
            if(accountObj.amount - accountObj['min-balance'] < 101000){
                return resolve("토큰 생성을 위한 최소 Nova양이 부족합니다. 보유량: " + accountObj.amount + "Nova 최소 요구량: " + (accountObj['min-balance'] + 101000)+ "Nova");
            } 
    
            // Construct the transaction
            const params = await algodClient.getTransactionParams().do();
    
            // Whether user accounts will need to be unfrozen before transacting    
            const defaultFrozen = false;
    
            const metadataJSON = {
                "name": assetName,
                "description": assetName,
                "properties": {
                    "simple_property": assetName,
                    "rich_property": {
                        "name": assetName,
                        "value": "001",
                        "display_value": "001",
                        "class": "emphasis",
                        "css": {
                            "color": "#ffffff",
                            "font-weight": "bold",
                            "text-decoration": "underline"
                        }
                    },
                    "array_property": {
                        "name": assetName,
                        "value": [1, 2, 3, 4],
                        "class": "emphasis"
                    }
                }
            }
    
            // The following parameters are the only ones
            // that can be changed, and they have to be changed
            // by the current manager
            // Specified address can change reserve, freeze, clawback, and manager
            // If they are set to undefined at creation time, you will not be able to modify these later
            const managerAddr = account.addr; // OPTIONAL: FOR DEMO ONLY, USED TO DESTROY ASSET WITHIN THIS SCRIPT
            // Specified address is considered the asset reserve
            // (it has no special privileges, this is only informational)
            const reserveAddr = account.addr; 
            // Specified address can freeze or unfreeze user asset holdings   
            const freezeAddr = account.addr;
            // Specified address can revoke user asset holdings and send 
            // them to other addresses    
            const clawbackAddr = account.addr;
            
            // Use actual asset total  > 1 to create a Fungible Token
            // example 1:(fungible Tokens)
            // totalIssuance = 10, decimals = 0, result is 10 actual asset total
            // example 2: (fractional NFT, each is 0.1)
            // totalIssuance = 10, decimals = 1, result is 1.0 actual asset total
            // example 3: (NFT)
            // totalIssuance = 1, decimals = 0, result is 1 actual asset total 
    
            // integer number of decimals for asset unit calculation
            // decimals이 6인 경우 1토큰 => 10^6decimal
            //(ex 토큰명 bubble이고 decemial이 6일 때 총 발행량이 100개라면 실제 발행량은 100 * 10^6개가 된다.)
            const decimals = 6; 
            const total = amount; // how many of this asset there will be
    
            // temp fix for replit    
            const metadatafile = metadataJSON.toString();
            const hash = crypto.createHash('sha256');
            hash.update(metadatafile);
    
            // replit error  - work around
            const metadata = new Uint8Array(hash.digest());
    
            // signing and sending "txn" allows "addr" to create an asset 
            const txn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
                from: account.addr,
                total,
                decimals,
                assetName,
                unitName,
                assetMetadataHash: metadata,
                defaultFrozen,
                freeze: freezeAddr,
                manager: managerAddr,
                clawback: clawbackAddr,
                reserve: reserveAddr,
                suggestedParams: params,});
    
            const rawSignedTxn = txn.signTxn(account.sk);
            const tx = (await algodClient.sendRawTransaction(rawSignedTxn).do());
            let assetID = null;
    
            // wait for transaction to be confirmed
            const ptx = await algosdk.waitForConfirmation(algodClient, tx.txId, 4);
            //console.log("Transaction " + tx.txId + " confirmed in round " + ptx["confirmed-round"]);
    
            //Get the completed Transaction
            assetID = ptx["asset-index"];
            return resolve(assetID);
        } catch(err) {
            console.log(err)
            return resolve("" + err);
        }
    });
}

// 개발사 계정에게 토큰 전송
const transferTokenToDevAmount = async (sender_mnemonic, assetID, amount) => {
    return new Promise(async function(resolve, reject){
        try{
            //algod 노드 접근 토큰
            nodeToken = configJson.SmartContractParams.token; 
            //algod 노드 ip 주소
            ipAddress = configJson.SmartContractParams.ip_address;
            //algod 노드 포트 
            port = configJson.SmartContractParams.port;
            //개발사 계정주소
            devAddress = configJson.SmartContractParams.dev_address; 
            //개발사 니모닉(우리계정니모닉)
            devMnemonic = configJson.SmartContractParams.dev_mnemonic; 
            let algodClient = new algosdk.Algodv2({"X-Algo-API-Token" : nodeToken}, ipAddress, port);

            // 계정정보 가져오기
            let params;
            let senderAddr
            let sender
            let accountObj
            try{
                params = await algodClient.getTransactionParams().do();

                //사용자가 송금자
                senderAddr = algosdk.mnemonicToSecretKey(sender_mnemonic);
    
                sender = senderAddr.addr;
    
                // 계정정보 가져오기
                accountObj = await selectAccountInfo(sender);
            } catch(err) {
                return resolve({"code": 500, "msg" : "계정정보 조회 실패.", "error" : "" + err});
            }
            
            console.log(accountObj);
            console.log(accountObj['min-balance']);

            if(accountObj.amount <= accountObj['min-balance']){
                return resolve({"code": 500, "msg" : "트랜잭션을 위한 최소 Nova양이 부족합니다", "error" : "보유량이 최소 요구량보다 1000이상 커야합니다.\n보유량: " + accountObj.amount + "Nova 최소 요구량: " + (accountObj['min-balance'] + 1000) + "Nova"});
            }
            
            const tokenAmount = await checkTokenAmount(accountObj, assetID);

            if(tokenAmount == "empty"){
                return resolve({"code": 500, "msg" : "해당 토큰을 보유하고 있지 않습니다.", "error" : "해당 토큰을 보유하고 있지 않습니다."});
            }

            // 보유한 버블양이 nft가격보다 적다면
            if(Number(tokenAmount) < Number(amount)){
                return resolve({"code": 500, "msg" : "보유한 토큰양이 전송하려는 토큰양보다 적습니다.", "error" : "보유량: " + Number(tokenAmount) + "piggle 전송 요청량: " + Number(amount) + "piggle"});
            }

            //개발사가 수신자
            const receiverAddr = algosdk.mnemonicToSecretKey(devMnemonic);
            params = await algodClient.getTransactionParams().do();
            params.fee = 1000;
            params.flatFee = true;

            let recipient = receiverAddr.addr;
            let revocationTarget = undefined;
            let closeRemainderTo = undefined;
            note = new Uint8Array(0)
            //Amount of the asset to transfer
            amount = amount;
            
            assetID = Number(assetID);

            // signing and sending "txn" will send "amount" assets from "sender" to "recipient"
            let xtxn = algosdk.makeAssetTransferTxnWithSuggestedParams(sender, recipient, closeRemainderTo, revocationTarget,amount, note, assetID, params);
            // Must be signed by the account sending the asset  
            rawSignedTxn = xtxn.signTxn(senderAddr.sk)
            
            // 트랜잭션 전송
            try{
                let xtx = (await algodClient.sendRawTransaction(rawSignedTxn).do());
                await waitForConfirmation(algodClient, xtx.txId);
                return resolve({"code": 200, "msg" : "개발사에게 piggle 전송 완료"});
            } catch(err) {
                return resolve({"code": 500, "msg" : "트랜잭션 전송 중 에러 발생", "error" : "" + err});
            }
        } catch(err) {
            return resolve({"code": 500, "msg" : "개발사에게 piggle 전송 실패.", "error" : "" + err});
        }
    });
};

// 보유한 토큰양 체크   
const checkTokenAmount = async(accountObj, assetID) => {
    return new Promise(async(resolve)=>{
        for(let i = 0; i < accountObj.assets.length; i ++ ){
            if(accountObj.assets[i]["asset-id"] == assetID){
                console.log("amount: " + accountObj.assets[i]["amount"]);
                //문자열로 반환
                return resolve("" + accountObj.assets[i]["amount"]);
            }
        }
        return resolve("empty");
    });
}

// 스마트컨트랙트 조회   
const selectApp = (appID) => {
    return new Promise(async(resolve)=>{
        const token  = "";
        const server = configJson.SmartContractParams.ip_address;
        const port   = 8980;
        const indexerClient = new algosdk.Indexer(token, server, port);

        const appId = appID;
        const appInfo = await indexerClient.lookupApplications(appId).do();

        console.log(appInfo);

        return resolve(appInfo);
    });
}

// read global state of application
const readGlobalState = async (index) => {
    //algod 노드 접근 토큰
    nodeToken = configJson.SmartContractParams.token; 

    //algod 노드 ip 주소
    ipAddress = configJson.SmartContractParams.ip_address;
    
    //algod 노드 포트 
    port = configJson.SmartContractParams.port;

    let client = new algosdk.Algodv2({"X-Algo-API-Token" : nodeToken}, ipAddress, port);

    const globalMap = new HashMap()

    let applicationInfoResponse = await client.getApplicationByID(index).do();
    let globalState = applicationInfoResponse['params']['global-state']

    for (let n = 0; n < globalState.length; n++) {
    const gs = globalState[n]
    let key = Buffer.from(gs.key, "base64");
    key = key.toString('utf-8')
    if(key == "up" || key == "down") {
        globalMap.set(key, gs.value.uint)
    } 
    }
    
    return globalMap
  }

// piggle => Nova로 변경
const exchangeToNova = (dataMap) => {
    return new Promise(async(resolve)=>{
        try{
            const tokenId = configJson.SmartContractParams.token_id;

            // 사용자 정보
            const senderAddr = dataMap.get("sender_addr");
            const senderMnemonic = dataMap.get("sender_mnemonic");
            const tokenAmount = Number(dataMap.get("token_amount"));
            const amount = tokenAmount + 1000; //1 piggle = 1 Nova, 수수료도 함께 전달
            
            // 개발사 계정에게 토큰 전송
            let result
        
            result = await transferTokenToDevAmount(senderMnemonic,tokenId,tokenAmount);
            
            if(result.code == 200) {
                // 계정에게 Nova 전송
                const result2 = await sendToAddrByDevAddrWithAmount(senderAddr,amount);

                return resolve(result2);
            } else {
                return resolve(result);
            }
        } catch(err) {
            console.log(err)
            return resolve({"code": 500, "msg" : "exchangeToNova 에러 발생", "error" : "" + err});
        }
    });
}

// piggle => Bubble로 변경
const exchangeToBubble = (dataMap) => {
    return new Promise(async(resolve)=>{
        try{
            const tokenId = configJson.SmartContractParams.token_id;
            const bubblyTokenId = configJson.SmartContractParams.bubbly_token_id;

            // 사용자 정보
            const senderAddr = dataMap.get("sender_addr");
            const senderMnemonic = dataMap.get("sender_mnemonic");
            const tokenAmount = Number(dataMap.get("token_amount"));
            const amount = tokenAmount; //1 piggle = 1 Nova
            
            //개발사 니모닉
            const devMnemonic = configJson.SmartContractParams.dev_mnemonic; 

            // 수신계정이 bubble에 옵트인 됐는지 여부 확인
            // 사용자 정보 조회
            const accountObj = await selectAccountInfo(senderAddr);
            
            const isOptIn = await checkTokenAmount(accountObj, bubblyTokenId);

            if(isOptIn == "empty"){
                return resolve({"code" : 500, "msg" : "해당 계정은 bubble토큰에 옵트인 되지 않았습니다.", "error" : "bubbly앱에 등록된 계정을 사용해주세요"});
            }

            // 개발사 계정에게 토큰 전송
            let result
            result = await transferTokenToDevAmount(senderMnemonic,tokenId,tokenAmount);
            
            // 성공했다면 개발사가 계정에게 버블 전송
            if(result.code == 200) {
                // 계정에게 Nova 전송(수수료)
                const result2 = await sendToAddrByDevAddrWithAmount(senderAddr,1000);


                if(result2.code == 200) {
                    // 계정에게 bubble 전송
                    const result3 = await transferToken(devMnemonic, senderAddr, bubblyTokenId, amount);

                    return resolve(result3);
                } else {
                    return resolve(result2);
                }
            } else {
                return resolve(result);
            }
        } catch(err) {
            console.log(err)
            return resolve({"code": 500, "msg" : "exchangeToBubble 에러 발생", "error" : "" + err});
        }
    });
}

/* 
    새로운 블록체인 계정 및 니모닉 생성
    입력: 없음
    출력: {account 객체, mnemonic값}
*/
const makeBlockchainAddrAndMnemonic = function(){
    return new Promise(async function(resolve, reject){
        const account = await algosdk.generateAccount();
        const mnemonic = await algosdk.secretKeyToMnemonic(account.sk);

        const data = {account, mnemonic};

        return resolve(data);
    })
};
  

module.exports = { transferTokenToAddrs, 
                   readGlobalState, 
                   sendToDevByAddrWithAmount, 
                   selectApp, 
                   sendToAddrListByDevAddrWithAmount, 
                   selectAccountInfo, 
                   tokenOptIn, 
                   transferToken, 
                   sendToAddrByDevAddrWithAmount, 
                   getPk, 
                   createToken, 
                   transferTokenToDevAmount,
                   exchangeToNova,
                   exchangeToBubble,
                   selectAccountAmountInfo,
                   makeBlockchainAddrAndMnemonic
                };
