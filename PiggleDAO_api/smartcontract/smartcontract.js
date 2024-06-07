const axios = require("axios");
const algosdk = require('algosdk');
const path = require("path");
const fs = require('fs');
const deployment = require('./deployment');
// 스마트컨트랙트 실행에 필요한 json파일을 로드하기 위해
const jsonFile = fs.readFileSync(path.resolve(__dirname, "./config.json"));
const blockchain = require('./blockchain');

const configJson = JSON.parse(jsonFile);

const converter = require('xml-js');

// query 파일
const voteSql = fs.readFileSync(path.resolve(__dirname, "../vote/voteSql.xml"), 'utf-8');

// xml to json
let voteSqlToJson = JSON.parse(converter.xml2json(voteSql, {compact: true, spaces: 4}));

// 쿼리 핸들러
const voteSqllHandeler = require("../vote/voteSqlHandeler");


//투표 스마트컨트랙트 생성
const createVoteApp = function(writer_addr, type){
    return new Promise(async function(resolve, reject){
        try{
            // 1. flask에 스마트 컨트랙트 배포 요청
            const tealPathJson = deployment.requestCreateVoteApp();
            
            tealPathJson.then((result) => {
                // 1) 투표앱 생성 성공
                //      - 출력: tealPathJson => json{code=200, result='success', approval_program_path=approval_program_path, clear_program_path=clear_program_path}
                if(result.code == 200){
                    let nodeToken;
                    let ipAddress;
                    let port;
                    let client;

                    try{
                        //algod 노드 접근 토큰
                        nodeToken = configJson.SmartContractParams.token; 
                                    
                        //algod 노드 ip 주소
                        ipAddress = configJson.SmartContractParams.ip_address;

                        //algod 노드 포트 
                        port = configJson.SmartContractParams.port;

                        // algodClient
                        client = new algosdk.Algodv2({"X-Algo-API-Token" : nodeToken}, ipAddress, port);
                    } catch(err){
                        return resolve({"code" : 500, "msg" : "투표앱 생성 위한 노바랜드 노드정보 가져오기 실패", "error" : "" + err});
                    }

                    // 스마트 컨트랙트 생성은 개발사가 담당한다.
                    const mnemonic = configJson.SmartContractParams.dev_mnemonic;

                    // 2. 스마트 컨트랙트 생성
                    //      - 출력: result = json{"code" : 200, "msg" : "투표에플리케이션 생성 성공", "appId" : appId}
                    //const resultCreateVoteApp = deployment.createVoteApp(mnemonic, type, endDate, result.approval_program_path, result.clear_program_path, client, writer_addr);
                    const resultCreateVoteApp = deployment.createVoteApp(mnemonic, type, result.approval_program_path, result.clear_program_path, client, writer_addr);
                            
                    return resolve(resultCreateVoteApp);
                } else {
                // 2) 투표앱 생성 실패
                //      - 출력: tealPathJson => json{code=500, result='fail', msg="투표 애플리케이션 Teal파일 생성에 실패했습니다", error=err}
                    return resolve(result);
                }    
            });
        } catch(err) {
            return resolve({"code":500, "msg":"createVoteApp 메소드에서 에러 발생", "error": "" + err})
        }
    })
    
};
  
