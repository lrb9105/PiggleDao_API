// 파일 읽어오기 위한 객체
const fs = require('fs'); 
const path = require("path");
const algosdk = require('algosdk');

// 쿼리 핸들러
const stakingSqlHandeler = require("./stakingSqlHandeler");

// 블록체인 관련 기능
const blockchain = require('../smartcontract/blockchain');

// 설정파일
const jsonFile = fs.readFileSync(path.resolve(__dirname, "../smartcontract/config.json"));
const configJson = JSON.parse(jsonFile);

// 스테이킹한 금액을 돌려준다.
const refundStakingAmount = async function (yesterday) {
    // 스테이킹 종료일자가 전날인 모든 데이터 리스트 조회
    let selectStakingInfoResult;
    // 반환할 계정정보
    let refundAddrArr = [];

    // 반환한 금액정보
    let refundAmountArr = [];
    try{
        const datas = [yesterday];

        selectStakingInfoResult = await stakingSqlHandeler.selectStakingInfoListByDate(datas);

        if(selectStakingInfoResult.code == 500 ){
            console.log(selectStakingInfoResult)
            return selectStakingInfoResult;
        }

        console.log("selectStakingInfoResult")
        console.log(selectStakingInfoResult)
        

        // 스테이킹 정보 리스트
        const staking_info_list = selectStakingInfoResult.staking_info_list;

        // 반환할 스테이킹 정보가 있다면
        if(staking_info_list != undefined) {
            // 각 app_id의 투표수(업보팅 - 다운보팅) 구하기
            for(let i = 0; i < staking_info_list.length; i++) {
                // type
                const type = staking_info_list[i]["type"];
                const appId = staking_info_list[i]["app_id"];

                // 운영글이라면
                if(type == '1'){
                    // 스마트 컨트랙트 정보 조회
                    let appInfo;
                    try{
                        appInfo = await blockchain.readGlobalState(appId);
                    } catch(err) {
                        console.log(err)
                        return {"code": 500, "msg":"readGlobalState에서 에러 발생", "error" : "" + err}
                    }
                    
                    // 업보팅 * 5 < 다운보팅이라면(업보팅수보다 다운보팅수가 5배 많다면 유해한 글이라 판단) 스테이킹 금액 개발사 계정에게 반환
                    let upCount = Number(appInfo.get("up"));

                    let downCount = Number(appInfo.get("down"));

                    if(upCount * 5 < downCount) {
                        // refundAddrArr에 개발사 계정 넣기(토큰 회수를 위해!)
                        refundAddrArr.push(configJson.SmartContractParams.dev_addr)
                    }
                } else {
                    // 운영글이 아니라면
                    // refundAddrArr에 해당 계정 넣기
                    refundAddrArr.push(staking_info_list[i]["staker_addr"])
                }

                // refundAmountArr에 스테이킹 금액 넣기
                refundAmountArr.push(Number(staking_info_list[i]["staking_price"]))
            }                
        }
    } catch(err){
        console.log(err)
    }

    try{
        const mnemonic = configJson.SmartContractParams.staking_mnemonic;
        const assetId = configJson.SmartContractParams.token_id;
        const resultTransferTokenToAddrs = await blockchain.transferTokenToAddrs(mnemonic, refundAddrArr, assetId, null, refundAmountArr)
        console.log(resultTransferTokenToAddrs);

        // 스테이킹 금액 전달에 성공했다면 db에 있는 데이터 삭제
        if(resultTransferTokenToAddrs.code == 200) {
            const datas = [yesterday];

            const deleteStakingInfoResult = await stakingSqlHandeler.deleteStakingInfo(datas);
            console.log(deleteStakingInfoResult);
        } else {
            return resultTransferTokenToAddrs
        }
    } catch(err) {
        console.log(err);
    }

};

// 스테이킹을 한다.
const stakingAmount = async function (mnemonic, staking_addr, assetId, amount, app_id, expDate, type) {
    return new Promise(async(resolve, reject)=>{
        // 토큰 스테이킹
        try{
            // 스테이킹 계정에게 토큰 전송
            let result = await blockchain.transferToken(mnemonic, staking_addr, assetId, amount)

            // 토큰 전송 완료 시 db에 스테이킹 정보 저장
            if(result.code == 200){
                let account = algosdk.mnemonicToSecretKey(mnemonic);

                // staking_info에 데이터 저장
                const datas = [app_id, expDate, amount, account.addr, type];
                
                const createStakingInfoResult = await stakingSqlHandeler.createStakingInfo(datas);
                
                return resolve(createStakingInfoResult);
            } else {
                return resolve(result);
            }
        } catch(err){
            return resolve({"code" : 500, "msg" : "stakingAmount 에러 발생", "error" : "" + err});
        }
    });
};

module.exports = { 
    refundStakingAmount,
    stakingAmount
};
