// 파일 읽어오기 위한 객체
const fs = require('fs'); 
const path = require("path");

// 쿼리 핸들러
const forecastSqllHandeler = require("../forecast/forecastSqlHandeler");
const voteSqllHandeler = require("./voteSqlHandeler");

// 해시맵
const HashMap  = require ('hashmap') ;

// 블록체인 관련 기능
const blockchain = require('../smartcontract/blockchain');

// 설정파일
const jsonFile = fs.readFileSync(path.resolve(__dirname, "../smartcontract/config.json"));
const configJson = JSON.parse(jsonFile);

// 주가예측 가격을 예측한 작성자중 투표수를 가장 많이 받은 사람에게 보상을 준다.
const rewardToVoteWinner = async function (today, type) {
    // db에서 예측일자가 오늘인 예측글 종목 조회
    const datas = [today, type];

    let selectForecastPostInfoResult = await forecastSqllHandeler.selectForecastPostInfoByDateAndStockCode(datas);
    
    if(selectForecastPostInfoResult.code == 500 ){
        console.log(selectForecastPostInfoResult);
        return selectForecastPostInfoResult;
    }

    // 에측글 리스트
    const forecastPostList = selectForecastPostInfoResult.forecast_post_list;

    console.log("forecastPostList")
    console.log(forecastPostList)


    // 오늘날짜에 작성된 예측글이 있다면
    if(forecastPostList != undefined) {
        // 각 app_id의 투표수(업보팅 - 다운보팅) 구하기
        for(let i = 0; i < forecastPostList.length; i++) {
            // app_id
            const app_id = forecastPostList[i]["app_id"];

            // smartContract정보 조회
            let appInfo;
            try{
               appInfo = await blockchain.readGlobalState(app_id);
            } catch(err) {
                console.log(err)
                return {"code": 500, "msg":"readGlobalState에서 에러 발생", "error" : "" + err}
            }
            forecastPostList[i]["vote"] = (Number(appInfo.get("up")) - Number(appInfo.get("down")))
        }

        // hashmap1(key: 종목코드, hashmap2)인 해시맵 생성
        let hashMap1 = new HashMap();

        // hashmap2(value: key: app_id, val: [투표수, 작성자 주소])인 해시맵 생성
        let hashMap2 = new HashMap();

        // 0번째 먼저 저장, 이전 종목코드와 비교하기 위해선 0번째는 반드시 존재해야 함.
        hashMap2.set(forecastPostList[0]["app_id"], [forecastPostList[0]["vote"], forecastPostList[0]["writer_addr"]]);

        let i = 1;

        // 예측글 리스트 수만큼 반복
        while(true){
            if(forecastPostList.length == 1) {
                hashMap1.set(forecastPostList[0]["stock_code"], hashMap2);
                break;
            }
            // 이전 종목코드와 현재 종목코드 비교
            if(forecastPostList[i-1]["stock_code"] == forecastPostList[i]["stock_code"]) {
                hashMap2.set(forecastPostList[i]["app_id"], [forecastPostList[i]["vote"], forecastPostList[i]["writer_addr"]]);
                
                // 마지막 요소라면 hashmap1에 저장
                if(i == forecastPostList.length - 1){
                    hashMap1.set(forecastPostList[i]["stock_code"], hashMap2);
                }
            } else {
            // 일치하지 않는다면
                // 1) 이전에 생성된 hashmap2가 있다면 hashmap1에 저장
                if(hashMap2.size != 0) {
                    hashMap1.set(forecastPostList[i-1]["stock_code"], hashMap2);
                }
                // 2) 새로운 hashmap 생성
                hashMap2 = new HashMap();
                // 3) i+1새로운 해시맵에 저장
                hashMap2.set(forecastPostList[i]["app_id"], [forecastPostList[i]["vote"], forecastPostList[i]["writer_addr"]]);
                
                // 마지막 요소라면 hashmap1에 저장
                if(i == forecastPostList.length - 1){
                    hashMap1.set(forecastPostList[i]["stock_code"], hashMap2);
                }
            }

            i++;

            // 모든 요소를 다 검사 했다면 while문 빠져나가기
            if(i == forecastPostList.length){
                break;
            }
        }

        // hashMap1의 키(종목코드) 배열
        const hashMap1Keys = hashMap1.keys();
        
        // hashmap1의 갯수만큼 반복
        for(let j = 0; j < hashMap1Keys.length; j++ ) {
            // 종목 코드
            const stockCode = hashMap1Keys[j];

            // 종목코드별 저장된 hashMap2 가져오기
            const hashMap2 = hashMap1.get(stockCode);

            // hashMap2의 키(app_id) 배열
            const hashMap2Keys = hashMap2.keys();
            
            //hashmap2의 갯수만큼 반복
            let winnerIdx = 0;

            // 투표수
            let voteVal = hashMap2.get(hashMap2Keys[0])[0];

            for(let k = 1; k < hashMap2Keys.length; k++ ) {
                // 투표수를 가장 많이 획득한 app_id 찾기
                if(voteVal < hashMap2.get(hashMap2Keys[k])[0]){
                   winnerIdx = k; 
                }
            }

            // 투표를 가장 많이 받은 작성자 정보
            const appId = hashMap2Keys[winnerIdx];
            const addr = hashMap2.get(hashMap2Keys[winnerIdx])[1];

            const mnemonic = configJson.SmartContractParams.dev_mnemonic

            // 보상금액(10 piggle)
            const amount = Number(100);
            
            // 글작성자 계정 주소
            const writer_addr = addr;

            // asset_id
            const assetId = Number(configJson.SmartContractParams.token_id);

            // 일치하면 해당글 작성자에게 보상토큰 전달(transferToken)
            let result = await blockchain.transferToken(mnemonic, writer_addr, assetId, amount)
            
            console.log(result);

            // 글작성자에게 보상토큰을 전달했다면 
            if(result.code == 200){
                // voter_list테이블에서 app_id가 key와 일치하고 업보팅한 모든 투표자 계정주소 조회(row가 반환됨)
                let selectVoterListResult;
                try{
                    // app_id
                    const datas = [appId];

                    console.log("appId")
                    console.log(appId)

                    selectVoterListResult = await voteSqllHandeler.selectVoterList(datas);

                    if(selectVoterListResult.code == 500) {
                        console.log(selectVoterListResult);
                        return selectVoterListResult;
                    }
                    
                    // 투표자정보를 저장하는 객체
                    let voterInfoList = selectVoterListResult.voter_list;

                    console.log(voterInfoList);

                    if(voterInfoList != undefined) {
                        // 계정주소를 저장하는 배열 생성
                        let voterArr = [];
                        
                        // rows수만큼 반복
                        for(let i = 0; i < voterInfoList.length; i++) {
                            //배열에 각 투표자의 계정주소를 넣는다.
                            voterArr.push(voterInfoList[i]["voter_address"])
                        }

                        const amountToVoters = 20;

                        console.log("voterArr")
                        console.log(voterArr)

                        // 해당 투표자들에게 토큰 전송(transferTokenToAddrs) - 입력: 리스트, 보상금액
                        const resultTransferTokenToAddrs = await blockchain.transferTokenToAddrs(mnemonic, voterArr, assetId, amountToVoters, null)

                        console.log(resultTransferTokenToAddrs)
                        console.log("성공")
                    }
                } catch(err){
                    console.log(err)
                }
            } else {
                console.log(result);
            }
        }                   
    }
};

module.exports = { 
    rewardToVoteWinner
};
