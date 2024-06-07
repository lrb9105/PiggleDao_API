// express.Router를 사용하기 위해 express exports를 가져옴!
const express = require("express");

// 클라이언트가 보낸 데이터를 파싱
const parser = require("../util/parser")

// await analysisPost.js
const analysisPost = require("./analysisPost")
const comment = require("../comment/comment")
const HashMap  = require ('hashmap') ;

const smartcontract = require("../smartcontract/smartcontract");
const vote = require("../vote/vote");
const staking = require("../staking/staking");

// 파일 읽어오기 위한 객체
const fs = require('fs'); 
const path = require("path");
const jsonFile = fs.readFileSync(path.resolve(__dirname, "../smartcontract/config.json"));
const configJson = JSON.parse(jsonFile);


// Router를 사용하기 위해 express.Router()호출
const router = express.Router();

// 외부에서 사용하기 위해 router를 넣어줌!
module.exports = router;

// 분석글 작성 시 사용된 이미지 저장
router.post('/createAnalysisPostImage',async function(req,res){
    /*  사용자가 보낸 formData 파싱
            반환값: {"code":200, "msg" : "데이터 및 파일 파싱 완료", "dataMap" : dataMap, "fileMap" : fileMap}
            fileMap: 사용자가 보낸 파일정보를 저장하는 hashmap 
    */
    const resultParse = await parser.parseMultiParts(req);

    if(resultParse.code == 200) {
        /*  게시글 작성 시 사용된 이미지 저장
            반환값: {"code":200, "msg" : "ipfs에 파일저장 완료", "fileHashs" : fileHashs, "fileHttpUrlArr" : fileHttpUrlArr}
            fileHashs: ipfs에 저장되고 반환된 hash값(cid)를 ','로 연결한 문자열
            fileHttpUrlArr: cid를 http로 접근할 수 있도록 만든 url 
        */
        let result = await analysisPost.createAnalysisPostImage(resultParse.fileMap)
    
        res.send(result)
    } else {
        res.send(resultParse)
    }
});

// 분석글 저장
router.post('/createAnalysisPost',async function(req,res){
    try{
        /*  사용자가 보낸 formData 파싱
            반환값: {"code":200, "msg" : "데이터 및 파일 파싱 완료", "dataMap" : dataMap, "fileMap" : fileMap}
            dataMap: 사용자가 보낸 속성값을 저장하는 hashmap
        */
        const resultParse = await parser.parseMultiParts(req);
        if(resultParse.code == 500) {
            res.send(resultParse);
            return;
        }
        
        /**
         * dataMap에 들어있는 값
            - analysis_post_cre_date: 분석글 작성일 yyyy-MM-dd
            - stock_code: 분석할 주식코드
            - title: 게시글 제목
            - writer_addr: 글작성자의 계정 주소
            - file_hashs: createAnalysisPostImage()에서 반환된 fileHashs
            - preview_text: 미리보기에서 사용할 텍스트(200자 제한)
            - contents: 게시글 html
            - analysis_type: 분석글 타입 - 시황분석, 종목분석, 시장분석, 지수분석
            -   : 분석글 투표 마감일 yyyy-MM-dd
         */
        const dataMap = resultParse.dataMap;

        /**
         * 스마트 컨트랙트 배포(app_id 반환) 
        */
        // 글 작성자 계정
        const writer_addr = dataMap.get("writer_addr");

        // 작성 글종류(0: 주가예측글, 1: 운영글, 2: 분석글)
        const type = "2";

        let createVoteAppResult = await smartcontract.createVoteApp(writer_addr, type)

        if(createVoteAppResult.code == 200) {
            // 토큰 스테이킹
            const mnemonic = dataMap.get("mnemonic");

            // 앱 id
            const app_id = Number(createVoteAppResult.appId);

            // 종료일(yyyynndd)
            const expDate = dataMap.get("exp_date");
            
            // 스테이킹 계정 주소
            const staking_addr = configJson.SmartContractParams.staking_addr;

            // asset_id
            const assetId = Number(configJson.SmartContractParams.token_id);

            let result  = await staking.stakingAmount(mnemonic, staking_addr, assetId, global.tokenAmount, app_id, expDate, type);

            if(result.code == 200){
                // dataMap에 app_id 넣기
                dataMap.set("app_id", createVoteAppResult.appId);

                /*  게시글 ipfs에 저장 && db에 게시글 관련 데이터 저장
                    반환값: {"code":200, "msg" : "db에 주가예측 데이터 저장 완료", "analysis_post_no": 생성한 게시글 번호}
                */
                const result2 = await analysisPost.createAnalysisPost(dataMap)

                res.send(result2)
            } else {
                res.send(result)
            }
        } else {
            res.send(createVoteAppResult)
        }        
    } catch(err) {
        console.log(err)
        res.send({"code" : 500, "msg" : "createAnalysisPost 실패", "error" : "" + err});
    }
});