// 투표 스마트 컨트랙트를 호출해서 투표를 한다.
const vote = function(voter_addr, index, upOrDown, post_type) {
    return new Promise(async function(resolve, reject){
        let addrInfo;
        let sender;
        let sk;
        let nodeToken;
        let ipAddress;
        let port;
        let client;
        // 개발사 니모닉
        const mnemonic = configJson.SmartContractParams.dev_mnemonic;


        // 투표를 하기 위해 노바랜드 노드정보를 가져온다.
        try{
            addrInfo = algosdk.mnemonicToSecretKey(mnemonic);
            sender = addrInfo.addr;
            sk = addrInfo.sk;

            //algod 노드 접근 토큰
            nodeToken = configJson.SmartContractParams.token; 
            
            //algod 노드 ip 주소
            ipAddress = configJson.SmartContractParams.ip_address;
            
            //algod 노드 포트 
            port = configJson.SmartContractParams.port;

            // algodClient
            client = new algosdk.Algodv2({"X-Algo-API-Token" : nodeToken}, ipAddress, port);
        } catch(err){
            return resolve({"code": 500, "msg":"투표 위한 client정보 가져오기 실패", "error" : "" + err});
        }
       
        try{
            let vote = "vote"
            let choice = upOrDown
            console.log("choice is " + choice)

            const appArgs = []
            appArgs.push(
                new Uint8Array(Buffer.from(vote)),
                new Uint8Array(Buffer.from(choice)),
            )

            let params = await client.getTransactionParams().do()
                params.fee = 1000;
                params.flatFee = true;

            // create unsigned transaction
            let txn = algosdk.makeApplicationNoOpTxn(sender, params, index, appArgs)

            let txId = txn.txID().toString();
            // Sign the transaction
            let signedTxn = txn.signTxn(sk);
            console.log("Signed transaction with txID: %s", txId);

            // Submit the transaction
            await client.sendRawTransaction(signedTxn).do()

            // Wait for transaction to be confirmed
            const confirmedTxn = await algosdk.waitForConfirmation(client, txId, 4);
            console.log("confirmed" + confirmedTxn)

            //Get the completed Transaction
            console.log("Transaction " + txId + " confirmed in round " + confirmedTxn["confirmed-round"]);

            // display results
            let transactionResponse = await client.pendingTransactionInformation(txId).do();
            console.log("Called app-id:",transactionResponse['txn']['txn']['apid'])
            
            // 투표 성공했다면 db에 저장
            if(txId != null) {
                const datas = [index, post_type, voter_addr, upOrDown];
                
                console.log("datas")
                console.log(datas)

                insertVoteInfoResult = await voteSqllHandeler.insertVoteInfo(datas);
                console.log("insertVoteInfoResult")
                console.log(insertVoteInfoResult)
            }

            if(insertVoteInfoResult.code == 200) {
                return resolve({"code" : 200, "msg": "투표 성공", "txId" : txId})
            } else {
                return resolve(insertVoteInfoResult)
            }
        }catch(err){
            console.log(err)
            return resolve({"code" : 500, "msg" : "투표 실패", "error" : "" + err});
        }
    });
}

