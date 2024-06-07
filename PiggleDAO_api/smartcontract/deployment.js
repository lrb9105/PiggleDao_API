const fs = require('fs')
const algosdk = require('algosdk');
const axios = require("axios");
const path = require("path");
const blockchain = require('./blockchain');

// 스마트컨트랙트 실행에 필요한 json파일을 로드하기 위해
const jsonFile = fs.readFileSync(path.resolve(__dirname, "./config.json"));

const configJson = JSON.parse(jsonFile);

// 투표 App 생성
// 스마트컨트랙트 생성 후 min-balance:264,000이 올라간다.
// 최초 생성시에는 토큰 옵트인 비용(100,000)까지 총 364,000이 올라간다.
const createVoteApp = function(mnemonic, type, // 생성자 니모닉, 글타입=> 0:주가예측, 1:운영글, 2:분석글, 종료일(ex) 2022-10-31 08:00:00)
                               approval_program_path,clear_program_path, // 배포된 teal파일 경로
                               client, writer_addr
                               ){
    return new Promise(async function(resolve, reject){
      /* ============= 투표 애플리케이션 생성 위한 teal파일 byte로 컴파일 시작 ============= */
      // Teal파일을 읽는다 => 플라스크단에서 앱을 배포하고 teal파일을 만들면 
      let approval_program_teal;
      let clear_program_teal;
      let approval_program;
      let clear_program;

      // teal파일 to byte코드로 컴파일
      try {
        approval_program_path = '../../PiggleDAO/' + approval_program_path;
        clear_program_path = '../../PiggleDAO/' + clear_program_path;
        
        // 경로를 제대로 가져오나 로그 찍어보기
        console.log(approval_program_path)
        console.log(clear_program_path)

        // teal파일 읽기
        approval_program_teal = fs.readFileSync(path.resolve(__dirname, approval_program_path),'utf-8')
        clear_program_teal = fs.readFileSync(path.resolve(__dirname, clear_program_path),'utf-8')

        // teal파일 byte로 컴파일
        approval_program = await compileProgram(client, approval_program_teal)
        clear_program = await  compileProgram(client,clear_program_teal)

        // 해당 path의 teal파일 삭제하기
        fs.unlink(path.resolve(__dirname, approval_program_path), err => {
          if(err!=null){
          console.log(approval_program_path + "파일 삭제 Error 발생\n" + err);
          }
        });

        fs.unlink(path.resolve(__dirname, clear_program_path), err => {
          if(err!=null){
            console.log(clear_program_path + "파일 삭제 Error 발생\n" + err);
          }
        });
      } catch (err) {
        console.error(err)
        return resolve({"code":500, "msg": "투표 애플리케이션 byte로 컴파일 실패", "error": "" + err})
      }

      /* ============= 투표 애플리케이션 생성 위한 변수 지정 시작 ============= */
      let creatorAddrInfo;
      let sender;
      let sk;

      // 스마트 컨트랙트 저장 변수
      const localInts = 0;
      // key: app_id, val: up or down(업보팅 or 다운보팅)
      const localBytes = 0;
      /* 2개는 셋업변수(EndTime, type) + 2개는 선택변수(업보팅, 다운보팅)
      const globalInts = 4; */
      // 1개는 셋업변수(EndTime, type) + 2개는 선택변수(업보팅, 다운보팅)
      const globalInts = 3; 
      // 생성자(dev) 계정 주소, 글작성자 계정 주소 저장
      const globalBytes = 2;
    
      // 스마트 컨트랙트로 넘기는 argument배열
      let appArgs = [];

      let onComplete;
      let params;
      
      try{
        creatorAddrInfo = algosdk.mnemonicToSecretKey(mnemonic);
        sender = creatorAddrInfo.addr;
        sk = creatorAddrInfo.sk;
        
        // app_arg로 종료시간, 글타입, 글작성자 전송
        console.log(appArgs.push(
          new Uint8Array(Buffer.from(type)),
          new Uint8Array(Buffer.from(writer_addr)),
          ))

        // onComplete지정 => NoOpOC
        onComplete = algosdk.OnApplicationComplete.NoOpOC;

        // 트랜잭션 기본 파라미터 지정
        params = await client.getTransactionParams().do()
        params.fee = 1000;
        params.flatFee = true;
        
        console.log("suggestedparams" + params)
      } catch(err){
        return resolve({"code" : 500, "msg" : "투표 애플리케이션 생성 위한 변수 생성 실패", "error" : "" + err});
      }   

      /* ============= 투표애플리케이션 생성 트랜잭션 호출 시작 ============= */ 
      try{
        // 애플리케이션 생성 tx 호출
        let txn = algosdk.makeApplicationCreateTxn(sender, params, onComplete, approval_program, clear_program, 
                                                  localInts, localBytes, globalInts, globalBytes, appArgs);
        // 트랜잭션 아이디
        let txId = txn.txID().toString();

        // 트랜잭션에 서명(생성자 sk로!!)
        let signedTxn = txn.signTxn(sk);
        console.log("Signed transaction with txID: %s", txId);
        
        // 트랜잭션 전송
        await client.sendRawTransaction(signedTxn).do()      

        // 트랜잭션 컨펌을 기다린다.
        let confirmedTxn = await algosdk.waitForConfirmation(client, txId, 4);
        console.log("confirmed" + confirmedTxn)

        //Get the completed Transaction
        console.log("Transaction " + txId + " confirmed in round " + confirmedTxn["confirmed-round"]);

        // display results
        let transactionResponse = await client.pendingTransactionInformation(txId).do()
        let appId = transactionResponse['application-index'];
        console.log("Created new app-id: ",appId);

        return resolve({"code" : 200, "msg" : "투표에플리케이션 생성 성공", "appId" : appId})
      }catch(err){
        console.log(err);
        return resolve({"code" : 500, "msg" : "투표에플리케이션 트랜잭션 호출 실패", "error" : "" + err})
      }
    });
}

