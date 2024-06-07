// 파일 읽어오기 위한 객체
const fs = require('fs'); 
const path = require("path");

const ipfs = require("../util/ipfs");
const time = require("../util/time");


// 쿼리 핸들러
const forecastSqllHandeler = require("./forecastSqlHandeler");

// ipfs에 게시글 이미지 정보를 저장한다. 
// 저장된 이미지들의 cid를 ','로 연결한 fileNames반환
const createForecastPostImage = function (fileMap) {
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

// 주가예측 게시글 작성
const createForecastPost = function (dataMap) {
    return new Promise(async(resolve, reject)=>{
        // 게시글 html 데이터
        const contents = dataMap.get("contents");

        // 게시글 html 데이터 ipfs에 저장
        let saveInfo = await ipfs.uploadFileToIpfs(contents);

        if(saveInfo.code == 200) {
            // 저장할 데이터 배열
            let datas = [dataMap.get('forecast_date'),
                         dataMap.get('stock_code'),
                         dataMap.get('stock_type'),
                         Number(dataMap.get('expectation_price')),
                         dataMap.get('title'),
                         dataMap.get('writer_addr'),
                         'y',
                         dataMap.get('file_hashs') == ""?null:dataMap.get('file_hashs'),
                         Number(dataMap.get('app_id')),
                         dataMap.get('preview_text'),
                         saveInfo.fileHash,
                         '0',
                         time.timeToKr()];

            // db에 정보 저장
            let createForecastPostResult = await forecastSqllHandeler.createForecastPost(datas);
            return resolve(createForecastPostResult);

        } else {
            return resolve(saveInfo);
        }
    });
};

// 주가예측 게시글 수정
const updateForecastPost = function (dataMap) {
    return new Promise(async(resolve, reject)=>{
        try{
            const postNo = Number(dataMap.get("post_no"));

            const newFileHashs = dataMap.get("file_hashs");

            // 기존 게시글 정보 조회
            let selectForecastPostResult = await forecastSqllHandeler.selectForecastPostDetail([postNo]);

            if(selectForecastPostResult.code == 500) {
                return resolve(selectForecastPostResult);
            }
            
            // 게시글 정보
            const forecastPostInfo = selectForecastPostResult.forecast_post_info
            
            // ipfs의 내용 hash
            let contentsHash = forecastPostInfo.contents_hash
    
            // ipfs의 이미지 hash
            let fileHashs = forecastPostInfo.file_hashs
    
            // 미리보기용 텍스트
            let previewText = forecastPostInfo.preview_text

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
                        postNo
                        ];
    
            // db에 정보 업데이트
            let updateForecastPostResult = await forecastSqllHandeler.updateForecastPost(datas);
    
            return resolve(updateForecastPostResult)
        } catch(err) {
            console.log(err)
            return resolve({"code": 500, "msg": "updateForecastPost 에러 발생", "error" : "" + err})
        }
    });
}

// 주가예측 게시글 삭제
const deleteForecastPost = async function (dataMap) {
    return new Promise(async(resolve, reject)=>{
        const postNo = Number(dataMap.get("post_no"));

        // db 정보 삭제
        let deleteForecastPostResult = await forecastSqllHandeler.deleteForecastPost([postNo]);
        return resolve(deleteForecastPostResult);;
    });
}

// 주가예측 게시글 리스트 조회(투표 진행중, 종료 나눠야 함)
const selectForecastPostList = function (dataMap) {
    return new Promise(async(resolve, reject)=>{
        const isVotingYn = dataMap.get("is_voting_yn");

        const searchPageNo = Number(dataMap.get("search_page"));

        const datas = [isVotingYn, (searchPageNo - 1)* global.pagingNo, global.pagingNo]
    
        // db에서 조회
        let selectForecastPostResult = await forecastSqllHandeler.selectForecastPostList(datas);
        return resolve(selectForecastPostResult);
    });
}

// 주가예측 게시글 리스트 검색(제목, 종목명, 종목코드, 작성자 닉네임)
const searchForecastPostList = function (dataMap) {
    return new Promise(async(resolve, reject)=>{
        const searchPageNo = Number(dataMap.get("search_page"));
        const searchData = dataMap.get("search_data");
        console.log(searchData);

        // 네가지 속성에서 동일한 검색어로 검색하기 때문에 동일한 데이터를 네번 넣어줌
        const datas = [ '%' + searchData + '%', 
                        '%' + searchData + '%', 
                        '%' + searchData + '%', 
                        '%' + searchData + '%',
                       (searchPageNo - 1)* global.pagingNo, 
                       global.pagingNo
                    ]
        
        // db에서 조회
        let searchForecastPostListResult = await forecastSqllHandeler.searchForecastPostList(datas);
        return resolve(searchForecastPostListResult);
    });
}

// 주가예측 게시글 상세조회
const selectForecastPostDetail = function (dataMap) {
    return new Promise(async(resolve, reject)=>{
        const postNo = dataMap.get("post_no");
        
        // db에서 조회
        let searchForecastPostListResult = await forecastSqllHandeler.selectForecastPostDetail([postNo]);
        return resolve(searchForecastPostListResult);
    });
}

module.exports = { 
    createForecastPostImage,
    createForecastPost,
    updateForecastPost,
    deleteForecastPost,
    selectForecastPostList,
    searchForecastPostList,
    selectForecastPostDetail
};