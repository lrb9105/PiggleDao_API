const connectionPool = require('../db/connectionPool');

// 설정파일
const fs = require('fs');
const path = require('path');

const time = require("../util/time")
const converter = require('xml-js');
const commentSql = fs.readFileSync(path.resolve(__dirname, "./commentSql.xml"),'utf-8');
let commentSqlToJson = JSON.parse(converter.xml2json(commentSql, {compact: true, spaces: 4}));

// ipfs를 다루기 위함
const ipfs = require("../util/ipfs")

// 댓글 저장
const createComment = function (datas){
    return new Promise(async(resolve, reject)=>{
        try {
            const queryStr = commentSqlToJson.query.createComment._text;

            // db pool 가져오기
            const dbPool = await connectionPool.getPool();
                    
            // db pool에서 연결객체를 가져오기
            dbPool.getConnection(async (err, conn) => {
                if (err) {
                    if (conn) {
                        conn.release();
                    }
                    console.log("커넥션 에러\n" + err);
                    return resolve({"code":500, "msg" : "db 커넥션 연결 중 에러", "error": "" + err});
                } else {
                    // 내부 콜백에서 쿼리를 수행
                    await conn.query(queryStr, [datas], (err, rows, fields) => {
                        if (err) {
                            if (conn) {
                                conn.release();
                            }
                            console.log(err)
                            return resolve({"code":500, "msg" : "db에 댓글 데이터 저장 중 에러", "error": "" + err});
                        } else {
                            const queryStr2  = commentSqlToJson.query.selectMaxCommentNo._text;
                            
                            // 가장 큰 comment_no 조회
                            conn.query(queryStr2, (err, rows, fields) => {
                                if (err) {
                                    if (conn) {
                                        conn.release();
                                    }
                                    console.log(err)
                                    return resolve({"code":500, "msg" : "db에 댓글 데이터 저장 중 에러", "error": "" + err});
                                } else {
                                    // 커넥션 반납
                                    conn.release();

                                    const maxcomment_no = rows[0].comment_no;
                                            
                                    console.log("저장 완료");
                                    return resolve({"code":200, "msg" : "db에 댓글 데이터 저장 완료", "comment_no": maxcomment_no})
                                }
                            })
                        }
                    })
                }
            })
        } catch (err) {
            console.log(err);
            return resolve({"code":500, "msg" : "createComment 에러", "error": "" + err});
        }
    });
}

// 특정 게시글의 댓글리스트 조회
const selectCommentList = function (datas){
    return new Promise(async(resolve, reject)=>{
        try {
            const selectCommentList = commentSqlToJson.query.selectCommentList._text;
            const orderByCommentCreDatetime = commentSqlToJson.query.orderByCommentCreDatetime._text;

            const queryStr = selectCommentList + "\n" + orderByCommentCreDatetime;

            // db pool 가져오기
            const dbPool = await connectionPool.getPool();

            console.log(datas);
                    
            // db pool에서 연결객체를 가져오기
            dbPool.getConnection(async (err, conn) => {
                if (err) {
                    if (conn) {
                        conn.release();
                    }
                    console.log("커넥션 에러\n" + err);
                    return resolve({"code":500, "msg" : "db 커넥션 연결 중 에러", "error": "" + err});
                } else {
                    // 내부 콜백에서 쿼리를 수행
                    await conn.query(queryStr, datas, async (err, rows, fields) => {
                        if (err) {
                            if (conn) {
                                conn.release();
                            }
                            console.log(err)
                            return resolve({"code":500, "msg" : "댓글 리스트 조회 중 에러", "error": "" + err});
                        } else {
                            // 커넥션 반납
                            conn.release();

                            if(rows.length != 0){                                
                                // user_profile_hash => http url로 변경
                                let userProfileHashArr = [];

                                for(let i = 0; i < rows.length; i++ ){
                                    if(rows[i].user_profile_hash != null) {
                                        userProfileHashArr.push(rows[i].user_profile_hash)
                                    } else {
                                        // 사용자의 프로필 사진이 없다면 null을 넣어준다.
                                        userProfileHashArr.push(null)
                                    }
                                }

                                const fileInfo = await ipfs.changeDataToHttp(userProfileHashArr);
                                if(fileInfo.code == 500 ){
                                    return resolve(fileInfo)
                                }
                                const userProfileHttpUrlArr = fileInfo.fileHttpUrlArr;

                                for(let i = 0; i < rows.length; i++ ){
                                    rows[i].user_profile_url = userProfileHttpUrlArr[i]
                                }
                                
                                return resolve({"code":200, "msg" : "댓글 리스트 조회 완료", "comment_list": rows})
                            } else {
                                return resolve({"code":200, "msg" : "댓글 리스트 조회 완료(데이터 없음)", "comment_list": null})
                            }
                        }
                    })
                }
            })
        } catch (err) {
            console.log(err);

            return resolve({"code":500, "msg" : "selectCommentList 에러", "error": "" + err});
        }
    });
}
// 댓글 수정
const updateComment = function (datas){
    return new Promise(async(resolve, reject)=>{
        try {
            const queryStr = commentSqlToJson.query.updateComment._text;

            // db pool 가져오기
            const dbPool = await connectionPool.getPool();
                    
            // db pool에서 연결객체를 가져오기
            dbPool.getConnection(async (err, conn) => {
                if (err) {
                    if (conn) {
                        conn.release();
                    }
                    console.log("커넥션 에러\n" + err);
                    return resolve({"code":500, "msg" : "db 커넥션 연결 중 에러", "error": "" + err});
                } else {
                    // 내부 콜백에서 쿼리를 수행
                    await conn.query(queryStr, datas, async (err, rows, fields) => {
                        if (err) {
                            if (conn) {
                                conn.release();
                            }
                            console.log(err)
                            return resolve({"code":500, "msg" : "댓글 정보 수정 중 에러", "error": "" + err});
                        } else {
                            // 커넥션 반납
                            conn.release();

                            // comment_no 반환
                            return resolve({"code":200, "msg" : "댓글 정보 수정 완료", "comment_no" : datas[2]})
                        }
                    })
                }
            })
        } catch (err) {
            console.log(err);
            return resolve({"code":500, "msg" : "updateComment 에러", "error": "" + err});
        }
    });
}

// 댓글 삭제
const deleteComment = function (datas){
    return new Promise(async(resolve, reject)=>{
        try {
            const queryStr = commentSqlToJson.query.deleteComment._text;

            // db pool 가져오기
            const dbPool = await connectionPool.getPool();
                    
            // db pool에서 연결객체를 가져오기
            dbPool.getConnection(async (err, conn) => {
                if (err) {
                    if (conn) {
                        conn.release();
                    }
                    console.log("커넥션 에러\n" + err);
                    return resolve({"code":500, "msg" : "db 커넥션 연결 중 에러", "error": "" + err});
                } else {
                    // 내부 콜백에서 쿼리를 수행
                    await conn.query(queryStr, datas, async (err, rows, fields) => {
                        if (err) {
                            if (conn) {
                                conn.release();
                            }
                            console.log(err)
                            return resolve({"code":500, "msg" : "댓글 정보 삭제 중 에러", "error": "" + err});
                        } else {
                            // 커넥션 반납
                            conn.release();

                            return resolve({"code":200, "msg" : "댓글 정보 삭제 완료", "comment_no" : datas[0]})
                        }
                    })
                }
            })
        } catch (err) {
            console.log(err);
            return resolve({"code":500, "msg" : "deleteComment 에러", "error": "" + err});
        }
    });
}

module.exports={
    createComment,
    selectCommentList,
    updateComment,
    deleteComment
}