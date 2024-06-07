// 쿼리 핸들러
const voteSqlHandeler = require("./voteSqlHandeler");
const forecastSqllHandeler = require("../forecast/forecastSqlHandeler");

// 해시맵
const HashMap  = require ('hashmap') ;

// 블록체인 관련 기능
const blockchain = require('../smartcontract/blockchain');

// 게시글 리스트안의 app_id에 해당하는 투표수 조회
const selectVoteInfoFromPostList = function (postList) {
    return new Promise(async(resolve, reject)=>{
        try{
            // 각 app_id의 투표수 구하기
            for(let i = 0; i < postList.length; i++) {
                // app_id
                const app_id = postList[i]["app_id"];

                // smartContract정보 조회
                let appInfo;
            try{
               appInfo = await blockchain.readGlobalState(app_id);
            } catch(err) {
                console.log(err)
                return {"code": 500, "msg":"readGlobalState에서 에러 발생", "error" : "" + err}
            }

                postList[i]["up_voting"] = (Number(appInfo.get("up")))
                postList[i]["down_voting"] = (Number(appInfo.get("down")))

            }

            return resolve({"code": 200, "msg": "투표정보 조회 성공", "post_list" : postList})
        } catch(err) {
            console.log(err)
            return resolve({"code": 500, "msg": "투표정보 조회 실패", "error" : "" + err})
        }
    });
}

// 투표자 정보 조회
const selectVoterList = function (dataMap) {
    return new Promise(async(resolve, reject)=>{
        try{
            const limitYn = dataMap.get("limit_yn");
            let datas
            const appId = Number(dataMap.get("app_id"));

            if(limitYn == 'y' ) {
                datas = [appId, 0, global.pagingNo]
            } else {
                datas = [appId]
            }
        
            // db에서 조회
            let selectVoterListResult;
    
            selectVoterListResult = await voteSqlHandeler.selectVoterList(datas);
            return resolve({"code": 200, "msg": "투표자 정보 조회 성공", "voter_list" : selectVoterListResult.voter_list})
        } catch(err){
            console.log(err);
            return resolve({"code": 500, "msg" : "selectVoterList 에러 발생", "error": "" + err});
        }
    });
}

// 특정 사용자가 특정 app에 투표했는지 여부 확인
const selectIsVoting = function (dataMap) {
    return new Promise(async(resolve, reject)=>{
        try{            
            let datas = [Number(dataMap.get("app_id")), dataMap.get("user_addr")]
        
            // db에서 조회
            let selectIsVotingResult;
    
            selectIsVotingResult = await voteSqlHandeler.selectIsVoting(datas);
            return resolve({"code": 200, "msg": "투표 여부 조회 성공", "is_voting" : selectIsVotingResult.is_voting})
        } catch(err){
            console.log(err);
            return resolve({"code": 500, "msg" : "selectIsVoting 에러 발생", "error": "" + err});
        }
    });
}


// 종목별, 시가/종가 별 투표 가장 많이 받은 app정보를 저장하는 배열
let stockInfoArr = [];

// 종목별, 시가/종가 별 투표 가장 많이 받은 app정보 반환
const selectMostVotedAppInfoList = function (today, type) {
    return new Promise(async(resolve, reject)=>{
        try{
            // db에서 예측일자가 오늘인 예측글 종목 조회
            const datas = [today, type];

            let selectForecastPostInfoResult = await forecastSqllHandeler.selectForecastPostInfoByDateAndStockCode(datas);
            if(selectForecastPostInfoResult.code == 500 ) {
                console.log(selectForecastPostInfoResult)
                return resolve(selectForecastPostInfoResult)
            }

            // 에측글 리스트
            const forecastPostList = selectForecastPostInfoResult.forecast_post_list;

            console.log(forecastPostList);

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
                    console.log("app_id: " + app_id)
                    console.log(Number(appInfo.get("up")) - Number(appInfo.get("down")))
                }

                // hashmap1(key: 종목코드, hashmap2)인 해시맵 생성
                let hashMap1 = new HashMap();

                // hashmap2(value: key: app_id, val: [투표수, 작성자 주소])인 해시맵 생성
                let hashMap2 = new HashMap();

                // 0번째 먼저 저장, 이전 종목코드와 비교하기 위해선 0번째는 반드시 존재해야 함.
                hashMap2.set(forecastPostList[0]["app_id"], [forecastPostList[0]["vote"], forecastPostList[0]["writer_addr"], forecastPostList[0]["expectation_price"]]);

                let i = 1;

                // 예측글 리스트 수만큼 반복
                while(true){
                    // 하나만 존재한다면!
                    if(forecastPostList.length == 1){
                        hashMap1.set(forecastPostList[0]["stock_code"], hashMap2);
                        break;
                    }

                    // 이전 종목코드와 현재 종목코드 비교
                    if(forecastPostList[i-1]["stock_code"] == forecastPostList[i]["stock_code"]) {
                        hashMap2.set(forecastPostList[i]["app_id"], [forecastPostList[i]["vote"], forecastPostList[i]["writer_addr"], forecastPostList[i]["expectation_price"]]);
                        
                        // 마지막 요소라면 hashmap1에 저장
                        if(i == forecastPostList.length - 1){
                            hashMap1.set(forecastPostList[i]["stock_code"], hashMap2);
                        }
                    } else {
                    // 일치하지 않는다면
                        // 1) 이전에 생성된 hashmap2가 있다면 hashmap1에 저장
                        
                        if(hashMap2.size != 0) {
                            hashMap1.set(forecastPostList[i-1]["stock_code"], hashMap2);
                            console.log("11")
                            console.log(forecastPostList[i-1]["stock_code"])
                        }
                        // 2) 새로운 hashmap 생성
                        hashMap2 = new HashMap();
                        // 3) i+1새로운 해시맵에 저장
                        hashMap2.set(forecastPostList[i]["app_id"], [forecastPostList[i]["vote"], forecastPostList[i]["writer_addr"], forecastPostList[i]["expectation_price"]]);
                        
                        // 마지막 요소라면 hashmap1에 저장
                        if(i == forecastPostList.length - 1){
                            console.log(forecastPostList[i]["stock_code"])
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
                
                // hashmap1의 갯수만큼(종목코드 수만큼) 반복
                for(let j = 0; j < hashMap1Keys.length; j++ ) {
                    // 종목 코드
                    const stockCode = hashMap1Keys[j];

                    // 종목코드별 저장된 hashMap2 가져오기
                    const hashMap2 = hashMap1.get(stockCode);

                    // hashMap2의 키(app_id) 배열
                    const hashMap2Keys = hashMap2.keys();

                    console.log("hashMap2Keys.length");
                    console.log(hashMap2Keys.length);
                    
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
                    const price = hashMap2.get(hashMap2Keys[winnerIdx])[2];

                    stockInfoArr.push({"stockCode": stockCode, "appId" : appId, "price": price})
                }                   
            }

            return resolve({"code": 200, "msg":"종목별 투표수 가장 많이 획득한 주식 정보 반환", "stock_info_arr" : stockInfoArr})
        } catch(err){
            console.log(err)
            return resolve({"code": 500, "msg":"selectMostVotedAppInfoList 에러 발생", "error" : "" + err})
        }
        
    });
}


module.exports = { 
    selectVoteInfoFromPostList,
    selectVoterList,
    selectMostVotedAppInfoList,
    selectIsVoting
};