// 플라스크에 투표 스마트컨트랙트 배포 요청
async function requestCreateVoteApp(){
  return axios.post('http://127.0.0.1:5000/createVoteApp',null, null)  
  .then(function (response) {
      return response.data;
  })
  .catch(function (err) {
      console.log(err)
      return {"code" : 500, "msg" : "투표 스마트 컨트랙트 배포 실패", "error" : "" + err};
  });
}










async function requestCallApp(mnemonic, addr, appId, methodName) {
  //algod 노드 접근 토큰
  let nodeToken = configJson.SmartContractParams.token; 

  //algod 노드 ip 주소
  let ipAddress = configJson.SmartContractParams.ip_address;
  
  //algod 노드 포트 
  let port = configJson.SmartContractParams.port;
      
  return axios.post('http://127.0.0.1:5000/callApp',null,{params: {
      mnemonic: mnemonic,
      addr: addr,
      app_id: appId,
      method_name: methodName,
      token: nodeToken,
      ip_address: ipAddress+':'+port
      }})  
      .then(function (response) {
          return response.data;
      })
      .catch(function (error) {
          console.log(error)
          return error;
      });
}

async function requestCreateApp(mnemonic){
  //algod 노드 접근 토큰
  let nodeToken = configJson.SmartContractParams.token; 

  //algod 노드 ip 주소
  let ipAddress = configJson.SmartContractParams.ip_address;
  
  //algod 노드 포트 
  let port = configJson.SmartContractParams.port;

  return axios.post('http://127.0.0.1:5000/createApp',null,{params: {
      creator_mnemonic: mnemonic,
      token: nodeToken,
      ip_address: ipAddress+':'+port
  }})  
  .then(function (response) {
      
      return response.data;
  })
  .catch(function (error) {
      console.log(error)
      return error;
  });
}

// tealfile 컴파일
const compileProgram = async (client, programSource) => {
  let encoder = new TextEncoder();
  let programBytes = encoder.encode(programSource);
  let compileResponse = await client.compile(programBytes).do();
  let compiledBytes = new Uint8Array(Buffer.from(compileResponse.result, "base64"));
  // console.log(compileResponse)
  return compiledBytes;
}



// Rounds
const waitForRound = async (round) => {
let last_round = await client.status().do()
let lastRound = last_round['last-round']

console.log("Waiting for round " + lastRound)

while (lastRound < round) {
  lastRound +=1
  const block =  await client.statusAfterBlock(lastRound).do()
  console.log("Round " + block['last-round'])
}
}

// convert 64 bit integer i to byte string
const intToBytes = (integer) => {
return integer.toString()
}

module.exports = {createVoteApp, requestCreateApp, requestCallApp, requestCreateVoteApp}

