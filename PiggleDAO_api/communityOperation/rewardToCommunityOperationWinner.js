// 파일 읽어오기 위한 객체
const fs = require('fs'); 
const path = require("path");

// 쿼리 핸들러
const communityOperationSqlHandeler = require("./communityOperationSqlHandeler");
const userInfoSqlHandeler = require("../userInfo/userInfoSqlHandeler");

// 해시맵
const HashMap  = require ('hashmap') ;

// 블록체인 관련 기능
const blockchain = require('../smartcontract/blockchain');

// 설정파일
const jsonFile = fs.readFileSync(path.resolve(__dirname, "../smartcontract/config.json"));
const configJson = JSON.parse(jsonFile);

// 업보팅-다운보팅 수가 DAO 전체참여자의 60%이상을 넘었다면 보상 지급 
const rewardToOperationWinner = async function (yesterday) {
    // db에서 전날 종료된 운영글 목록 조회
    const datas = [yesterday];

    let selectCommunityOperationPostInfoResult = await communityOperationSqlHandeler.selectCommunityOperationPostListByDate(datas);

    if(selectCommunityOperationPostInfoResult.code == 500 ){
        console.log(selectCommunityOperationPostInfoResult)
        return selectCommunityOperationPostInfoResult;
    }

    // 운영글 리스트
    const communityOperationPostList = selectCommunityOperationPostInfoResult.community_operation_post_list;

    console.log("communityOperationPostList")
    console.log(communityOperationPostList)


    // 어제날짜에 종료된 운영글이 있다면
    if(communityOperationPostList != undefined) {
        // hashMap(value: key: app_id, val: [투표수, 작성자 주소])인 해시맵 생성
        let hashMap = new HashMap();

        // 각 app_id의 투표수(업보팅 - 다운보팅) 구하기
        for(let i = 0; i < communityOperationPostList.length; i++) {
            // app_id
            const app_id = communityOperationPostList[i]["app_id"];

            // smartContract정보 조회
            let appInfo;
            try{
               appInfo = await blockchain.readGlobalState(app_id);
            } catch(err) {
                console.log(err)
                return {"code": 500, "msg":"readGlobalState에서 에러 발생", "error" : "" + err}
            }
            
            console.log(i + "번쨰: " + (Number(appInfo.get("up")) - Number(appInfo.get("down"))));

            communityOperationPostList[i]["vote"] = (Number(appInfo.get("up")) - Number(appInfo.get("down")))

            // 해시맵에 app_id, [투표수, 작성자 계정주소]를 넣어준다.
            hashMap.set(communityOperationPostList[i]["app_id"], [communityOperationPostList[i]["vote"], communityOperationPostList[i]["writer_addr"]]);
        }
        
        // hashMap의 키(app_id) 배열
        const hashMapKeys = hashMap.keys();

        // 정족수 계산
        const countInfo = await userInfoSqlHandeler.selectCount();

        if(countInfo.code == 500 ){
            console.log(countInfo)
            return countInfo;
        }

        // DAO에 가입한총인원 수
        const count = countInfo.count;

        // 정족수
        const quorum = Math.ceil(count * 0.6);

        // 보상을 받을 계정주소를 저장하는 배열 생성
        let rewarderArr = [];

        for(let k = 0; k < hashMapKeys.length; k++ ) {
            console.log(hashMap.get(hashMapKeys[k])[1] + ": " + hashMap.get(hashMapKeys[k])[0]);
            // 투표수가 정족수 넘었는지 확인하기
            if(hashMap.get(hashMapKeys[k])[0] >= quorum){
                // 넘었다면 rewarderArr 배열에 계정주소 넣기
                rewarderArr.push(hashMap.get(hashMapKeys[k])[1]);
            }
        }

        console.log(rewarderArr);

        // 보상 지급
        if(rewarderArr.length > 0){
            const amountToRewarder = 20; // 변경하기
            const mnemonic = configJson.SmartContractParams.dev_mnemonic
            
            // asset_id
            const assetId = Number(configJson.SmartContractParams.token_id);

            // 해당 투표자들에게 토큰 전송(transferTokenToAddrs) - 입력: 리스트, 보상금액
            const resultTransferTokenToAddrs = await blockchain.transferTokenToAddrs(mnemonic, rewarderArr, assetId, amountToRewarder, null)
            if(resultTransferTokenToAddrs.code == 500){
                console.log(resultTransferTokenToAddrs)
                return resultTransferTokenToAddrs
            }

            console.log(resultTransferTokenToAddrs)
            console.log("성공")
        }
    }
};

module.exports = { 
    rewardToOperationWinner
};
