const connectionPool = require('../db/connectionPool');

// 설정파일
const fs = require('fs');
const path = require('path');
const jsonFile = fs.readFileSync(path.resolve(__dirname, "../smartcontract/config.json"));
const configJson = JSON.parse(jsonFile);

const converter = require('xml-js');

// query 파일
const stakingSql = fs.readFileSync(path.resolve(__dirname, "./stakingSql.xml"), 'utf-8');

// xml to json
let stakingSqlToJson = JSON.parse(converter.xml2json(stakingSql, {compact: true, spaces: 4}));

// 스테이킹 정보 저장
const createStakingInfo = function (datas){
    return new Promise(async(resolve, reject)=>{
        try {
            const queryStr = stakingSqlToJson.query.createStakingInfo._text;

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

// 스테이킹 정보 조회
const selectStakingInfoListByDate = function (datas){
    return new Promise(async(resolve, reject)=>{
        try {
            const queryStr = stakingSqlToJson.query.selectStakingInfoListByDate._text;

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
                            return resolve({"code":500, "msg" : "스테이킹 정보 조회 중 에러", "error": "" + err});
                        } else {
                            // 커넥션 반납
                            conn.release();

                            if(rows.length != 0){
                                return resolve({"code":200, "msg" : "스테이킹 정보 조회 완료", "staking_info_list": rows})
                            } else {
                                return resolve({"code":200, "msg" : "스테이킹 정보 조회 완료(데이터 없음)", "staking_info_list": null})
                            }
                        }
                    })
                }
            })
        } catch (err) {
            console.log(err);
            return resolve({"code":500, "msg" : "selectStakingInfoListByDate 에러", "error": "" + err});
        }
    });
}

// 특정일에 작성된 예측글들의 종목코드 조회
const selectStockCodeListByDate = function (queryStr, datas){
    return new Promise(async(resolve, reject)=>{
        try {
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
                                return resolve({"code":200, "msg" : "스테이킹 정보 조회 완료", "staking_info_list": rows})
                            } else {
                                return resolve({"code":500, "msg" : "스테이킹 정보 조회 실패", "staking_info_list": null})
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


// 사용자 프로필 수정
const updateUserProfile = function (queryStr, datas){
    return new Promise(async(resolve, reject)=>{
        try {
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

// 스테이킹 정보 삭제
const deleteStakingInfo = function (datas){
    return new Promise(async(resolve, reject)=>{
        try {
            const queryStr = stakingSqlToJson.query.deleteStakingInfo._text;

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
                            return resolve({"code":500, "msg" : "스테이킹 정보 삭제 중 에러", "error": "" + err});
                        } else {
                            // 커넥션 반납
                            conn.release();

                            return resolve({"code":200, "msg" : "스테이킹 정보 삭제 완료"})
                        }
                    })
                }
            })
        } catch (err) {
            console.log(err);
            return resolve({"code":500, "msg" : "deleteStakingInfo 에러", "error": "" + err});
        }
    });
}

module.exports={
    createStakingInfo,
    selectStakingInfoListByDate,
    selectStockCodeListByDate, 
    updateUserProfile,
    deleteStakingInfo
}