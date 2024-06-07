// express.Router를 사용하기 위해 express exports를 가져옴!
const express = require("express");
const fs = require('fs'); 
const path = require("path");
const blockchain = require('./blockchain');

var ipfsAPI = require('ipfs-api')
 
const converter = require('xml-js');

// connect to ipfs daemon API server
var ipfs = ipfsAPI('localhost', '5001', {protocol: 'http'}) // leaving out the arguments will default to these values
const jsonFile = fs.readFileSync(path.resolve(__dirname, "./config.json"));

const ipfsUtil = require('../util/ipfs')

// query 파일
const smartcontractSql = fs.readFileSync(__dirname + '/smartcontractSql.xml');
const stakingSql = fs.readFileSync(path.resolve(__dirname, "../staking/stakingSql.xml"));

let smartcontractSqlToJson = JSON.parse(converter.xml2json(smartcontractSql, {compact: true, spaces: 4}));
let stakingSqlToJson = JSON.parse(converter.xml2json(stakingSql, {compact: true, spaces: 4}));

// 쿼리 핸들러
const smartcontractSqlHandeler = require("./smartcontractSqlHandeler");
const stakingSqlHandeler = require("../staking/stakingSqlHandeler");

// 시간
const time = require("../util/time")
// 주식
const stock = require("../stock/stock")
const configJson = JSON.parse(jsonFile);

// Router를 사용하기 위해 express.Router()호출
const router = express.Router();
const smartcontract = require("./smartcontract");

/*******************테스트 *******************/
const reward = require('../forecast/rewardToForecastAnswerer')
const rewardToWinner = require('../vote/rewardToForecastVoteWinner')
const rewardToOperationWinner = require('../communityOperation/rewardToCommunityOperationWinner')
const deleteApp = require('./deleteApp')
const staking = require('../staking/staking')
const rewardToRanker = require('../analysis/rewardToRanker')
/******************* 테스트 ********************/


router.use(express.urlencoded({ extended: false }));

// 외부에서 사용하기 위해 router를 넣어줌!
module.exports = router;

// 투표 스마트 컨트랙트 생성
router.post('/createVoteApp',async function(req,res){
    // 글 작성자 계정
    const writer_addr = req.body.writer_addr;

    // 작성 글종류(0: 주가예측글, 1: 운영글, 2: 분석글)
    const type = req.body.type;
    
    // 스마트 컨트랙트 생성 및 배포
    let result = await smartcontract.createVoteApp(writer_addr, type)

    // result는 어떤 값이 나오지?
    res.send(result);
});

// 투표
router.post('/vote',async function(req,res){
    // 투표자 계정
    const voter_addr = req.body.voter_addr;

    // app_id
    const index = Number(req.body.app_id);

    // 업보팅 or 다운보팅
    const upOrDown = req.body.up_or_down;

    // 글 타입
    const postType = req.body.post_type;

    // 투표 결과
    // 성공: {"code" : 200, "msg": "투표 성공", "txId" : txId}
    // 실패: {"code" : 500, "msg" : "투표 실패", "error" : "" + err}
    const result = await smartcontract.vote(voter_addr,  index, upOrDown, postType)

    res.send(result);
});

// 토큰 스테이킹
router.post('/stakingToken',async function(req,res){
    // 스테이커 니모닉
    const mnemonic = req.body.mnemonic;

    // 앱 id
    const app_id = Number(req.body.appId);

    // 스테이킹 양
    const amount = Number(req.body.amount);

    // 종료일(yyyynndd)
    const expDate = req.body.expDate;

    // type('0': 예측글, '1': 운영글, '2': 분석글)
    const type = req.body.type;
    
    // 스테이킹 계정 주소
    const staking_addr = configJson.SmartContractParams.staking_addr;

    // asset_id
    const assetId = Number(configJson.SmartContractParams.token_id);

    const result = await staking.stakingAmount(mnemonic, staking_addr, assetId, amount, app_id, expDate, type);
    res.send(result);
});
























