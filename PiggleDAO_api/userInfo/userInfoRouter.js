// express.Router를 사용하기 위해 express exports를 가져옴!
const express = require("express");

const fs = require('fs'); 

// Router를 사용하기 위해 express.Router()호출
const router = express.Router();

// xml query파일을 파싱하기 위함
var xml_digester = require("xml-digester");
var digester = xml_digester.XmlDigester({});

// 클라이언트가 보낸 데이터를 파싱
const parser = require("../util/parser")

// sql 핸들러
const userInfoSqlHandeler = require("./userInfoSqlHandeler")

// ipfs를 다루기 위함
const ipfs = require("../util/ipfs")

// 블록체인
const blockchain = require("../smartcontract/blockchain")
const vote = require("../vote/vote");

// 블록체인 기능 실행에 필요한 json파일을 로드하기 위해
const path = require("path");
const jsonFile = fs.readFileSync(path.resolve(__dirname, "../smartcontract/config.json"));
const configJson = JSON.parse(jsonFile);

// 해시맵
const HashMap  = require ('hashmap') ;

// 외부에서 사용하기 위해 router를 넣어줌!
module.exports = router;

router.use(express.urlencoded({ extended: false }));

/* 
    역할: 회원정보를 저장한다.
*/
router.post('/createUserInfo', async function(req,res) {
    // 클라이언트가 보낸 회원정보 정보를 파싱한다.
    // 반환 => 자바스크립트 객체: {"code":200, "msg" : "데이터 및 파일 파싱 완료", "dataMap" : dataMap, "fileMap" : fileMap}
    const resultParse = await parser.parseMultiParts(req);
    if(resultParse.code == 500) {
        res.send(resultParse);
        return;
    }

    // 데이터 파싱 완료 시 저장
    if(resultParse.code == 200){
        // 데이터를 담는 hashMap
        const dataMap = resultParse.dataMap;

        // sql파일 읽어오기
        fs.readFile(__dirname + '/userInfoSql.xml','utf8', function(err, data) {
            if (err) { 
                console.log(err);
                res.send({"code":500, "msg" : "xml파일 읽어오기 중 에러", "error": "" + err})
                return;
            } else {
                // sql 파일 파싱
                digester.digest(data, async function(err, resultPaserSql) {
                    if (err) {
                        console.log(err);
                        res.send({"code":500, "msg" : "xml파일 파싱 중 에러", "error": "" + err})
                        return;
                    } else {
                        const datas = [dataMap.get("user_addr")];

                        // 가입한 회원인지 조회 sql 실행
                        const selectIsExistResult = await userInfoSqlHandeler.selectIsExist(datas);
                        
                        // 이미 가입한 회원
                        if(selectIsExistResult.is_exist == "true"){
                            res.send(selectIsExistResult);
                            return;
                        } else{
                        // 아직 가입하지 않은 회원
                            let ipfsResult = null;

                            // ipfs에 데이터 저장
                            if(resultParse.fileMap != null){
                                ipfsResult = await ipfs.uploadImageToIpfs(resultParse.fileMap);
                                
                                console.log(ipfsResult)
                                console.log("순서11");
                    
                                if(ipfsResult.code == 500){
                                    res.send(ipfsResult);
                                    return;
                                }
                            }
                            
                            console.log("순서22")
                    
                            // 저장할 데이터
                            const datas = [dataMap.get("user_addr"), dataMap.get("user_name"), (ipfsResult != null?ipfsResult.fileHashs:null)];
                    
                            console.log(datas);
                                            
                            // sql 실행
                            const createUserInfoResult = await userInfoSqlHandeler.createUserInfo(datas);
                            
                            res.send(createUserInfoResult);
                            return;
                        }
                    }
                });
            }
        });
    } else {
        // 데이터 파싱 실패 시 응답 반환
        res.send(resultParse)
        return
    }
});

