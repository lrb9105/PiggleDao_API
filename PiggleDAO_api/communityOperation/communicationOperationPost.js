// 파일 읽어오기 위한 객체
const fs = require('fs'); 
const path = require("path");

const ipfs = require("../util/ipfs");
const time = require("../util/time");

// 쿼리 핸들러
const communityOperationSqlHandeler = require("./communityOperationSqlHandeler");

// ipfs에 게시글 이미지 정보를 저장한다. 
// 저장된 이미지들의 cid를 ','로 연결한 fileNames반환
const createCommunityOperationPostImage = function (fileMap) {
    return new Promise(async(resolve, reject)=>{
        let ipfsResult = null;

        // ipfs에 게시글 이미지 저장
        if(fileMap != null){
            /* 
                성공 반환데이터: "code":200, "msg" : "ipfs에 파일저장 완료", "fileHashs" : fileHashs
                실패 반환데이터: "code":500, "msg" : "ipfs에 파일저장 중 에러 발생", "error": "" + err
            */            
            ipfsResult = await ipfs.uploadImageToIpfs(fileMap);

            // 성공적으로 저장했다면 게이트웨이로 접근할 수 있는 hash값을 http url로 변경한다.
            if(ipfsResult.code == 200) {
                let fileHashArr

                if(ipfsResult.fileHashs != null) {
                    fileHashArr = ipfsResult.fileHashs.split(",");
                }
                
                try{
                    const result = await ipfs.changeDataToHttp(fileHashArr)
                    ipfsResult.fileHttpUrlArr = result.fileHttpUrlArr
                } catch(err){
                    console.log(err)
                    return resolve(err)
                }
            } else {
                return resolve(ipfsResult)
            }
            // 성공 반환데이터: "code":200, "msg" : "ipfs에 파일저장 완료", "fileHashs" : fileHashs, "fileHttpUrlArr" : fileHttpUrlArr
            return resolve(ipfsResult);
        }
    });
}

// 커뮤니티 운영 게시글 작성
const createCommunityOperationPost = function (dataMap) {
    return new Promise(async(resolve, reject)=>{
        // 게시글 html 데이터
        const contents = dataMap.get("contents");

        // 게시글 html 데이터 ipfs에 저장
        let saveInfo
        try{
            saveInfo = await ipfs.uploadFileToIpfs(contents);
        } catch(err) {
            return resolve(err)
        }

        if(saveInfo.code == 200) {
            // 저장할 데이터 배열
            let datas = [dataMap.get('voting_srt_date'),
                         dataMap.get('voting_end_date'),
                         dataMap.get('title'),
                         saveInfo.fileHash,
                         dataMap.get('writer_addr'),
                         'y',
                         dataMap.get('file_hashs') == ""?null:dataMap.get('file_hashs'),
                         Number(dataMap.get('app_id')),
                         dataMap.get('preview_text'),
                         '1',
                         time.timeToKr()];

            // db에 정보 저장
            let createCommunityOperationPostResult;
            
            try{
                createCommunityOperationPostResult = await communityOperationSqlHandeler.createCommunityOperationPost(datas);
                return resolve(createCommunityOperationPostResult);
            } catch(err){
                console.log(err);
                return resolve(err);
            }
        } else {
            return resolve(saveInfo);
        }
    });
};

