// 알고랜드 sdk를 사용하기 위해
const algosdk = require('algosdk');
const fs = require('fs');
const axios = require("axios");
const qs = require('qs');

// 시가/종가 조회
const selectStockPrice = async(type, list, date) => {
    return new Promise(async(resolve)=>{

        await axios.post('http://127.0.0.1:5000/getStockPriceList', null, {params: {
            stock_code_arr_str: list.join(','), // 종목코드 배열 => 콤마로 구분한 문자열로 변경
            type: type,                         // Open: 시가, Close: 종가
            date: date                          // 조회날짜(yyy-mm-dd)
        }})  
        .then(function (response) {
            // {"code" ~~}와 같은 json obj반환
            return resolve(response.data);    
        })
        .catch(function (err) {
            console.log(err);
            return resolve({"code":500, "msg":"selectStockPrice 에러 발생", "error" : "" + err});  
        })
    });
}

module.exports = {selectStockPrice}