// 분석글 수정
router.post('/updateAnalysisPost',async function(req,res){
    try{
        /*  사용자가 보낸 formData 파싱
            반환값: {"code":200, "msg" : "데이터 및 파일 파싱 완료", "dataMap" : dataMap, "fileMap" : fileMap}
            dataMap: 사용자가 보낸 속성값을 저장하는 hashmap
            fileMap: 사용자가 보낸 파일정보를 저장하는 hashmap 
        */
        const resultParse = await parser.parseMultiParts(req);
        if(resultParse.code == 500) {
            res.send(resultParse);
            return;
        }

        /** dataMap에 들어있는 값
         *  postNo: 수정할 게시글 번호
            contents: 수정할 내용(있을수도 없을수도 있음)
            previewText: 수정할 미리보기 내용(contents를 수정한다면 반드시 보내야 함)
         * 
         */
        let dataMap = resultParse.dataMap;

        /*  게시글 정보 수정
            반환값: {"code":200, "msg" : "주가예측 정보 수정 완료", "analysis_post_no" : 수정한 게시글 번호}
        */
        let result = await analysisPost.updateAnalysisPost(dataMap)
        
        res.send(result)
    } catch(err) {
        console.log(err)
        res.send({"code" : 500, "msg" : "updateAnalysisPost 실패", "error" : "" + err});
    }
});

// 분석글 삭제
router.post('/deleteAnalysisPost',async function(req,res){
    try{
        /*  사용자가 보낸 formData 파싱
            반환값: {"code":200, "msg" : "데이터 및 파일 파싱 완료", "dataMap" : dataMap, "fileMap" : fileMap}
            dataMap: 사용자가 보낸 속성값을 저장하는 hashmap
        */
        const resultParse = await parser.parseMultiParts(req);
        if(resultParse.code == 500) {
            res.send(resultParse);
            return;
        }

        /** dataMap에 들어있는 값
         *  postNo: 삭제할 게시글 번호
         */
         const dataMap = resultParse.dataMap;

         /*  게시글 정보 삭제
             반환값: {"code":200, "msg" : "주가예측 정보 삭제 완료", "analysis_post_no" : 삭제한 게시글 번호}
         */
        let result = await analysisPost.deleteAnalysisPost(dataMap)
        
        res.send(result)
    } catch(err) {
        console.log(err)
        res.send({"code" : 500, "msg" : "deleteAnalysisPost 실패", "error" : "" + err});
    }
});

// 분석글 전체조회(투표진행중, 종료 나눠서 조회)
router.get('/selectAnalysisPostList', async function(req,res){  
    try{
        let dataMap = new HashMap();

        // 투표 여부
        dataMap.set("is_voting_yn", req.query.is_voting_yn)

        // 조회할 페이지 번호
        dataMap.set("search_page", req.query.search_page)
        
        /*  게시글 정보 조회
            반환값: 조회 데이터 있음 - {"code":200, "msg" : "분석글 정보 조회 완료", "analysis_post_list": rows}
                    조회 데이터 없음 - {"code":200, "msg" : "분석글 정보 조회 완료(데이터 없음)", "analysis_post_list": null}        
        */
        let result = await analysisPost.selectAnalysisPostList(dataMap)
        
        // 투표 정보 조회
        if(result.code == 200) {
            // 분석 게시글 리스트
            let analysisPostList = result.analysis_post_list
            
            if(analysisPostList != null) {
                const result2 = await vote.selectVoteInfoFromPostList(analysisPostList)
                if(result2.code == 200) {
                    result.analysis_post_list = result2.post_list;
                    res.send(result)
                } else {
                    res.send(result2)
                }
            } else {
                res.send(result)
            }
        } else {
            res.send(result)
        }
    } catch(err) {
        console.log(err)
        res.send({"code" : 500, "msg" : "selectAnalysisPostList 실패", "error" : "" + err});
    }
});

