// 한국 타임존의 현재시간 반환
function timeToKr(){
    const curr = new Date();
    const utc = curr.getTime() + (curr.getTimezoneOffset() * 60 * 1000);
    const KR_TIME_DIFF = 9 * 60 * 60 * 1000;
    const kr_curr = new Date(utc + KR_TIME_DIFF);
    return kr_curr
}

// 특정일의 한국 타임존 시간 반환
function timeToKrWithInput(date){
    const utc = date.getTime() + (date.getTimezoneOffset() * 60 * 1000);
    const KR_TIME_DIFF = 9 * 60 * 60 * 1000;
    const kr_curr = new Date(utc + KR_TIME_DIFF);
    return kr_curr
}

// 오늘 날짜 yyyy-MM-dd 형태로 반환
function getToday(){
    var date = new Date();
    var year = date.getFullYear();
    var month = ("0" + (1 + date.getMonth())).slice(-2);
    var day = ("0" + date.getDate()).slice(-2);

    return year + "-" + month + "-" + day;
}

// 어제 날짜 yyyy-MM-dd 형태로 반환
function getYesterday(){
    var date = new Date();
    var year = date.getFullYear();
    var month = ("0" + (1 + date.getMonth())).slice(-2);
    var day = ("0" + (date.getDate() -1)).slice(-2);

    return year + "-" + month + "-" + day;
}

// 7일전 날짜 yyyy-MM-dd 형태로 반환
function getDay7Before(){
    var date = new Date();
    var year = date.getFullYear();
    var month = ("0" + (1 + date.getMonth())).slice(-2);
    var day = ("0" + (date.getDate() -7)).slice(-2);

    return year + "-" + month + "-" + day;
}

// 특정일 요일 구하기(yyyy-MM-dd형태의 입력값)
function getDayOfWeek(yyyyMMdd){

    const week = ['일', '월', '화', '수', '목', '금', '토'];

    const dayOfWeek = week[new Date(yyyyMMdd).getDay()];

    return dayOfWeek;

}

module.exports = {getDayOfWeek, timeToKr, timeToKrWithInput, getToday, getYesterday, getDay7Before}