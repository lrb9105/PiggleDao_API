const connectionPool = require('../db/connectionPool');

// 설정파일
const fs = require('fs');
const path = require('path');
const jsonFile = fs.readFileSync(path.resolve(__dirname, "../smartcontract/config.json"));
const configJson = JSON.parse(jsonFile);

// ipfs를 다루기 위함
const ipfs = require("../util/ipfs")

const converter = require('xml-js');

// query 파일
const userInfoSql = fs.readFileSync(path.resolve(__dirname, "./userInfoSql.xml"),'utf-8');

// xml to json
let userInfoSqlToJson = JSON.parse(converter.xml2json(userInfoSql, {compact: true, spaces: 4}));

// 회원정보 저장
const createUserInfo = function (datas){
    return new Promise(async(resolve, reject)=>{
        try {
            const queryStr = userInfoSqlToJson.query.createUserInfo._text;

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
                    await conn.query(queryStr, [datas], (err, rows, fields) => {
                        if (err) {
                            if (conn) {
                                conn.release();
                            }
                            console.log(err)
                            return resolve({"code":500, "msg" : "db에 데이터 저장 중 에러", "error": "" + err});
                        } else {
                            // 커넥션 반납
                            conn.release();
                                    
                            console.log("저장 완료");
                            return resolve({"code":200, "msg" : "db에 데이터 저장 완료", "addr": datas[0]})
                        }
                    })
                }
            })
        } catch (err) {
            console.log(err);
            return resolve({"code":500, "msg" : "createUserInfo 에러", "error": "" + err});
        }
    });
}

// 이미 가입한 회원인지 조회
const selectIsExist = function (datas){
    return new Promise(async(resolve, reject)=>{
        try {
            const queryStr = userInfoSqlToJson.query.selectIsExist._text;

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
                            return resolve({"code":500, "msg" : "db에 데이터 저장 중 에러", "error": "" + err});
                        } else {
                            // 커넥션 반납
                            conn.release();

                            if(rows.length != 0){
                                return resolve({"code":200, "msg" : "이미 가입한 회원입니다.", "is_exist" : true})
                            } else {
                                return resolve({"code":200, "msg" : "아직 가입하지 않은 사용자 입니다.", "is_exist" : false})
                            }
                        }
                    })
                }
            })
        } catch (err) {
            console.log(err);
            return resolve({"code":500, "msg" : "selectIsExist 에러", "error": "" + err});
        }
    });
}

// 가입한 총인원 구하기
const selectCount = function (){
    return new Promise(async(resolve, reject)=>{
        try {
            const queryStr = userInfoSqlToJson.query.selectCount._text;

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
                    await conn.query(queryStr, (err, rows, fields) => {
                        if (err) {
                            if (conn) {
                                conn.release();
                            }
                            console.log(err)
                            return resolve({"code":500, "msg" : "db에 데이터 저장 중 에러", "error": "" + err});
                        } else {
                            // 커넥션 반납
                            conn.release();

                            return resolve({"code":200, "msg" : "총인원수입니다.", "count": rows[0].count})
                        }
                    })
                }
            })
        } catch (err) {
            console.log(err);
            return resolve({"code":500, "msg" : "selectCount 에러", "error": "" + err});
        }
    });
}

// 회원정보 조회
const selectUserInfo = function (datas){
    return new Promise(async(resolve, reject)=>{
        try {
            const queryStr = userInfoSqlToJson.query.selectUserInfo._text;

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
                            return resolve({"code":500, "msg" : "db에 데이터 저장 중 에러", "error": "" + err});
                        } else {
                            // 커넥션 반납
                            conn.release();

                            if(rows.length != 0){
                                const fileInfo = await ipfs.changeDataToHttp([rows[0].user_profile_hash]);
                                const fileHttpUrlArr = fileInfo.fileHttpUrlArr;
                                
                                rows[0].user_profile_hash = fileHttpUrlArr[0];
                                
                                return resolve({"code":200, "msg" : "사용자 정보 조회 완료", "userInfo": rows[0]})
                            } else {
                                return resolve({"code":200, "msg" : "잘못된 주소입니다.", "userInfo": null})
                            }
                        }
                    })
                }
            })
        } catch (err) {
            console.log(err);
            return resolve({"code":500, "msg" : "selectUserInfo 에러", "error": "" + err});
        }
    });
}