// 분석글 검색(제목, 종목, 종목코드, 작성자 like 검색)
router.get('/searchAnalysisPostList', async function(req,res){  
    try{
        let dataMap = new HashMap();

        // 조회할 페이지 번호
        dataMap.set("search_page", req.query.search_page)
        // 검색어
        dataMap.set("search_data", req.query.search_data) 

        /*  게시글 정보 조회
            반환값: 조회 데이터 있음 - {"code":200, "msg" : "분석글 정보 조회 완료", "analysis_post_list": rows}
                    조회 데이터 없음 - {"code":200, "msg" : "분석글 정보 조회 완료(데이터 없음)", "analysis_post_list": null}        
        */
        let result = await analysisPost.searchAnalysisPostList(dataMap)

        // 투표 정보 조회
        if(result.code == 200) {
            // 분석 게시글 리스트
            let analysisPostList = result.analysis_post_list

            if(analysisPostList != null) {
                const result2 = await vote.selectVoteInfoFromPostList(analysisPostList)
                if(result2.code == 200) {
                    result.analysis_post_list = result2.post_list;
                    res.send(result)
                } else {
                    res.send(result2)
                }
            } else {
                res.send(result)
            }
        } else {
            res.send(result)
        }        
    } catch(err) {
        console.log(err)
        res.send({"code" : 500, "msg" : "searchAnalysisPostList 실패", "error" : "" + err});
    }
});

// 분석글 상세조회(댓글도 함께 조회)
router.get('/selectAnalysisPostDetail', async function(req,res){  
    try{
        let dataMap = new HashMap();

        // 조회할 게시글 번호
        dataMap.set("post_no", req.query.post_no)

        // 분석글 상세정보 조회
        let result = await analysisPost.selectAnalysisPostDetail(dataMap)

        // 투표 정보 조회
        if(result.code == 200) {
            // 분석 게시글 리스트
            let analysisPostInfo = result.analysis_post_info

            if(analysisPostInfo != null) {
                const result2 = await vote.selectVoteInfoFromPostList([analysisPostInfo])
                if(result2.code == 200) {
                    result.analysis_post_info = result2.post_list[0];
                } else {
                    res.send(result2)
                    return;
                }
            } else {
                res.send(result)
                return;
            }
            

            // 투표자 정보 가져오기
            const voteInfoMap = new HashMap();

            voteInfoMap.set("limit_yn", 'y');
            voteInfoMap.set("app_id", result.analysis_post_info.app_id);

            console.log("result.app_id")
            console.log(result.analysis_post_info.app_id)

            const voterListInfo = await vote.selectVoterList(voteInfoMap);

            if(voterListInfo.code == 200) {
                result.voter_list = voterListInfo.voter_list;

                // 댓글 리스트 가져오기
                dataMap.set("post_type", "2");

                // 해당 게시글에 달린 댓글 리스트 조회
                const commentListInfo = await comment.selectCommentList(dataMap)

                if(commentListInfo.code == 200) {
                    const commentList = commentListInfo.comment_list
                    result.comment_list = commentList
                    
                    res.send(result)
                } else {
                    console.log(commentListInfo)
                    res.send(commentListInfo)
                }  
            } else {
                res.send(voterListInfo)
            }            
        } else {
            res.send(result)
        }            
    } catch(err) {
        console.log(err)
        res.send({"code" : 500, "msg" : "selectAnalysisPostDetail 실패", "error" : "" + err});
    }
});