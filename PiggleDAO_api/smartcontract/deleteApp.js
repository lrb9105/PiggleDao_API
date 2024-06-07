// 파일 읽어오기 위한 객체
const fs = require('fs'); 
const path = require("path");

const converter = require('xml-js');

// query 파일
const analysisSql = fs.readFileSync(path.resolve(__dirname, "../analysis/analysisSql.xml"),'utf-8');
const forecastSql = fs.readFileSync(path.resolve(__dirname, "../forecast/forecastSql.xml"),'utf-8');
const communityOperationSql = fs.readFileSync(path.resolve(__dirname, "../communityOperation/communityOperationSql.xml"),'utf-8');

// xml to json
let analysisSqlToJson = JSON.parse(converter.xml2json(analysisSql, {compact: true, spaces: 4}));
let forecastSqlToJson = JSON.parse(converter.xml2json(forecastSql, {compact: true, spaces: 4}));
let communityOperationSqlToJson = JSON.parse(converter.xml2json(communityOperationSql, {compact: true, spaces: 4}));

// 쿼리 핸들러
const analysisSqlHandeler = require("../analysis/analysisSqlHandeler");
const forecastSqlHandeler = require("../forecast/forecastSqlHandeler");
const communityOperationSqlHandeler = require("../communityOperation/communityOperationSqlHandeler");

// 시간
const time = require("../util/time")

// 해시맵
const HashMap  = require ('hashmap') ;

// 스마트컨트랙트 관련 기능
const smartContract = require('../smartcontract/smartcontract');

// 설정파일
const jsonFile = fs.readFileSync(path.resolve(__dirname, "../smartcontract/config.json"));
const configJson = JSON.parse(jsonFile);


/* 종료된 APP 삭제
    - 종료할 앱의 타입은 세가지가 있다(주가예측글, 운영글, 분석글)
    - 주가예측글: forecast_date가 전날인 모든 글(화-토요일에만 작동)
    - 운영글: voting_end_date이 전날인 모든 글(매일 작동)
    - 분석글: vote_exp_date가 전날인 모든 글(월요일에만 작동)
    - 입력값: 어제 날짜, 어제 요일
*/
const deleteApp = async function (yesterday, dayOfWeek) {
    // 종료될 app_id를 저장하는 배열
    let willBeDeletedAppIdArr = [];

    // 오늘이 월요일이라면 종료된 분석글 app 조회
    if(dayOfWeek == "목"){
        let selectAnalysisPostInfoResult;
        try{
            const datas = [yesterday];

            selectAnalysisPostInfoResult = await analysisSqlHandeler.selectAnalysisPostListByDate(datas);
            console.log("selectAnalysisPostInfoResult")
            console.log(selectAnalysisPostInfoResult.analysis_post_list)

            // 종료할 게시물 정보 리스트
            const analysis_post_list = selectAnalysisPostInfoResult.analysis_post_list;
            
            console.log(analysis_post_list);

            // 리스트가 존재한다면 app_id를 willBeDeletedAppIdArr에 저장한다.
            if(analysis_post_list != undefined) {
                for(let i = 0; i < analysis_post_list.length; i ++){
                    willBeDeletedAppIdArr.push(analysis_post_list[i].app_id)
                }
            }
        } catch(err){
            console.log(err)
        }
    }

    // 오늘이 화-토요일이라면 종료된 주가예측글 app 조회
    if(dayOfWeek != "월" && dayOfWeek != "일"){
        let selectForecastPostInfoResult;

        try{
            const datas = [yesterday];

            selectForecastPostInfoResult = await forecastSqlHandeler.selectForecastPostInfoByDateAndStockCode(datas);
            console.log("selectForecastPostInfoResult")
            console.log(selectForecastPostInfoResult.forecast_post_list)

            // 종료할 게시물 정보 리스트
            const forecast_post_list = selectForecastPostInfoResult.forecast_post_list;
            
            console.log(forecast_post_list);

            // 리스트가 존재한다면 app_id를 willBeDeletedAppIdArr에 저장한다.
            if(forecast_post_list != undefined) {
                for(let i = 0; i < forecast_post_list.length; i ++){
                    willBeDeletedAppIdArr.push(forecast_post_list[i].app_id)
                }
            }
        } catch(err){
            console.log(err)
        }
    }

    // 종료된 운영글 app은 매일 조회
    let selectCommunityOperationPostInfoResult;
    try{
        const datas = [yesterday];

        selectCommunityOperationPostInfoResult = await communityOperationSqlHandeler.selectCommunityOperationPostListByDate(datas);
        console.log("selectCommunityOperationPostInfoResult")
        console.log(selectCommunityOperationPostInfoResult.community_operation_post_list)

        // 종료할 게시물 정보 리스트
        const community_operation_post_list = selectCommunityOperationPostInfoResult.community_operation_post_list;
            
        console.log(community_operation_post_list);

        // 리스트가 존재한다면 app_id를 willBeDeletedAppIdArr에 저장한다.
        if(community_operation_post_list != undefined) {
            for(let i = 0; i < community_operation_post_list.length; i ++){
                willBeDeletedAppIdArr.push(community_operation_post_list[i].app_id)
                console.log("willBeDeletedAppIdArr.length");
                console.log(willBeDeletedAppIdArr.length);

            }
        }
    } catch(err){
        console.log(err)
    }

    // 애플리케이션 삭제
    try{
        if(willBeDeletedAppIdArr.length > 0){
            const result = await smartContract.deleteApp(willBeDeletedAppIdArr)
            console.log(result)
        }
    } catch(err) {
        console.log(err)
    }
};

/* 종료된 APP voting_yn 'n'으로 변경하기
    - 입력
        1) today: 투표 죵료날짜
        2) type: '0': 주가 예측글, '1': 운영글, '2': 분석글
*/
const changeVotingYnToN = async function (today, type, stockType) {
    // voting_yn 변경
    try{
        const datas = [today];

        // 주가예측글
        if(type == '0') {
            datas.push(stockType)
            changeForecastPostInfoResult = await forecastSqlHandeler.changeForecastPostInfo(datas);
            console.log("changeForecastPostInfoResult")
            console.log(changeForecastPostInfoResult)
        } else if(type == '1') {
            // 운영글
            changeCommunityOperaionPostInfoResult = await communityOperationSqlHandeler.changeCommunityOperaionPostInfo(datas);
            console.log("changeCommunityOperaionPostInfoResult")
            console.log(changeCommunityOperaionPostInfoResult)
        } else if(type == '2') {
            // 분석글
            changeAnalysisPostInfoResult = await analysisSqlHandeler.changeAnalysisPostInfo(datas);
            console.log("changeAnalysisPostInfoResult")
            console.log(changeAnalysisPostInfoResult)
        }
    } catch(err) {
        console.log("" + err)
    }
};

module.exports = { 
    deleteApp,
    changeVotingYnToN
};