// 스테이킹풀 생성
router.post('/createStakingPool',async function(req,res){
    // 개발사 니모닉
    const mnemonic = configJson.SmartContractParams.dev_mnemonic;

    // 개발사 계정
    const creator_addr = configJson.SmartContractParams.dev_address;

    // 스테이킹할 토큰 아이디
    const asset_id = configJson.SmartContractParams.token_id;

    // 스테이킹풀 생성 결과
    let result = await smartcontract.createStakingPool(mnemonic, creator_addr, asset_id)

    res.send(result);
});

// 스테이킹풀 초기화
router.post('/initPool',async function(req,res){
    // 개발사 니모닉
    const mnemonic = configJson.SmartContractParams.dev_mnemonic;

    console.log(mnemonic);
    
    // 개발사 계정
    const creator_addr = configJson.SmartContractParams.dev_address;

    // 스테이킹할 토큰 아이디
    const app_id = req.body.app_id;

    // 스테이킹풀 생성 결과
    let result = await smartcontract.initPool(mnemonic, creator_addr, app_id)

    res.send(result);
});

// 토큰 스테이킹
router.post('/deposit',async function(req,res){
    // 작성자 니모닉
    const mnemonic = req.body.mnemonic;

    // 토큰 id
    const app_id = Number(req.body.app_id);

    // 스테이킹 양
    const amount = Number(req.body.amount);

    // 토큰 스테이킹 결과
    let result = await smartcontract.deposit(mnemonic, staker_addr, app_id, amount)

    res.send(result);
});

// 스테이킹한 토큰 계정에게 전송
router.post('/withdraw',async function(req,res){
    // 개발사 니모닉
    const devmnemonic = req.body.dev_mnemonic;

    // asset_id
    const app_id = Number(req.body.app_id);

    // staker_addr
    const staker_addr = req.body.staker_addr;

    // amount
    const amount = Number(req.body.amount);

    // 스테이킹한 토큰 계정에게 전송 결과
    let result = await smartcontract.withdraw(devmnemonic, app_id, staker_addr, amount)

    res.send(result);
});


// 애플리케이션 글로벌스테이트 조회
router.get('/readGlobalState', async function(req,res){  
    // 사용자 블록체인 정보 조회
    const appInfo = await blockchain.readGlobalState(req.query.app_id);
    
    res.send(appInfo);
});

// 스마트 컨트랙트 삭제
router.post('/deleteApp',async function(req,res){
    // app_id arr
    const indexArr = req.body["appId[]"];

    let result = await smartcontract.deleteApp(indexArr)

    res.send(result);
});






















// 스마트 컨트랙트 clear-state
router.post('/clearState',async function(req,res){
    // 옵트인한 사용자 니모닉
    const mnemonic = req.body.mnemonic;

    // app_id
    const index = Number(req.body.appId);

    let result = await smartcontract.clearState(mnemonic, index)

    res.send(result);
});

// 스마트 컨트랙트 생성
router.post('/createApp',async function(req,res){
    // app생성자 니모닉
    const mnemonic = req.body.mnemonic;

    let result = await smartcontract.createApp(mnemonic)

    res.send(result);
});

// 스마트 컨트랙트 호출 
router.post('/callAppMethodCall',async function(req,res){
    const mnemonic = req.body.mnemonic;
    const addr = req.body.addr;
    const appId = req.body.appId;
    const methodName = req.body.methodName;

    const result = await smartcontract.callApp(mnemonic, addr, appId, methodName);

    res.send(result);
});

// ipfs 테스트
router.get('/ipfsTest',async function(req,res){
    try{
        const data = "<html>테스트 데이터!!!</html>"
        const result = await ipfsUtil.uploadFileToIpfs(data);
        res.send(result);

    } catch(err) {
        res.send(err)
    }

    /*try{
        let testFile = fs.readFileSync(`${__dirname}/ipfs_upload_testfile.txt`)

        //input buffer
        let testBuffer = Buffer.from(testFile); //new Buffer -> Buffer.from

        //upload file to ipfs
        ipfs.files.add(testBuffer, (err,file)=>{
            if(err) {
                console.log(err);
            }   
            console.log(file)
        })

        res.send("success");
    } catch(err){
        console.log(err);
        res.send("1");
    }*/
});