// 커뮤니티 운영 게시글 수정
const updateCommunityOperationPost = function (dataMap) {
    return new Promise(async(resolve, reject)=>{
        try{
            const postNo = dataMap.get("post_no");

            const newFileHashs = dataMap.get("file_hashs");

            // 기존 게시글 정보 조회
            let selectCommunityOperationPostResult = await communityOperationSqlHandeler.selectCommunityOperationPostDetail([postNo]);
            
            if(selectCommunityOperationPostResult.code == 500) {
                return resolve(selectCommunityOperationPostResult);
            }

            // 게시글 정보
            const communityOperationPostInfo = selectCommunityOperationPostResult.community_operation_post_info
            
            // ipfs의 내용 hash
            let contentsHash = communityOperationPostInfo.contents_hash

            // ipfs의 이미지 hash
            let fileHashs = communityOperationPostInfo.file_hashs

            // 미리보기용 텍스트
            let previewText = communityOperationPostInfo.preview_text

            if(newFileHashs != undefined && newFileHashs != null ) {
                fileHashs = newFileHashs;
            }

            // 게시글을 수정한다면
            let contents = dataMap.get("contents");
            if(contents != null && contents != undefined) {
                previewText = dataMap.get("preview_text");
                // 기존에 저장한 게시글 정보가 있다면 
                // ipfs에 있는 게시글 데이터 삭제 && 새로운 게시글 파일 업로드
                let result;

                if(contentsHash != null) {
                    result = await ipfs.uploadFileToIpfs(contents)
                } 

                if(result.code == 200 ){
                    contentsHash = result.fileHash
                } else {
                    resolve(result)
                }
            }

            // 저장할 데이터 배열
            let datas = [contentsHash,
                        fileHashs,
                        previewText,
                        time.timeToKr(),
                        Number(postNo)
                        ];

            // db에 정보 업데이트
            let updateCommunityOperationPostResult = await communityOperationSqlHandeler.updateCommunityOperationPost(datas);
            return resolve(updateCommunityOperationPostResult);
        } catch(err) {
            console.log(err)
            return resolve({"code": 500, "msg": "updateCommunityOperationPost 에러 발생", "error" : "" + err})
        }
    });
}

// 커뮤니티 운영 게시글 삭제
const deleteCommunityOperationPost = async function (dataMap) {
    return new Promise(async(resolve, reject)=>{
        const postNo = Number(dataMap.get('post_no'));

        // db 정보 삭제
        let deleteCommunityOperationPostResult = await communityOperationSqlHandeler.deleteCommunityOperationPost([postNo]);
        return resolve(deleteCommunityOperationPostResult);
    });
}

// 커뮤니티 운영 게시글 리스트 조회(투표 진행중, 종료 나눠야 함)
const selectCommunityOperationPostList = function (dataMap) {
    return new Promise(async(resolve, reject)=>{
        const isVotingYn = dataMap.get("is_voting_yn");

        const searchPageNo = Number(dataMap.get("search_page"));

        const datas = [isVotingYn, (searchPageNo - 1)* global.pagingNo, global.pagingNo]

        // db에서 조회
        let selectCommunityOperationPostResult = await communityOperationSqlHandeler.selectCommunityOperationPostList(datas);
        return resolve(selectCommunityOperationPostResult);
    });
}

// 커뮤니티 운영 게시글 리스트 검색(제목, 종목명, 종목코드, 작성자 닉네임)
const searchCommunityOperationPostList = function (dataMap) {
    return new Promise(async(resolve, reject)=>{
        const searchPageNo = Number(dataMap.get("search_page"));
        const searchData = dataMap.get("search_data");

        // 두가지 속성에서 동일한 검색어로 검색하기 때문에 동일한 데이터를 두번 넣어줌
        const datas = [ '%' + searchData + '%', 
                        '%' + searchData + '%', 
                       (searchPageNo - 1)* global.pagingNo, 
                       global.pagingNo
                    ]
        
        // db에서 조회
        let searchCommunityOperationPostListResult = await communityOperationSqlHandeler.searchCommunityOperationPostList(datas);
        return resolve(searchCommunityOperationPostListResult);
    });
}

// 커뮤니티 운영 게시글 상세조회
const selectCommunityOperationPostDetail = function (dataMap) {
    return new Promise(async(resolve, reject)=>{
        const postNo = dataMap.get("post_no");
        
        // db에서 조회
        let searchCommunityOperationPostListResult = await communityOperationSqlHandeler.selectCommunityOperationPostDetail([postNo]);
        return resolve(searchCommunityOperationPostListResult);
    });
}

module.exports = { 
    createCommunityOperationPostImage,
    createCommunityOperationPost,
    updateCommunityOperationPost,
    deleteCommunityOperationPost,
    selectCommunityOperationPostList,
    searchCommunityOperationPostList,
    selectCommunityOperationPostDetail
};