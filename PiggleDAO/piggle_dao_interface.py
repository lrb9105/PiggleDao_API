# -*- coding: utf-8 -*-
import time
from algosdk import mnemonic
from piggle_dao import vote_contract

import FinanceDataReader as fdr
import pandas as pd

from algosdk.future import transaction as algo_txn
from algosdk.v2client import algod
from flask import Flask, request,jsonify

from algosdk.atomic_transaction_composer import *
from pyteal import *

from piggle_dao import (routerex)

from datetime import datetime
from piggle_dao import staking

now = datetime.now()

app = Flask(__name__)

# 니모닉으로부터 pk를 반환한다.
def getPK(mn) :
    account_private_key = mnemonic.to_private_key(mn)
    print("Private Key: ", account_private_key)
    return account_private_key

# 투표프로그램 배포
@app.route('/createVoteApp', methods=['POST'])
def createVoteApp():
    # teal파일 생성할 위치
    approval_program_path = "piggle_dao/contract/vote_approval_" + f'{now.timestamp()}'.replace('.','_') +".teal"
    clear_program_path = "piggle_dao/contract/vote_clear_state_" + f'{now.timestamp()}'.replace('.','_') +".teal"
    
    print(approval_program_path)
    print(clear_program_path)
    
    # 해당 위치에 teal파일 생성(pyteal to teal 컴파일)
    try:
        with open(approval_program_path, "w") as f:
            compiled = compileTeal(vote_contract.approval_program(), mode=Mode.Application, version=5)
            f.write(compiled)
        
        with open(clear_program_path, "w") as f:
            compiled = compileTeal(vote_contract.clear_state_program(), mode=Mode.Application, version=5)
            f.write(compiled)
            
        # 생성한 tealfile path 반환
        return jsonify(code=200, msg='투표 애플리케이션 Teal파일 생성을 성공했습니다', approval_program_path=approval_program_path, clear_program_path=clear_program_path)
    except Exception as err:
        print(err)
        return jsonify(code=500, msg="투표 애플리케이션 Teal파일 생성에 실패했습니다", error=err)

# 주가데이터 받아오기
@app.route('/getStockPriceList', methods=['POST'])
def getStockPriceList():
    try:
        # 종목코드 배열
        stock_code_arr = request.args['stock_code_arr_str'].split(',')
        
        # Open: 시가, Close: 종가
        type = request.args['type']
        
        # 날짜(yyyy-mm-dd)
        date = request.args['date']
        
        stock_list = []
        # 반복문 돌려서 key:종목코드, val:종목코드인 2차원 딕셔너리 만들기
        for stock_code in stock_code_arr: 
            stock_info = [stock_code, stock_code]
            stock_list.append(stock_info)
                
        # stock_list에 들어있는 각 종목의 시가/종가 조회
        df_list = [fdr.DataReader(code, date)[type] for name, code in stock_list]
        
        # 조회한 가격리스트 한줄로 출력되도록 형태 변경
        df = pd.concat(df_list, axis=1)
        df.columns = [name for name, code in stock_list] 
        df.head(1)
        
        price_dict = {}
        # 가격정보가 들어있는 딕셔너리 만들기(key: 종목코드, val: 가격)
        for stock_code in stock_code_arr: 
            price_dict[stock_code] = str(df.at[date, stock_code])
            
        return jsonify(code=200, msg="종목 조회 성공", price_dict=price_dict)
    except Exception as err:
        print(err)
        return jsonify(code=500, msg="종목 조회 실패", error=str(err))
    

#직접 실행시에 아래 코드가 실행됨!
if __name__ == '__main__':
   app.run('127.0.0.1',port=5000,debug=True)
   
   
'''
# 컨트랙트 생성
@app.route('/createApp', methods=['POST'])
def createApp():
    # 
    creator_mnemonic = request.args['creator_mnemonic']
    token = request.args['token']
    address = request.args['ip_address']
    
    # callApp
    result = routerex.create_new_app(creator_mnemonic, token, address)
    
    return result

# 컨트랙트 메소드 호출
@app.route('/callApp', methods=['POST'])
def call_app():
    caller_mnemonic = request.args['mnemonic']
    caller_addr = request.args['addr']
    token = request.args['token']
    address = request.args['ip_address']
    app_id = int(request.args['app_id'])
    method_name = request.args['method_name']
    
    # callApp
    txId = routerex.call_app(caller_mnemonic, token, address, caller_addr, app_id, method_name)
    
    return jsonify(result='success', txid=txId)

# 스테이킹풀 생성
@app.route('/createStakingPool', methods=['POST'])
def createStakingPool():
    creator_mnemonic = request.args['mnemonic']
    token = request.args['token']
    address = request.args['ip_address']
    asset_id = int(request.args['asset_id'])
    print(str(asset_id))
    creator_addr = request.args['creator_addr']
    
    # 스테이킹풀 생성 및 초기화
    result = staking.create_pool(token, address, asset_id, creator_addr, creator_mnemonic)
    
    return result

@app.route('/initPool', methods=['POST'])
def initPool():
    creator_mnemonic = request.args['mnemonic']
    token = request.args['token']
    address = request.args['ip_address']
    app_id = int(request.args['app_id'])
    creator_addr = request.args['creator_addr']
    
    # initialize an algodClient
    algod_client = algod.AlgodClient(token, address)
    
    # 스테이킹풀 초기화
    result = staking.init_pool(algod_client, app_id, creator_addr, creator_mnemonic)
    
    return result

# 토큰 스테이킹
@app.route('/deposit', methods=['POST'])
def deposit():
    staker_mnemonic = request.args['mnemonic']
    staker_addr = request.args['staker_addr']
    app_id = int(request.args['app_id'])
    token = request.args['token']
    address = request.args['ip_address']
    amount = int(request.args['amount'])
    
    # 토큰 스테이킹
    result = staking.deposit(staker_addr, token, address, app_id, amount, staker_mnemonic)
    
    return result

# 토큰 계정으로 전송
@app.route('/withdraw', methods=['POST'])
def withdraw():
    dev_mnemonic = request.args['mnemonic']
    dev_addr = request.args['dev_addr']
    token = request.args['token']
    address = request.args['ip_address']
    app_id = int(request.args['app_id'])
    staker_addr = request.args['staker_addr']
    amount = int(request.args['amount'])
    
    # 토큰 전송
    result = staking.withdraw(staker_addr, app_id, token, address, amount, dev_addr, dev_mnemonic)
    
    return result
'''