/* 
    역할: 회원가입을 한다.
*/
router.post('/registerDao', async function(req,res) {
    // 클라이언트가 보낸 회원정보 정보를 파싱한다.
    // 반환 => 자바스크립트 객체: {"code":200, "msg" : "데이터 및 파일 파싱 완료", "dataMap" : dataMap, "fileMap" : fileMap}
    const resultParse = await parser.parseMultiParts(req);
    if(resultParse.code == 500) {
        res.send(resultParse);
        return;
    }

    // 데이터 파싱 완료 시 저장
    if(resultParse.code == 200){
        // 데이터를 담는 hashMap
        const dataMap = resultParse.dataMap;

        // sql파일 읽어오기
        fs.readFile(__dirname + '/userInfoSql.xml','utf8', function(err, data) {
            if (err) { 
                console.log(err);
                res.send({"code":500, "msg" : "xml파일 읽어오기 중 에러", "error": "" + err})
                return;
            } else {
                const addr = dataMap.get("user_addr");

                // sql 파일 파싱
                digester.digest(data, async function(err, resultPaserSql) {
                    if (err) {
                        console.log(err);
                        res.send({"code":500, "msg" : "xml파일 파싱 중 에러", "error": "" + err})
                        return;
                    } else {
                        const datas = [addr];

                        // 가입한 회원인지 조회 sql 실행
                        try{
                            const selectIsExistResult = await userInfoSqlHandeler.selectIsExist(datas);
                        
                            // 이미 가입한 회원
                            if(selectIsExistResult.is_exist == "true"){
                                res.send(selectIsExistResult);
                                return;
                            } else{
                            // 아직 가입하지 않은 회원
                                // 계정주소로 노바 전송
                                const sendResult = await blockchain.sendToAddrByDevAddrWithAmount(addr, 101000);

                                if(sendResult.code == 500) {
                                    res.send(sendResult);
                                    return 
                                }
                                console.log("11")
                                // 옵트인
                                const tokenId = configJson.SmartContractParams.token_id;
                                const optInResult = await blockchain.tokenOptIn(dataMap.get("mnemonic"), tokenId);
                                console.log("22")

                                if(optInResult.code == 500) {
                                    res.send(optInResult);
                                    return 
                                }

                                // ipfs에 데이터 저장
                                let ipfsResult = null;

                                if(resultParse.fileMap != null){
                                    ipfsResult = await ipfs.uploadImageToIpfs(resultParse.fileMap);
                                    
                                    console.log(ipfsResult)

                                    if(ipfsResult.code == 500){
                                        res.send(ipfsResult);
                                        return;
                                    }
                                }
                                                        
                                // 저장할 데이터
                                const datas = [dataMap.get("user_addr"), dataMap.get("user_name"), (ipfsResult != null?ipfsResult.fileHashs:null)];
                        
                                console.log(datas);
                                                
                                // sql 실행
                                const createUserInfoResult = await userInfoSqlHandeler.createUserInfo(datas);
                            
                                res.send(createUserInfoResult);
                            }
                        } catch(err){
                            res.send({"code":err.code, "msg" : err.msg, "error": err.error});
                        }
                    }
                });
            }
        });
    } else {
    // 데이터 파싱 실패 시 응답 반환
        res.send(resultParse)
        return
    }
});

/* 
    역할: 회원정보를 조회한다.
*/
router.get('/selectUserInfo', async function(req,res) {
    // sql파일 읽어오기
    fs.readFile(__dirname + '/userInfoSql.xml','utf8', function(err, data) {
        if (err) { 
            console.log(err);
            res.send({"code":500, "msg" : "xml파일 읽어오기 중 에러", "error": "" + err})
            return;
        } else {
            // sql 파일 파싱
            digester.digest(data, async function(err, resultPaserSql) {
                if (err) {
                    console.log(err);
                    res.send({"code":500, "msg" : "xml파일 파싱 중 에러", "error": "" + err})
                    return;
                } else {            
                    const datas = [req.query.user_addr];
                            
                    // sql 실행
                    const selectUserInfoResult = await userInfoSqlHandeler.selectUserInfo(datas);

                    res.send(selectUserInfoResult);
                }
            });
        }
    });
});