/* application 리스트 삭제
    1) 매일 스케줄러가 그날 종료된 애플리케이션 리스트를 받아온다.
    2) 받아온 애플리케이션을 삭제한다.
    * 애플리케이션을 삭제하면 알고랜드의 min-balance가 줄어든다!
    * 삭제는 생성자(개발사 계정)만 가능하다 => 컨트랙트에 그렇게 구현해 놓음
*/
const deleteApp = function(indexArr) {
    return new Promise(async function(resolve, reject){
        try{
            //algod 노드 접근 토큰
            const devmnemonic = configJson.SmartContractParams.dev_mnemonic;
            
            //algod 노드 접근 토큰
            const nodeToken = configJson.SmartContractParams.token; 
            
            //algod 노드 ip 주소
            const ipAddress = configJson.SmartContractParams.ip_address;
            
            //algod 노드 포트 
            const port = configJson.SmartContractParams.port;

            // algodClient
            let algodClient = new algosdk.Algodv2({"X-Algo-API-Token" : nodeToken}, ipAddress, port);
            
            // 개발사 계정 시크릿키 정보
            let addrInfo = algosdk.mnemonicToSecretKey(devmnemonic);
            const sender = addrInfo.addr;
            const sk = addrInfo.sk;

            // 트랜잭션 배열에 각 트랜잭션 넣기
            let txns = [];
            for(let i = 0; i < indexArr.length; i++){
                let params = await algodClient.getTransactionParams().do()
                params.fee = 1000;
                params.flatFee = true;
                let txn = algosdk.makeApplicationDeleteTxn(sender, params, Number(indexArr[i]));

                console.log("indexArr[i]: " + indexArr[i])

                txns.push(txn)
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
            console.log("Transaction " + tx.txId + " confirmed in round " + confirmedTxn["confirmed-round"]);
        
            return resolve({"code" : 200, "msg" : "스마트 컨트랙트 삭제 성공"});
        } catch(err){
            console.log(err)
            return resolve({"code" : 500, "msg" : "스마트 컨트랙트 삭제 실패", "error" : "" + err});
        }
    });
}














/****************** 사용 안함 ******************/
// 스테이킹풀을 생성한다.
const createStakingPool = function(dev_mnemonic, dev_addr) {
    return new Promise(async function(resolve, reject){
        //algod 노드 접근 토큰
        let nodeToken = configJson.SmartContractParams.token; 

        //algod 노드 ip 주소
        let ipAddress = configJson.SmartContractParams.ip_address;
        
        //algod 노드 포트 
        let port = configJson.SmartContractParams.port;

        let token_id = configJson.SmartContractParams.token_id

        console.log("token_id: " + token_id)
            
        return axios.post('http://127.0.0.1:5000/createStakingPool',null,{params: {
            mnemonic: dev_mnemonic,
            creator_addr: dev_addr,
            asset_id: token_id,
            token: nodeToken,
            ip_address: ipAddress+':'+port
            }})  
            .then(async function (response) {
                return resolve(response);
            })
            .catch(function (err) {
                console.log(err)
                return resolve({"code": 500, "msg":"스테이킹풀 생성 위한 통신 실패", "error" : "" + err});
            });
    });
}

// 스테이킹풀을 초기화
const initPool = function(dev_mnemonic, dev_addr, app_id) {
    return new Promise(async function(resolve, reject){
        //algod 노드 접근 토큰
        let nodeToken = configJson.SmartContractParams.token; 

        //algod 노드 ip 주소
        let ipAddress = configJson.SmartContractParams.ip_address;
        
        //algod 노드 포트 
        let port = configJson.SmartContractParams.port;

            
        return axios.post('http://127.0.0.1:5000/initPool',null,{params: {
            mnemonic: dev_mnemonic,
            creator_addr: dev_addr,
            app_id: app_id,
            token: nodeToken,
            ip_address: ipAddress+':'+port
            }})  
            .then(async function (response) {
                return resolve(response);
            })
            .catch(function (err) {
                console.log(err)
                return resolve({"code": 500, "msg":"스테이킹풀 초기화 위한 통신 실패", "error" : "" + err});
            });
    });
}

// 토큰을 스테이킹 한다.
const deposit = function(mnemonic, staker_addr, app_id, amount) {
    return new Promise(async function(resolve, reject){
        //algod 노드 접근 토큰
        let nodeToken = configJson.SmartContractParams.token; 

        //algod 노드 ip 주소
        let ipAddress = configJson.SmartContractParams.ip_address;
        
        //algod 노드 포트 
        let port = configJson.SmartContractParams.port;
            
        return axios.post('http://127.0.0.1:5000/deposit',null,{params: {
            mnemonic: mnemonic,
            staker_addr: staker_addr,
            app_id: app_id,
            token: nodeToken,
            ip_address: ipAddress+':'+port,
            amount : amount
            }})  
            .then(function (response) {
                return response;
            })
            .catch(function (error) {
                console.log(error)
                return error;
            });
    });
}

// 토큰을 인출한다.
const withdraw = function(devmnemonic, app_id, staker_addr, amount) {
    return new Promise(async function(resolve, reject){
        const addrInfo = algosdk.mnemonicToSecretKey(devmnemonic);
        const dev_addr = addrInfo.addr;

        //algod 노드 접근 토큰
        let nodeToken = configJson.SmartContractParams.token; 

        //algod 노드 ip 주소
        let ipAddress = configJson.SmartContractParams.ip_address;
        
        //algod 노드 포트 
        let port = configJson.SmartContractParams.port;
            
        return axios.post('http://127.0.0.1:5000/withdraw',null,{params: {
            mnemonic: devmnemonic,
            dev_addr: dev_addr,
            app_id: app_id,
            staker_addr : staker_addr,
            token: nodeToken,
            ip_address: ipAddress+':'+port,
            amount : amount
            }})  
            .then(function (response) {
                return response;
            })
            .catch(function (error) {
                console.log(error)
                return error;
            });
    });
}
	
// 스마트 컨트랙트에 옵트인한다.
const Optin = function(sender, sk, index){
    return new Promise(async function(resolve, reject){
        let nodeToken;
        let ipAddress;
        let port;
        let client;

        // 노바랜드 노드 정보 가져오기
        try{
            //algod 노드 접근 토큰
            nodeToken = configJson.SmartContractParams.token; 
                        
            //algod 노드 ip 주소
            ipAddress = configJson.SmartContractParams.ip_address;

            //algod 노드 포트 
            port = configJson.SmartContractParams.port;

            // algodClient
            client = new algosdk.Algodv2({"X-Algo-API-Token" : nodeToken}, ipAddress, port);

        } catch(err){
            return resolve({"code" : 500, "msg" : "옵트인 위한 노바랜드 노드 정보 가져오기 실패", "error" : "" + err});
        }

        // 스마트 컨트랙트에 옵트인
        try{
            let params = await client.getTransactionParams().do()
            params.fee = 1000;
            params.flatFee = true;
    
            let txn = algosdk.makeApplicationOptInTxn(sender, params, index);
            let txId = txn.txID().toString();
    
            // sign, send, await
            // Sign the transaction
            let signedTxn = txn.signTxn(sk);
            console.log("Signed transaction with txID: %s", txId);
    
            // Submit the transaction
            await client.sendRawTransaction(signedTxn).do()                           
            // Wait for transaction to be confirmed
            const confirmedTxn = await algosdk.waitForConfirmation(client, txId, 4);
            console.log("confirmed" + confirmedTxn)
    
            //Get the completed Transaction
            console.log("Transaction " + txId + " confirmed in round " + confirmedTxn["confirmed-round"]);
            
            // display results
            let transactionResponse = await client.pendingTransactionInformation(txId).do();
            
            const appId = transactionResponse['txn']['txn']['apid'];
            console.log("Opted-in to app-id:", appId)
            
            return resolve({"code" : 200, "msg" : "스마트 컨트랙트에 옵트인 성공", "appId" : appId});
        } catch(err){
            return resolve({"code" : 500, "msg" : "스마트 컨트랙트에 옵트인 실패", "error" : "" + err});
        }
    });
}

// 지갑을 연결한다.
const connectWallet = function(mnemonic, index, upOrDown) {
    return new Promise(async function(resolve, reject){

    });
}

/* 
    연습 스마트컨트랙트 생성
    입력: mnemonic, ipAddress, port, nodeToken
    출력: json객체 {result: "success", appId: appId}
*/
const createApp = function(mnemonic){
    return new Promise(async function(resolve, reject){
        const result = await deployment.requestCreateApp(mnemonic);
        
        return resolve(result);
    })
    
};

/* 
    연습 스마트컨트랙트 호출
    입력: addr, client, private_key, index, contract
    출력: {account 객체, mnemonic값}
*/
const callApp = function(mnemonic, addr, appId, methodName){
    return new Promise(async function(resolve, reject){
        const result = await deployment.requestCallApp(mnemonic, addr, appId, methodName);
        
        console.log(result.data)

        return resolve(result.data);
    })
}

/* 특정 스마트 컨트랙트에 opt-in돼있는 모든 계정의 연결을 끊는다.
    입력: 계정주소 리스트
*/
const clearState = function(senderMnemonic, index) {
    return new Promise(async function(resolve, reject){
        try{
            //algod 노드 접근 토큰
            const nodeToken = configJson.SmartContractParams.token; 
            
            //algod 노드 ip 주소
            const ipAddress = configJson.SmartContractParams.ip_address;
            
            //algod 노드 포트 
            const port = configJson.SmartContractParams.port;

            // algodClient
            let client = new algosdk.Algodv2({"X-Algo-API-Token" : nodeToken}, ipAddress, port);

            let addrInfo = algosdk.mnemonicToSecretKey(senderMnemonic);
            const sender = addrInfo.addr;
            const sk = addrInfo.sk;

            let params = await client.getTransactionParams().do()
            params.fee = 1000;
            params.flatFee = true;
            let txn = algosdk.makeApplicationClearStateTxn(sender, params, index);
            let txId = txn.txID().toString();
            // sign, send, await
            let signedTxn = txn.signTxn(sk);
            console.log("Signed transaction with txID: %s", txId);
        
            // Submit the transaction
            await client.sendRawTransaction(signedTxn).do()                           
            // Wait for transaction to be confirmed
            const confirmedTxn = await algosdk.waitForConfirmation(client, txId, 4);
            console.log("confirmed" + confirmedTxn)
    
            //Get the completed Transaction
            console.log("Transaction " + txId + " confirmed in round " + confirmedTxn["confirmed-round"]);

            // display results
            let transactionResponse = await client.pendingTransactionInformation(txId).do();
            let appId = transactionResponse['txn']['txn'].apid;
            console.log("Cleared local state for app-id: ",appId);
            return resolve({"code" : 200, "msg" : "clear state success", "appId" : appId});
        }catch(err){
            console.log(err);
            return resolve({"code" : 200, "msg" : "clear state fail", "error" : "" + err});
        }
    })
}
/****************** 사용 안함 ******************/



module.exports = {createVoteApp, vote, deleteApp};
