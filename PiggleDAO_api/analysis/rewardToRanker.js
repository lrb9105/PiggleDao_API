// 파일 읽어오기 위한 객체
const fs = require('fs'); 
const path = require("path");

// 쿼리 핸들러
const analysisSqlSqlHandeler = require("./analysisSqlHandeler");

// 해시맵
const HashMap  = require ('hashmap') ;

// 블록체인 관련 기능
const blockchain = require('../smartcontract/blockchain');

// 설정파일
const jsonFile = fs.readFileSync(path.resolve(__dirname, "../smartcontract/config.json"));
const configJson = JSON.parse(jsonFile);

// 종료일이 전날인 글의 투표수 랭킹을 매겨서 db에 저장 및 보상 지급
const rewardToRanker = async function (expDate) {
    // db에서 투표종료일이 전날인 목록 조회
    const datas = [expDate];

    let selectAnalysisPostInfoResult = await analysisSqlSqlHandeler.selectAnalysisPostListByDate(datas);
    if(selectAnalysisPostInfoResult.code == 500 ){
        console.log(selectAnalysisPostInfoResult)
        return selectAnalysisPostInfoResult;
    }

    // 지난 1주일간 작성된 분석글 리스트
    const analysisPostList = selectAnalysisPostInfoResult.analysis_post_list;

    // 1주일간 작성된 분석글이 있다면
    if(analysisPostList != undefined) {
        // hashMap(value: key: app_id, val: [투표수, 작성자 주소])인 해시맵 생성
        let hashMap = new HashMap();

        // 각 app_id의 투표수(업보팅 - 다운보팅) 구하기
        for(let i = 0; i < analysisPostList.length; i++) {
            // app_id
            const app_id = analysisPostList[i]["app_id"];

            // smartContract정보 조회
            let appInfo;
            try{
               appInfo = await blockchain.readGlobalState(app_id);
            } catch(err) {
                console.log(err)
                return {"code": 500, "msg":"readGlobalState에서 에러 발생", "error" : "" + err}
            }
            
            analysisPostList[i]["vote"] = (Number(appInfo.get("up")) - Number(appInfo.get("down")))
            
            console.log("app_id: " + app_id)
            console.log(Number(appInfo.get("up")) - Number(appInfo.get("down")))

            // hashmap에 데이터 저장
            hashMap.set(analysisPostList[i]["app_id"], [analysisPostList[i]["vote"], analysisPostList[i]["writer_addr"]]);
        }
        
        // hashMap의 키(app_id) 배열
        const hashMapKeys = hashMap.keys();

        // 해시맵에 있는 [투표수, 작성자계정주소, app_id]값을 배열로 옮긴다.
        let voteNumAddrArr = [];
        for(let i = 0; i < hashMapKeys.length ; i++ ) {
            // [투표수, 작성자계정주소] 저장
            let tempArr = hashMap.get(hashMapKeys[i]);
            // [app_id] 저장
            tempArr.push(hashMapKeys[i]);

            voteNumAddrArr.push(tempArr);
        }

        // 투표수가 높은 순서로 정렬한다.
        for(let i = voteNumAddrArr.length; i > 0 ; i-- ) {
            let noSwaps;
            
            noSwaps = true;
            for (let j = 0; j < i - 1; j++) {
                // 투표수값 비교
                if (voteNumAddrArr[j][0] < voteNumAddrArr[j+1][0]) {
                    let temp = voteNumAddrArr[j];
                    voteNumAddrArr[j] = voteNumAddrArr[j+1];
                    voteNumAddrArr[j+1] = temp;
                    noSwaps = false;
                }
            }
            if (noSwaps) break;
        }

        // 계정주소를 저장하는 배열 생성
        let rewarderArr = [];
        let rewardAmount = [];
        // 보상 10piggle,9piggle,8piggle,...1piggle(10명) => 테스트는 10,9,8,..로 진행
        let reward = 10

        // 상위 10명의 계정과 보상금액을 배열에 저장한다.
        for(let i = 0; i < voteNumAddrArr.length; i++) {
            rewarderArr[i] = voteNumAddrArr[i][1]
            rewardAmount[i] = reward
            reward--

            if(i + 1 == 10){
                break;
            }
        }

        // 보상 지급
        if(rewarderArr.length > 0){
            const mnemonic = configJson.SmartContractParams.dev_mnemonic
            
            // asset_id
            const assetId = Number(configJson.SmartContractParams.token_id);
            
            // 해당 투표자들에게 토큰 전송(transferTokenToAddrs) - 입력: 계정주소 배열, 보상금액 배열
            const resultTransferTokenToAddrs = await blockchain.transferTokenToAddrs(mnemonic, rewarderArr, assetId, null, rewardAmount)
            if(resultTransferTokenToAddrs.code == 500){
                console.log(resultTransferTokenToAddrs)
                return resultTransferTokenToAddrs
            }

            console.log(resultTransferTokenToAddrs)
            console.log("성공")
        }

        // 랭킹 db에 있는 직전 주 랭킹 데이터 삭제
        let deleteRankingResult = await analysisSqlSqlHandeler.deleteRanking();

        // 삭제가 완료됐다면 이번주 랭킹 데이터 저장
        if(deleteRankingResult.code == 200){
            let appIdArr = [];

            // 상위 10개의 app_id데이터 추출하기
            for(let i = 0; i < voteNumAddrArr.length; i++) {
                appIdArr[i] = [voteNumAddrArr[i][2]]
    
                if(i + 1 == 10){
                    break;
                }
            }

            // 랭킹데이터 db에 저장
            let createRankingResult;
            try{
                const datas = []
                for(let i = 0; i < voteNumAddrArr.length; i ++) {
                    const tempArr = [voteNumAddrArr[i][2], (i+1)];
                    datas.push(tempArr);
                }

                createRankingResult = await analysisSqlSqlHandeler.createRanking(datas);
                console.log("createRankingResult")
                console.log(createRankingResult)
            } catch(err){
                console.log(err)
            }
        } else {
            console.log(deleteRankingResult);
            return deleteRankingResult;
        }
    }
};

module.exports = { 
    rewardToRanker
};