/* 
    역할: 프로필 사진을 수정한다.
*/
router.post('/updateUserProfile', async function(req,res) {
    // 클라이언트가 보낸 회원정보 정보를 파싱한다.
    // 반환 => 자바스크립트 객체: {"code":200, "msg" : "데이터 및 파일 파싱 완료", "dataMap" : dataMap, "fileMap" : fileMap}
    const resultParse = await parser.parseMultiParts(req);

    if(resultParse.code == 500) {
        res.send(resultParse);
        return;
    }

    // 데이터 파싱 완료 시 저장
    if(resultParse.code == 200){
        // 데이터를 담는 hashMap
        const dataMap = resultParse.dataMap;

        // sql파일 읽어오기
        fs.readFile(__dirname + '/userInfoSql.xml','utf8', function(err, data) {
            if (err) { 
                console.log(err);
                res.send({"code":500, "msg" : "xml파일 읽어오기 중 에러", "error": "" + err})
                return;
            } else {
                // sql 파일 파싱
                digester.digest(data, async function(err, resultPaserSql) {
                    if (err) {
                        console.log(err);
                        res.send({"code":500, "msg" : "xml파일 파싱 중 에러", "error": "" + err})
                        return;
                    } else {
                        // ipfs 데이터 저장
                        let ipfsResult = null;

                        if(resultParse.fileMap != null){
                            ipfsResult = await ipfs.uploadImageToIpfs(resultParse.fileMap);
                            
                            console.log(ipfsResult)
                            console.log("순서11");
                
                            if(ipfsResult.code == 500){
                                res.send(ipfsResult);
                                return;
                            }
                        }
                                        
                        // 저장할 데이터
                        const datas = [(ipfsResult != null?ipfsResult.fileHashs:null), dataMap.get("user_addr")];
                
                        console.log(datas);
                                
                        // sql 실행
                        const updateUserProfileResult = await userInfoSqlHandeler.updateUserProfile(datas);
                        
                        res.send(updateUserProfileResult);
                        return;
                    }
                });
            }
        });
    } else {
    // 데이터 파싱 실패 시 응답 반환
        res.send(resultParse)
    }
});

/* 
    역할: 사용자 정보를 삭제한다.
*/
router.post('/deleteUserInfo', async function(req,res) {
    // 클라이언트가 보낸 회원정보 정보를 파싱한다.
    // 반환 => 자바스크립트 객체: {"code":200, "msg" : "데이터 및 파일 파싱 완료", "dataMap" : dataMap, "fileMap" : fileMap}
    const resultParse = await parser.parseMultiParts(req);
    if(resultParse.code == 500) {
        res.send(resultParse);
        return;
    }

    // 데이터 파싱 완료 시 저장
    if(resultParse.code == 200){
        // 데이터를 담는 hashMap
        const dataMap = resultParse.dataMap;

        // sql파일 읽어오기
        fs.readFile(__dirname + '/userInfoSql.xml','utf8', function(err, data) {
            if (err) { 
                console.log(err);
                res.send({"code":500, "msg" : "xml파일 읽어오기 중 에러", "error": "" + err})
                return;
            } else {
                // sql 파일 파싱
                digester.digest(data, async function(err, resultPaserSql) {
                    if (err) {
                        console.log(err);
                        res.send({"code":500, "msg" : "xml파일 파싱 중 에러", "error": "" + err})
                        return;
                    } else { 
                        // 삭제할 데이터
                        const datas = [dataMap.get("user_addr")];
                                                
                        // sql 실행
                        const deleteUserInfoResult = await userInfoSqlHandeler.deleteUserInfo(datas);
                        
                        res.send(deleteUserInfoResult);
                    }
                });
            }
        });
    } else {
    // 데이터 파싱 실패 시 응답 반환
        res.send(resultParse)
        return
    }
});

// 특정 계정이 가지고 있는 코인, 토큰별 총액 조회
router.get('/selectAddrAmountUsingAddr', async function(req,res){  
    try{
        const account = req.query.addr;

        const result = await blockchain.selectAccountAmountInfo(account)
    
        res.send(result)
    } catch(err){
        res.send(err);
    }
});

