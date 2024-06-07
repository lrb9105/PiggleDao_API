// 파일 읽어오기 위한 객체
const fs = require('fs'); 
const path = require("path");

const ipfs = require("../util/ipfs");
const time = require("../util/time");

// 쿼리 핸들러
const commentSqlHandeler = require("./commentSqlHandeler");

// 댓글 저장
const createComment = function (dataMap) {
    return new Promise(async(resolve, reject)=>{
        // 저장할 데이터 배열
        let datas = [Number(dataMap.get('post_no')),
                    dataMap.get('writer_addr'),
                    time.timeToKr(),
                    dataMap.get('comment_contents'),
                    dataMap.get('post_type')];

        // db에 정보 저장
        let createForecastCommentResult = await commentSqlHandeler.createComment(datas);
        return resolve(createForecastCommentResult);
    });
}

// 특정 게시글의 댓글리스트 조회
const selectCommentList = function (dataMap) {
    return new Promise(async(resolve, reject)=>{
        const datas = [Number(dataMap.get("post_no")), dataMap.get("post_type")]
        
        // db에서 조회
        let selectCommentListResult = await commentSqlHandeler.selectCommentList(datas);
        return resolve(selectCommentListResult);
    });
}

// 댓글 수정
const updateComment = function (dataMap) {
    return new Promise(async(resolve, reject)=>{
        // 저장할 데이터 배열
        let datas = [dataMap.get('comment_contents'),
                     time.timeToKr(),
                     Number(dataMap.get('comment_no')),
                    ];

        // db에 정보 업데이트
        let updateCommentResult = await commentSqlHandeler.updateComment(datas);
        return resolve(updateCommentResult);
    });
}

// 댓글 삭제
const deleteComment = async function (dataMap) {
    return new Promise(async(resolve, reject)=>{
        // db 정보 삭제
        let deleteCommentResult = await commentSqlHandeler.deleteComment([Number(dataMap.get('comment_no'))]);
        return resolve(deleteCommentResult);
    });
}


module.exports = { 
    createComment,
    updateComment,
    deleteComment,
    selectCommentList
};