// 모든 글 조회
const selectAllPost = function (dataMap){
    return new Promise(async(resolve, reject)=>{
        try {
            let queryStr;
            let selectAllPost = userInfoSqlToJson.query.selectAllPost._text;
            let condition;
            let datas = [];

            // 특정 사용자가 작성한 모든 글 조회
            if(dataMap.get("user_addr") != undefined) {
                condition = userInfoSqlToJson.query.conditionWriter_addr._text;
                datas.push(dataMap.get("user_addr"))
            } else if(dataMap.get("search_data") != undefined){
                // 특정 검색어를 포함하는 모든 글 조회
                condition = userInfoSqlToJson.query.conditionTitleUserName._text;
                datas.push(dataMap.get("search_data"))
                datas.push(dataMap.get("search_data"))
            }

            datas.push((Number(dataMap.get("search_page_no")) - 1) * global.pagingNo);
            datas.push(global.pagingNo);

            const orderVotingYnCreDatetime = userInfoSqlToJson.query.orderVotingYnCreDatetime._text
            const paging = userInfoSqlToJson.query.paging._text;

            queryStr = selectAllPost + "\n" + condition + "\n" + orderVotingYnCreDatetime + "\n" + paging 

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
                            return resolve({"code":500, "msg" : "모든 게시글 조회 중 에러", "error": "" + err});
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

                                const fileInfo = await  ipfs.changeDataToHttp(userProfileHashArr);
                                const userProfileHttpUrlArr = fileInfo.fileHttpUrlArr;

                                for(let i = 0; i < rows.length; i++ ){
                                    rows[i].user_profile_url = userProfileHttpUrlArr[i]
                                }
                                
                                return resolve({"code":200, "msg" : "모든 게시글 조회 완료", "post_list": rows})
                            } else {
                                return resolve({"code":200, "msg" : "모든 게시글 조회 완료(데이터 없음)", "post_list": null})
                            }
                        }
                    })
                }
            })
        } catch (err) {
            console.log(err);
            return resolve({"code":500, "msg" : "selectAllPost 에러", "error": "" + err});
        }
    });
}

// 사용자 프로필 수정
const updateUserProfile = function (datas){
    return new Promise(async(resolve, reject)=>{
        try {
            const queryStr = userInfoSqlToJson.query.updateUserProfile._text;

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
                            return resolve({"code":500, "msg" : "db에 데이터 저장 중 에러", "error": "" + err});
                        } else {
                            // 커넥션 반납
                            conn.release();

                            return resolve({"code":200, "msg" : "수정 완료", "cid" : datas[0]})
                        }
                    })
                }
            })
        } catch (err) {
            console.log(err);
            return resolve({"code":500, "msg" : "updateUserProfile 에러", "error": "" + err});
        }
    });
}

// 사용자 정보 삭제
const deleteUserInfo = function (datas){
    return new Promise(async(resolve, reject)=>{
        try {
            const queryStr = userInfoSqlToJson.query.deleteUserInfo._text;

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
                            return resolve({"code":500, "msg" : "db에 데이터 저장 중 에러", "error": "" + err});
                        } else {
                            // 커넥션 반납
                            conn.release();

                            return resolve({"code":200, "msg" : "사용자 정보 삭제 완료"})
                        }
                    })
                }
            })
        } catch (err) {
            console.log(err);
            return resolve({"code":500, "msg" : "deleteUserInfo 에러", "error": "" + err});
        }
    });
}

module.exports={
    createUserInfo,
    selectIsExist,
    selectUserInfo,
    selectCount, 
    updateUserProfile,
    deleteUserInfo,
    selectAllPost
}