// ipfs 테스트
router.get('/ipfsGetTest',async function(req,res){
    const cid = 'QmUDy4GQrdZYEEi7J6AxULbvaoFgx3BHa2xsoGnWnJKXLZ';

    try{
        const result = await ipfsUtil.downloadFileFromIpfs(cid);
        res.send(result);

    } catch(err) {
        res.send(err)
    }
    /*
    //testfile cid path
    const testFilePath = 'QmUDy4GQrdZYEEi7J6AxULbvaoFgx3BHa2xsoGnWnJKXLZ';

    let downloadFile;

    ipfs.files.get(testFilePath, (err,files)=>{
        files.forEach((file) =>{
        console.log(file.path);
        
        // buffer가 들어있음.
        downloadFile = file.content;

        //download file save
        
        fs.writeFileSync('test2.jpg', downloadFile, (err)=>{
            if(err) {
                console.log(err);
            }       
            console.log('write end');
        })
        

        console.log("type: " + typeof(downloadFile))

        res.send("success");


        })
    })  */
});

// 주식 가격 조회 테스트
router.get('/getStockPrice',async function(req,res){
    // 주식종목코드 리스트
    const arr = ['005930', '000660'];

    try{
        const result = await stock.selectStockPrice('Open', arr,'2022-11-06');
        console.log(result.code)
        res.send(result);
    } catch(err){
        console.log(err)
        res.send(err);
    }

});

// 
router.get('/rewardTest',async function(req,res){
    // 오늘날짜 yyyy-mm-dd 형태로 출력
    const today = time.getToday();
    const type = "Close"

    reward.rewardToForecastAnswerer(today, type);
});

// 주가예측글 투표 가장 많이 받은 사람에게 보상지급
router.get('/rewardToWinnerTest',async function(req,res){
    // 오늘날짜 yyyy-mm-dd 형태로 출력
    const today = time.getToday();
    const type = "Close"

    rewardToWinner.rewardToVoteWinner(today, type);
});

// 운영글 작성자중 임계점을 넘은 투표수를 받은 사람에게 보상 지급
router.get('/rewardToOperationWinnerTest',async function(req,res){
    // 어제날짜 yyyy-mm-dd 형태로 출력
    //const yesterday = time.getYesterday();
    const yesterday = '2022-11-18';

    rewardToOperationWinner.rewardToOperationWinner(yesterday);
});

// 랭킹 정하고 랭커들에게 보상 전달
router.get('/rewardToRankerTest',async function(req,res){
    // 종료일 yyyy-mm-dd 형태로 출력
    //const endDate = time.getYesterday();
    const endDate = '2022-11-17';

    rewardToRanker.rewardToRanker(endDate);
});

// 종료된 애플리케이션 삭제
router.get('/deleteAppTest',async function(req,res){
    // 어제날짜 yyyy-mm-dd 형태로 출력
    const yesterday = time.getYesterday();

    // 오늘 요일구하기(요일에 따라 종료할 app의 종류가 달라짐)
    const today = time.getToday();
    const dayOfWeek = time.getDayOfWeek(today)

    await deleteApp.deleteApp(yesterday, dayOfWeek);
});

// 스테이킹한 금액 반환
router.get('/refundStakingAmountTest',async function(req,res){
    // 어제날짜 yyyy-mm-dd 형태로 출력
    //const yesterday = time.getYesterday();
    const yesterday = '2022-11-18';

    await staking.refundStakingAmount(yesterday);
});

// is_voting_yn을 'n'으로 변경
router.get('/changeVotingYnToN',async function(req,res){
    // 오늘날짜 yyyy-mm-dd 형태로 출력
    const today = '2022-11-17';
    // '0': 주가 예측글, '1': 운영글, '2': 분석글;

    await deleteApp.changeVotingYnToN(today, '2', null);
});

// 토큰 전송
router.post('/transferToken',async function(req,res){   
    const senderMnemonic = req.body.sender_mnemonic;
    const receiverAddr = req.body.receiver_addr;
    const tokenId = req.body.token_id;
    const amount = Number(req.body.amount);

    const result = await blockchain.transferToken(senderMnemonic, receiverAddr, tokenId, amount);
    res.send(result);
});

// 토큰 전송
router.post('/transferNova',async function(req,res){   
    const addr = req.body.addr;
    const amount = Number(req.body.amount);


    const sendResult = await blockchain.sendToAddrByDevAddrWithAmount(addr, amount);    
    res.send(sendResult);
});

