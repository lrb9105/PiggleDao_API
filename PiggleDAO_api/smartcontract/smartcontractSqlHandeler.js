const connectionPool = require('../db/connectionPool');

// 설정파일
const fs = require('fs');
const path = require('path');
const jsonFile = fs.readFileSync(path.resolve(__dirname, "./config.json"));
const configJson = JSON.parse(jsonFile);

// 스테이킹 정보 저장
const createStakingInfo = function (queryStr, datas){
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

// 회원정보 조회
const selectUserInfo = function (queryStr, datas){
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
                                rows[0].user_profile_hash = "http://localhost:8081/ipfs/" + rows[0].user_profile_hash;
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

// 사용자 정보 삭제
const deleteUserInfo = function (queryStr, datas){
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
    createStakingInfo,
    selectUserInfo, 
    updateUserProfile,
    deleteUserInfo
}