// 파일 읽어오기 위한 객체
const fs = require('fs'); 
const path = require("path");

// 쿼리 핸들러
const forecastSqllHandeler = require("./forecastSqlHandeler");
const voteSqllHandeler = require("../vote/voteSqlHandeler");

// 시간
const time = require("../util/time")

// 주식
const stock = require("../stock/stock")

// 해시맵
const HashMap  = require ('hashmap') ;

// 블록체인 관련 기능
const blockchain = require('../smartcontract/blockchain');

// 설정파일
const jsonFile = fs.readFileSync(path.resolve(__dirname, "../smartcontract/config.json"));
const configJson = JSON.parse(jsonFile);

// 주가예측 가격을 정확히 맞춘 사람에게 보상을 준다.
const rewardToForecastAnswerer = async function (today, type) {
    // db에서 예측일자가 오늘인 예측글들의 종목코드 리스트 가져오기
    const datas = [today];

    let selectStockCodeListResult = await forecastSqllHandeler.selectStockCodeListByDate(datas);

    if(selectStockCodeListResult.code == 500 ){
        console.log(selectStockCodeListResult)
        return selectStockCodeListResult;
    }

    // 종목코드 리스트
    const stockCodeList = selectStockCodeListResult.stock_code_list;

    console.log("stockCodeList")
    console.log(stockCodeList)

    // 오늘 작성된 글이 있다면
    if(stockCodeList !=  undefined){
        // 종목코드 배열로 만들기
        let stockArr = [];
        for(let i = 0; i< stockCodeList.length; i++) {
            stockArr.push(stockCodeList[i].stock_code)
        }

        // 가격을 담는 json객체
        let priceJson;

        const result = await stock.selectStockPrice(type, stockArr,today);

        if(result.code == 500){
            console.log(result)
            return result;
        }
        
        priceJson = result.price_dict;

        console.log("priceJson")
        console.log(priceJson)

        // 가격정보가 존재한다면
        if(priceJson != undefined && priceJson != null) {
            // 종목별 시가정보 저장하는 hashmap0(key: 종목코드, val: 가격정보) 생성
            const hashmap0 = new HashMap();

            // 종목별 가격 정보 hashmap0에 저장
            for(let i = 0; i< stockCodeList.length; i++) {
                const stockCode = stockCodeList[i].stock_code;
                const price = priceJson[stockCode];

                hashmap0.set(stockCode, price);
            }

            // db에서 예측일자가 오늘인 예측글 종목 조회
            let selectForecastPostInfoResult;
            try{
                const datas = [today, type];

                selectForecastPostInfoResult = await forecastSqllHandeler.selectForecastPostInfoByDateAndStockCode(datas);
                
                if(selectForecastPostInfoResult.code == 500){
                    console.log(selectForecastPostInfoResult);
                    return selectForecastPostInfoResult;
                }

                console.log("selectForecastPostInfoResult")
                console.log(selectForecastPostInfoResult)
            } catch(err){
                console.log(err)
            }

            // 에측글 리스트
            const forecastPostList = selectForecastPostInfoResult.forecast_post_list;

            console.log("forecastPostList")
            console.log(forecastPostList)

            if(forecastPostList != undefined && forecastPostList != null) {
                // hashmap1(key: 종목코드, hashmap2(value: app_id:, val: 가격))인 해시맵 생성
                let hashMap1 = new HashMap();

                // hashmap2(value: key: app_id, val: [예측가격, 작성자 주소])인 해시맵 생성
                let hashMap2 = new HashMap();
                // 0번째 먼저 저장, 이전 종목코드와 비교하기 위해선 0번째는 반드시 존재해야 함.
                hashMap2.set(forecastPostList[0]["app_id"], [forecastPostList[0]["expectation_price"], forecastPostList[0]["writer_addr"]]);

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
                        hashMap2.set(forecastPostList[i]["app_id"], [forecastPostList[i]["expectation_price"], forecastPostList[i]["writer_addr"]]);
                        
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
                        hashMap2.set(forecastPostList[i]["app_id"], [forecastPostList[i]["expectation_price"], forecastPostList[i]["writer_addr"]]);
                        
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

                    // 종목코드 이용해서 hashmap0에서 가격 가져오기
                    const stockPrice = hashmap0.get(stockCode);

                    // 종목코드별 저장된 hashMap2(key: app_id, val: price 가져오기)
                    const hashMap2 = hashMap1.get(stockCode);

                    // hashMap1의 키(종목코드) 배열
                    const hashMap2Keys = hashMap2.keys();
                    
                    //hashmap2의 갯수만큼 반복
                    for(let k = 0; k < hashMap2Keys.length; k++ ) {
                        // 가져온 가격과 hashmap2의 예측가격이 일치하는지확인
                        if(hashMap2.get(hashMap2Keys[k])[0] == stockPrice) {
                            const mnemonic = configJson.SmartContractParams.dev_mnemonic

                            // 보상금액(5 piggle)
                            const amount = Number(100);
                            
                            // 글작성자 계정 주소
                            const writer_addr = hashMap2.get(hashMap2Keys[k])[1];

                            // asset_id
                            const assetId = Number(configJson.SmartContractParams.token_id);

                            // 일치하면 해당글 작성자에게 보상토큰 전달(transferToken)
                            let result = await blockchain.transferToken(mnemonic, writer_addr, assetId, amount)

                            // 글작성자에게 보상토큰을 전달했다면 
                            if(result.code == 200){
                                // voter_list테이블에서 app_id가 key와 일치하고 업보팅한 모든 투표자 계정주소 조회(row가 반환됨)
                                let selectVoterListResult;
                                try{
                                    // app_id
                                    const datas = [hashMap2Keys[k]];

                                    selectVoterListResult = await voteSqllHandeler.selectVoterList(datas);

                                    if(selectVoterListResult.code == 500){
                                        console.log(selectVoterListResult);
                                        return selectVoterListResult;
                                    }
                                    
                                    // 투표자정보를 저장하는 객체
                                    let voterInfoList = selectVoterListResult.voter_list;

                                    if(voterInfoList != undefined) {
                                        // 계정주소를 저장하는 배열 생성
                                        let voterArr = [];
                                        
                                        // rows수만큼 반복
                                        for(let i = 0; i < voterInfoList.length; i++) {
                                            //배열에 각 투표자의 계정주소를 넣는다.
                                            voterArr.push(voterInfoList[i]["voter_address"])
                                        }

                                        const amountToVoters = 20;

                                        // 해당 투표자들에게 토큰 전송(transferTokenToAddrs) - 입력: 리스트, 보상금액
                                        const resultTransferTokenToAddrs = await blockchain.transferTokenToAddrs(mnemonic, voterArr, assetId, amountToVoters, null)
                                        if(resultTransferTokenToAddrs.code == 500){
                                            return resultTransferTokenToAddrs
                                        }
                                        console.log(resultTransferTokenToAddrs)
                                        console.log("성공")
                                    }
                                } catch(err){
                                    console.log(err)
                                }
                            } else {
                                console.log(result);
                                return result;
                            }
                        }
                        console.log("끝")
                    }
                }    
            }               
        }
    }
};

module.exports = { 
    rewardToForecastAnswerer
};
