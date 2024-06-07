const connectionPool = require('../db/connectionPool');

// 설정파일
const fs = require('fs');
const path = require('path');

const converter = require('xml-js');

// query 파일
const communityOperationSql = fs.readFileSync(path.resolve(__dirname, "./communityOperationSql.xml"),'utf-8');

// xml to json
let communityOperationSqlToJson = JSON.parse(converter.xml2json(communityOperationSql, {compact: true, spaces: 4}));

// ipfs를 다루기 위함
const ipfs = require("../util/ipfs")

// 커뮤니티 운영 게시글 작성 
const createCommunityOperationPost = function (datas){
    return new Promise(async(resolve, reject)=>{
        try {
            const queryStr = communityOperationSqlToJson.query.createCommunityOperationPost._text;

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
                            return resolve({"code":500, "msg" : "db에 커뮤니티 운영 데이터 저장 중 에러", "error": "" + err});
                        } else {
                            const queryStr2  = communityOperationSqlToJson.query.selectMaxCommunityOperationNo._text;
                            
                            // 가장 큰 voting_post_no 조회
                            conn.query(queryStr2, (err, rows, fields) => {
                                if (err) {
                                    if (conn) {
                                        conn.release();
                                    }
                                    console.log(err)
                                    return resolve({"code":500, "msg" : "db에 커뮤니티 운영 데이터 저장 중 에러", "error": "" + err});
                                } else {
                                    // 커넥션 반납
                                    conn.release();

                                    const maxCommunityOperationNo = rows[0].community_operation_post_no;
                                            
                                    console.log("저장 완료");
                                    return resolve({"code":200, "msg" : "db에 커뮤니티 운영 데이터 저장 완료", "community_operation_post_no": maxCommunityOperationNo})
                                }
                            })
                        }
                    })
                }
            })
        } catch (err) {
            console.log(err);
            return resolve({"code":500, "msg" : "createCommunityOperationPost 에러", "error": "" + err});
        }
    });
}

// 커뮤니티 운영 게시글 리스트 조회전체 조회
const selectCommunityOperationPostList = function (datas){
    return new Promise(async(resolve, reject)=>{
        try {
            const selectCommunityOperationPostList = communityOperationSqlToJson.query.selectCommunityOperationPostList._text;
            const conditionIsVotingYn = communityOperationSqlToJson.query.conditionIsVotingYn._text;
            const orderByVotingEndDateDesc = communityOperationSqlToJson.query.orderByVotingEndDateDesc._text;
            const paging = communityOperationSqlToJson.query.paging._text;

            const queryStr = selectCommunityOperationPostList + "\n" + conditionIsVotingYn + "\n" + orderByVotingEndDateDesc + "\n" + paging;

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
                            return resolve({"code":500, "msg" : "커뮤니티 운영글 조회 중 에러", "error": "" + err});
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
                                
                                return resolve({"code":200, "msg" : "커뮤니티 운영글 조회 완료", "community_operation_post_list": rows})
                            } else {
                                return resolve({"code":200, "msg" : "커뮤니티 운영글 조회 완료(데이터 없음)", "community_operation_post_list": null})
                            }
                        }
                    })
                }
            })
        } catch (err) {
            console.log(err);
            return resolve({"code":500, "msg" : "selectCommunityOperationPostList 에러", "error": "" + err});
        }
    });
}

// 커뮤니티 운영 게시글 리스트 검색
const searchCommunityOperationPostList = function (datas){
    return new Promise(async(resolve, reject)=>{
        try {
            const selectCommunityOperationPostList = communityOperationSqlToJson.query.selectCommunityOperationPostList._text;
            const conditionTitleUserName = communityOperationSqlToJson.query.conditionTitleUserName._text;
            const orderByVotingEndDateDesc = communityOperationSqlToJson.query.orderByVotingEndDateDesc._text;
            const paging = communityOperationSqlToJson.query.paging._text;

            const queryStr = selectCommunityOperationPostList + "\n" + conditionTitleUserName + "\n" + orderByVotingEndDateDesc + "\n" + paging;

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
                            return resolve({"code":500, "msg" : "커뮤니티 운영글 정보 조회중 에러", "error": "" + err});
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

                                return resolve({"code":200, "msg" : "커뮤니티 운영글 정보 조회 검색 완료", "community_operation_post_list": rows})
                            } else {
                                return resolve({"code":200, "msg" : "커뮤니티 운영글 정보 조회 검색 완료(데이터 없음)", "community_operation_post_list": null})
                            }
                        }
                    })
                }
            })
        } catch (err) {
            console.log(err);
            return resolve({"code":500, "msg" : "searchCommunityOperationPostList 에러", "error": "" + err});
        }
    });
}