// 특정 계정의 블록체인 정보 조회
router.get('/selectAddrInfoUsingAddr', async function(req,res){  
    try{
        const account = req.query.addr;

        const result = await blockchain.selectAccountInfo(account)
    
        res.send(result)
    } catch(err){
        res.send(err);
    }
});

// 특정 사용자가 특정 app에 투표했는지 여부 확인
router.get('/selectIsVoting', async function(req,res){  
    let dataMap = new HashMap();

    const userAddr = req.query.user_addr;
    const appId = req.query.app_id;

    dataMap.set("app_id", appId);
    dataMap.set("user_addr", userAddr);

    const result = await vote.selectIsVoting(dataMap);

    res.send(result)
});

// 모든 글 조회(writer_addr이 있다면 내가 작성한 글만 조회)
router.get('/selectAllPost', async function(req,res){  
    // sql파일 읽어오기
    fs.readFile(__dirname + '/userInfoSql.xml','utf8', function(err, data) {
        if (err) { 
            console.log(err);
            res.send({"code":500, "msg" : "xml파일 읽어오기 중 에러", "error": "" + err})
            return;
        } else {
            // sql 파일 파싱
            digester.digest(data, async function(err, resultPaserSql) {
                if (err) {
                    console.log(err);
                    res.send({"code":500, "msg" : "xml파일 파싱 중 에러", "error": "" + err})
                    return;
                } else {            
                    let dataMap = new HashMap();

                    const userAddr = req.query.user_addr;
                    const searchData = req.query.search_data;
                    const searchPageNo = Number(req.query.search_page);


                    if(userAddr != undefined && userAddr != null) {
                        dataMap.set("user_addr", userAddr);
                    }

                    if(searchData != undefined && searchData != null) {
                        dataMap.set("search_data", '%' + searchData + '%');
                    }

                    dataMap.set("search_page_no", searchPageNo);
        
                    // sql 실행
                    try{
                        const selectAllPostResult = await userInfoSqlHandeler.selectAllPost(dataMap);
                        console.log(selectAllPostResult);

                        // 투표 정보 조회
                        if(selectAllPostResult.code == 200) {
                            // 분석 게시글 리스트
                            let allPostList = selectAllPostResult.post_list

                            console.log(allPostList);

                            const result2 = await vote.selectVoteInfoFromPostList(allPostList)

                            if(result2.code == 200) {
                                selectAllPostResult.post_list = result2.post_list;
                                res.send(selectAllPostResult)
                                console.log(selectAllPostResult)
                            } else {
                                res.send(result2)
                            }
                        } else {
                            res.send(result)
                        } 
                    } catch(err){
                        res.send({"code":err.code, "msg" : err.msg, "error": err.error});
                    }
                }
            });
        }
    });
});

/* 
    역할: 사용자 블록체인 계정을 생성하고 특정 토큰을 옵트인한다.
    input: user_id
    output: 니모닉
*/
router.post('/createAddrOnNovarandWithToken', async function(req,res) {
    const token_id = req.body.token_id;

    // 사용자 계정과 니모닉을 저장하는 변수
    let accountAndMnemonic;

    // 1. 새로운 블록체인 계정과 니모닉 생성    
    blockchain.makeBlockchainAddrAndMnemonic()
    .then(async function (value) {
        // 2. 개발사 계정이 생성된 계정에게 Nova 전송(opt-in을 위한 최소 Nova)
        accountAndMnemonic = value;
        await blockchain.sendToAddrByDevAddrWithAmount(accountAndMnemonic.account.addr,201000)
    }).catch((error) => {console.log(error)})
    .then(async function () {
        // 3. 생성된 계정 bubble 토큰에 옵트인
        console.log("mnemonic: " + accountAndMnemonic.mnemonic);

        await blockchain.tokenOptIn(accountAndMnemonic.mnemonic,token_id)
    }).catch((error) => {console.log(error)})
    .then(async function () {
        console.log("5");
        res.send({"mnemonic": accountAndMnemonic.mnemonic, "addr": accountAndMnemonic.account.addr});
    }).catch((error) => {console.log(error)})
})