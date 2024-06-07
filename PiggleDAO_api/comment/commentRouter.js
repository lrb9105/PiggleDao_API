// express.Router를 사용하기 위해 express exports를 가져옴!
const express = require("express");
const comment = require('./comment')
const HashMap  = require ('hashmap') ;
// 클라이언트가 보낸 데이터를 파싱
const parser = require("../util/parser")

// Router를 사용하기 위해 express.Router()호출
const router = express.Router();

// 외부에서 사용하기 위해 router를 넣어줌!
module.exports = router;

// 댓글 저장
router.post('/createComment',async function(req,res){
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
            - post_no: 댓글을 작성할 게시글 번호
            - writer_addr: 댓글 작성자 계정주소
            - comment_contents: 댓글 내용
            - post_type: 댓글을 작성할 게시글 타입('0': 주가 예측글, '1': 커뮤니티 운영글, '2': 분석글)
         */
        const dataMap = resultParse.dataMap;

        result = await comment.createComment(dataMap)

        res.send(result)
    } catch(err) {
        res.send(err);
    }
});

// 댓글 수정
router.post('/updateComment',async function(req,res){
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
            - comment_contents: 수정할 댓글 내용
            - comment_no: 댓글 번호
         */
        const dataMap = resultParse.dataMap;

        /*  댓글 수정
            반환값: {"code":200, "msg" : "댓글 정보 수정 완료", "comment_no" : 수정한 댓글 번호}
        */
        let result = await comment.updateComment(dataMap)
        
        res.send(result)
    } catch(err) {
        res.send(err);
    }
});

// 댓글 삭제
router.post('/deleteComment',async function(req,res){
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
            - comment_no: 삭제할 댓글 번호
         */
            const dataMap = resultParse.dataMap;

        /*  댓글 삭제
            반환값: {"code":200, "msg" : "댓글 정보 삭제 완료", "comment_no" : 삭제한 댓글 번호}
        */
        let result = await comment.deleteComment(dataMap)
        
        res.send(result)
    } catch(err) {
        res.send(err);
    }
});

// 특정 게시글의 댓글리스트 조회(테스트용)
router.get('/selectCommentList', async function(req,res){  
    try{
        let dataMap = new HashMap();
        
        // 조회할 게시글 번호
        dataMap.set("post_no", req.query.post_no)
        // 게세글 타입('0': 주가 예측글, '1': 커뮤니티 운영글, '2': 분석글)
        dataMap.set("post_type", req.query.post_type)

        /*  댓글 삭제
            반환값: 댓글정보 있음 - {"code":200, "msg" : "댓글 리스트 조회 완료", "comment_list": rows}
                    댓글정보 없음 - {"code":200, "msg" : "댓글 리스트 조회 완료(데이터 없음)", "comment_list": null}
        */
        let result = await comment.selectCommentList(dataMap)
        
        res.send(result)
    } catch(err) {
        res.send(err);
    }
});