// 커뮤니티 운영 게시글 상세조회
const selectCommunityOperationPostDetail = function (datas){
    return new Promise(async(resolve, reject)=>{
        try {
            const selectCommunityOperationPostList = communityOperationSqlToJson.query.selectCommunityOperationPostList._text;
            const conditionCommunityOperationNo = communityOperationSqlToJson.query.conditionCommunityOperationNo._text;

            const queryStr = selectCommunityOperationPostList + "\n" + conditionCommunityOperationNo;

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
                            return resolve({"code":500, "msg" : "커뮤니티 운영글 정보 조회 중 에러", "error": "" + err});
                        } else {
                            // 커넥션 반납
                            conn.release();

                            if(rows.length != 0){
                                // http url로 변경할 데이터: user_profile_hash, file_hashs
                                let hashArr = [];

                                // hashArr[0]에 user_profile_hash 저장
                                if(rows[0].user_profile_hash != null) {
                                    hashArr.push(rows[0].user_profile_hash)
                                } else {
                                    // 사용자의 프로필 사진이 없다면 null을 넣어준다.
                                    hashArr.push(null)
                                }

                                // 이미지 hash => http url로 변환
                                const fileHashsStr = rows[0].file_hashs
                                let fileHashsArr;
                                // 저장한 이미지 파일이 존재한다면
                                if(fileHashsStr != null) {
                                    fileHashsArr = fileHashsStr.split(",");

                                    // hash[1]부터 이미지 파일 hash를 넣는다.
                                    for(let i = 0; i < fileHashsArr.length; i++ ){
                                        hashArr.push(fileHashsArr[i])
                                    }
                                }

                                const fileInfo = await ipfs.changeDataToHttp(hashArr);
                                if(fileInfo.code == 500){
                                    return resolve(fileInfo)
                                }
                                const fileHttpUrlArr = fileInfo.fileHttpUrlArr;

                                rows[0].user_profile_url = fileHttpUrlArr[0]

                                // 배열의 첫번쨰 데이터(사용자 프로필 url 삭제)
                                fileHttpUrlArr.shift();

                                // 이미지 파일 http url 배열
                                rows[0].file_url_arr = fileHttpUrlArr

                                // 컨텐츠 다운로드
                                const contentsInfo = await ipfs.downloadFileFromIpfs(rows[0].contents_hash)
                                if(contentsInfo.code == 200){
                                    rows[0].contents_str = contentsInfo.file;
                                } else {
                                    return resolve(contentsInfo)
                                }

                                rows[0].contents_str = contentsInfo.file;;

                                return resolve({"code":200, "msg" : "커뮤니티 운영글 정보 조회 검색 완료", "community_operation_post_info": rows[0]})
                            } else {
                                return resolve({"code":200, "msg" : "커뮤니티 운영글 정보 조회 검색 완료(데이터 없음)", "community_operation_post_info": null})
                            }
                        }
                    })
                }
            })
        } catch (err) {
            console.log(err);
            return resolve({"code":500, "msg" : "selectCommunityOperationPostDetail 에러", "error": "" + err});
        }
    });
}

// 어제 투표가 종료된 커뮤니티 운영글 조회
const selectCommunityOperationPostListByDate = function (datas){
    return new Promise(async(resolve, reject)=>{
        try {
            const selectCommunityOperationPostList = communityOperationSqlToJson.query.selectCommunityOperationPostList._text;
            const conditionVotingEndDate = communityOperationSqlToJson.query.conditionVotingEndDate._text;
            const queryStr = selectCommunityOperationPostList + "\n" + conditionVotingEndDate;
            
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
                            return resolve({"code":500, "msg" : "운영글 정보 조회 중 에러", "error": "" + err});
                        } else {
                            // 커넥션 반납
                            conn.release();

                            if(rows.length != 0){
                                return resolve({"code":200, "msg" : "운영글 정보 조회 완료", "community_operation_post_list": rows})
                            } else {
                                return resolve({"code":200, "msg" : "운영글 정보 조회 완료(데이터 없음)", "community_operation_post_list": null})
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

// 커뮤니티 운영 정보 수정
const updateCommunityOperationPost = function (datas){
    return new Promise(async(resolve, reject)=>{
        try {
            const queryStr = communityOperationSqlToJson.query.updateCommunityOperationPost._text;

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
                            return resolve({"code":500, "msg" : "커뮤니티 운영 정보 수정 중 에러", "error": "" + err});
                        } else {
                            // 커넥션 반납
                            conn.release();

                            // community_operation_post_no 반환
                            return resolve({"code":200, "msg" : "커뮤니티 운영 정보 수정 완료", "community_operation_post_no" : datas[4]})
                        }
                    })
                }
            })
        } catch (err) {
            console.log(err);
            return resolve({"code":500, "msg" : "updateCommunityOperationPost 에러", "error": "" + err});
        }
    });
}

// 투표가 종료된 커뮤니티 운영글의 votin_yn 'n'으로 변경
const changeCommunityOperaionPostInfo = function (datas){
    return new Promise(async(resolve, reject)=>{
        try {
            const queryStr = communityOperationSqlToJson.query.changeCommunityOperationPostInfo._text;

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
                            return resolve({"code":500, "msg" : "운영글 voting_yn 변경 중 에러", "error": "" + err});
                        } else {
                            // 커넥션 반납
                            conn.release();

                            return resolve({"code":200, "msg" : "운영글 voting_yn 변경 완료"})
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

// 커뮤니티 운영 게시글 삭제
const deleteCommunityOperationPost = function (datas){
    return new Promise(async(resolve, reject)=>{
        try {
            const queryStr = communityOperationSqlToJson.query.deleteCommunityOperationPost._text;

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
                            return resolve({"code":500, "msg" : "커뮤니티 운영 정보 삭제 중 에러", "error": "" + err});
                        } else {
                            // 커넥션 반납
                            conn.release();

                            return resolve({"code":200, "msg" : "커뮤니티 운영 정보 삭제 완료", "voting_post_no" : datas[0]})
                        }
                    })
                }
            })
        } catch (err) {
            console.log(err);
            return resolve({"code":500, "msg" : "deleteCommunityOperationPost 에러", "error": "" + err});
        }
    });
}



module.exports={
    selectCommunityOperationPostListByDate,
    changeCommunityOperaionPostInfo,
    createCommunityOperationPost,
    selectCommunityOperationPostList,
    searchCommunityOperationPostList,
    selectCommunityOperationPostDetail,
    updateCommunityOperationPost,
    deleteCommunityOperationPost 
}