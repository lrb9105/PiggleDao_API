// PiggleDAO의 스케줄러 모음
const cron = require('node-cron');

const reward = require('../forecast/rewardToForecastAnswerer')
const rewardToVoteWinner = require('../vote/rewardToForecastVoteWinner')
const rewardToOperationWinner = require('../communityOperation/rewardToCommunityOperationWinner')
const refundStakingAmount = require('../staking/staking')
const rewardToRanker = require('../analysis/rewardToRanker')
const deleteApp = require('../smartcontract/deleteApp')
const time = require('../util/time')

/* 
    시가가격 정확하게 맞춘 계정과 투표자들에게 보상전달하는 스케줄러
    실행시간: 월-금 오전 9시 10분
*/ 
cron.schedule('38 21 * * Monday-Friday', async function(){
    // 오늘날짜 yyyy-mm-dd 형태로 출력
    const today = time.getToday();
    const type = "Open"

    console.log("111")

    reward.rewardToForecastAnswerer(today, type)
});

/* 
    종가가격 정확하게 맞춘 계정과 투표자들에게 보상전달하는 스케줄러
    실행시간: 월-금 오후 3시 40분
*/ 
cron.schedule('40 21 * * Monday-Friday', async function(){
    // 오늘날짜 yyyy-mm-dd 형태로 출력
    const today = time.getToday();
    const type = "Close"

    console.log("333")

    reward.rewardToForecastAnswerer(today, type)
});

/* 
    시가예측글 중 가장 투표를 많이 받은 글 작성 계정과 투표자들에게 보상전달하는 스케줄러
    실행시간: 월-금 오전 8시 00분
*/ 
cron.schedule('0 8 * * Monday-Friday', async function(){
    // 오늘날짜 yyyy-mm-dd 형태로 출력
    const today = time.getToday();
    const type = "Open"

    rewardToVoteWinner.rewardToVoteWinner(today, type)
});

/* 
    종가예측글 중 가장 투표를 많이 받은 글 작성 계정과 투표자들에게 보상전달하는 스케줄러
    실행시간: 월-금 오후 14시 30분
*/ 
cron.schedule('30 14 * * Monday-Friday', async function(){
    // 오늘날짜 yyyy-mm-dd 형태로 출력
    const today = time.getToday();
    const type = "Close"

    rewardToVoteWinner.rewardToVoteWinner(today, type)
});

/* 
    임계점을 넘은 운영글을 작성한 사용자에게 보상 토큰 전달하는 스케줄러
    실행시간: 매일 오전 1시
*/ 
cron.schedule('0 1 * * *', async function(){
    // 어제날짜 yyyy-mm-dd 형태로 출력
    const yesterday = time.getYesterday();

    rewardToOperationWinner.rewardToOperationWinner(yesterday)
});

/* 
    분석글 랭킹 정하고 보상 전달하는 스케줄러
    실행시간: 매주 월요일 오전 8시
*/ 
cron.schedule('0 8 * * Monday', async function(){
    // 어제날짜 yyyy-mm-dd 형태로 출력
    const yesterday = time.getYesterday();

    rewardToRanker.rewardToRanker(yesterday)
});

/* 
    스테이킹 기간이 종료된 금액 돌려주는 스케줄러
    실행시간: 매일 오전 12시 10분
*/ 
cron.schedule('10 0 * * *', async function(){
    // 어제날짜 yyyy-mm-dd 형태로 출력
    const yesterday = time.getYesterday();

    refundStakingAmount.refundStakingAmount(yesterday)
});

/* 
    투표 기간이 종료된 시가예측글 app is_voting_yn 'n'으로 변경하는 스케줄러
    실행시간: 월-금 오전 8시 00분
*/ 
cron.schedule('10 0 * * *', async function(){
    // 오늘날짜 yyyy-mm-dd 형태로 출력
    const today = time.getToday();

    await deleteApp.changeVotingYnToN(today, '0', 'Open');
});

/* 
    투표 기간이 종료된 종가예측글 app is_voting_yn 'n'으로 변경하는 스케줄러
    실행시간: 월-금 오후 2시 30분
*/ 
cron.schedule('10 0 * * *', async function(){
    // 오늘날짜 yyyy-mm-dd 형태로 출력
    const today = time.getToday();
    
    await deleteApp.changeVotingYnToN(today, '0', 'Close');
});

/* 
    투표 기간이 종료된 운영글 app is_voting_yn 'n'으로 변경하는 스케줄러
    실행시간: 매일 오후 11시 59분 59초
*/ 
cron.schedule('10 0 * * *', async function(){
    // 오늘날짜 yyyy-mm-dd 형태로 출력
    const today = time.getToday();
    
    await deleteApp.changeVotingYnToN(today, '1', null);
});

/* 
    투표 기간이 종료된 분석글 app is_voting_yn 'n'으로 변경하는 스케줄러
    실행시간: 매일 오후 11시 59분 59초
*/ 
cron.schedule('10 0 * * *', async function(){
    // 오늘날짜 yyyy-mm-dd 형태로 출력
    const today = time.getToday();
    
    await deleteApp.changeVotingYnToN(today, '2', null);
});






















/* 
    종료된 운영글 스마트컨트랙트를 delete해주는 스케줄러
    실행시간: 매일 오전 3시
*/ 
cron.schedule('0 3 * * *', async function(){
});

/* 
    종료된 주가예측글 스마트컨트랙트를 delete해주는 스케줄러
    실행시간: 매일 오후 16시
*/ 
cron.schedule('0 16 * * *', async function(){
});

/* 
    종료된 분석글 스마트컨트랙트를 delete해주는 스케줄러
    실행시간: 월요일 오전 10시
*/ 
cron.schedule('0 10 * * Monday', async function(){
});