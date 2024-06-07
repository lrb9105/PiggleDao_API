from algosdk import constants, encoding, logic, v2client
from algosdk.atomic_transaction_composer import AccountTransactionSigner, AtomicTransactionComposer, TransactionWithSigner
from algosdk.abi import Method, Argument, Returns, Contract
from algosdk.future import transaction
from algosdk.v2client import algod

import base64
from piggle_dao.routerex import getPK
from piggle_dao import staking_contract


# A simple helper function to get the ABI method from the name.
def get_method(c: Contract, name: str) -> Method:
    for m in c.methods:
        if m.name == name:
            return m
    raise Exception("No method with the name {}".format(name))

# 트랜잭션 그룹 실행
def execute_txn(algod_client, pk, txgroup):
    try:
        # 트랜잭션 그룹을 하나로 묶고 gid를 받아온다.
        gid = transaction.calculate_group_id(txgroup)
        
        print("0")
        # 각 트랜잭션에 gid를 넣어준다.
        for tx in txgroup:
            tx.group = gid
    

        print(txgroup)
        print("1")
        
        # 각 트랜잭션을 서명한다.
        signed_txgroup = []
        for tx in txgroup:
            signed_txgroup.append(tx.sign(pk))
        
        print(signed_txgroup)
        print("2")
        # 트랜잭션 전송
        tx_id = algod_client.send_transactions(signed_txgroup)
        
        
        print("3")
        # wait for confirmation
    
        transaction_response = transaction.wait_for_confirmation(algod_client, tx_id, 5)
        print("TXID: ", tx_id)
        print(
            "Result confirmed in round: {}".format(
                transaction_response["confirmed-round"]
            )
        )
        return {"code": 200, "msg": "트랜잭션 실행 완료", "tx_id": tx_id}

    except Exception as err:
        print(err)
        return {"code": 200, "msg": "트랜잭션 실행 실패", "error": err}

def compile_program(client, source_code):
    compile_response = client.compile(source_code)
    return base64.b64decode(compile_response["result"])

# staking pool 생성
def create_pool(token, address, asset_id, creator_addr, creator_mnemonic):
    # 1. 속성값 세팅
    try:
        # initialize an algodClient
        algod_client = algod.AlgodClient(token, address)
        
        # 스테이킹풀 생성자 pk
        creator_pk = getPK(creator_mnemonic)
        
        # Fetch suggested parameters.
        sp = algod_client.suggested_params()
        sp.flat_fee = True
        sp.fee = constants.MIN_TXN_FEE
        
        # Compile the program
        approval_program, clear_program, contract = staking_contract.router.compile_program(version=6)

        # compile program to binary
        approval_program_compiled = compile_program(algod_client, approval_program)

        # compile program to binary
        clear_state_program_compiled = compile_program(algod_client, clear_program)
    except Exception as err:
        print(err)
        return {"code": 500, "msg":"staking pool을 생성하기 위한 속성값 생성에 실패했습니다", "error": err}
    
    # 2. 트랜잭션 생성
    try:
        # We create a blank signer, since we intend to use the ATC purely to help
        # construct the transaction group. The signer will be external to this
        # process, such as AlgoSigner that's an extension on the users browser.
        atc = AtomicTransactionComposer()
        signer = AccountTransactionSigner(creator_pk)
        
        print("asset_id: " + str(asset_id))

        # Add the 'deploy' method call. Used when deploying the staking smart
        # contract for the first time.
        atc.add_method_call(
            0,
            get_method(contract, 'deploy'),
            creator_addr,
            sp,
            signer,
            method_args=[
                int(asset_id),
            ],
            local_schema=transaction.StateSchema(0, 0),
            global_schema=transaction.StateSchema(2, 1),
            approval_program=approval_program_compiled,
            clear_program=clear_state_program_compiled,
        )

        
        txgroup = []
        for tx in atc.build_group():
            txgroup.append(tx.txn)
    except Exception as err:
        print(err)
        return {"code": 500, "msg":"staking pool을 생성하기 위한 트랜잭션 세팅에 실패했습니다", "error": err}
    
    # 3. 트랜잭션 실행
    result = execute_txn(algod_client, creator_pk, txgroup)

    # 트랜잭션 그룹 실행 실패 시 리턴
    if result["code"] == 500:
        return result
    
    # display results
    print(result)
    transaction_response = algod_client.pending_transaction_info(result["tx_id"])
    app_id = transaction_response["application-index"]
    print("Created new app-id:", app_id)
    
    # 4. 스테이킹풀 초기화
    result = init_pool(algod_client, app_id, creator_addr, creator_pk)
    
    return result
    
# The second step of deploying a pool is initialising it. The involves sending
# the minimum balance requirement (Algo). We also combine the final step of
# configuring the fixed rate of reward and funding the staking contract, since
# they can be grouped together.
def init_pool(algod_client, app_id, creator_addr, creator_pk):
    # 1. 스테이킹풀 초기화를 위한 속성값 생성
    try:
        # 해당 스테이킹풀의 계정주소
        pool_addr = logic.get_application_address(app_id)
        print("pool_addr: " + pool_addr)
        
        # 해당 애플리케이션의 정보
        app = algod_client.application_info(app_id)
        
        # 스테이킹풀 생성자 pk
        # createPool로 할 땐 삭제해야 함
        creator_pk = getPK(creator_pk)

        # 글로벌 변수 파싱
        for s in app['params']['global-state']:
            match base64.b64decode(s['key']).decode('utf8'):
                case "SA":
                    staking_asset = s['value']['uint']

        # Fetch suggested parameters.
        sp = algod_client.suggested_params()
        sp.flat_fee = True
        sp.fee = constants.MIN_TXN_FEE

        # Compile the program
        approval_program, clear_program, contract = staking_contract.router.compile_program(version=6)
    except Exception as err:
        print(err)
        return {"code": 500 ,"msg" : "스테이킹풀 생성 초기화를 위한 속성값 생성 실패", "error": err}

    # 2. 스테이킹풀 초기화를 위한 트랜잭션 생성
    try:
        atc = AtomicTransactionComposer()
        signer = AccountTransactionSigner(creator_pk)

        # Construct the Payment transaction, for 0.302 Algo, the minimum balance
        # for the smart contract account.
        # We create a TransactionWithSigner object although we have a blank signer,
        # as that's what the ATC expects.
        pay_txn = transaction.PaymentTxn(creator_addr, sp, pool_addr, 302000)
        pay_tws = TransactionWithSigner(pay_txn, signer)

        # Add the 'init' method call. This expects the payment transaction, along
        # with the two assets which it will optin to.
        atc.add_method_call(
            app_id,
            get_method(contract, 'init'),
            creator_addr,
            sp,
            signer,
            method_args=[
                pay_tws,
                staking_asset,
            ],
        )
        
        txgroup = []
        
        i = 1
        for tx in atc.build_group():
            txgroup.append(tx.txn)
    except Exception as err:
        print(err)
        return {"code": 500, "msg":"staking pool을 생성하기 위한 트랜잭션 세팅에 실패했습니다", "error": err}
        
    # 3. 스테이킹풀 초기화를 위한 트랜잭션 실행
    result = execute_txn(algod_client, creator_pk, txgroup)
    # 트랜잭션 그룹 실행 실패 시 리턴
    if result["code"] == 500:
        return result
    
    print(result["code"])
    
    return {"code": 200 ,"msg" : "스테이킹풀 초기화 완료", "tx_id": result["tx_id"], "app_id" : app_id}


# 토큰 스테이킹
def deposit(staker_addr, token, address, app_id, amount, staker_mnemonic):
    # 글작성자의 토큰을 스테이킹 하기위해 노드 및 기본 정보 저장
    try:
        # 스테이커 pk
        staker_pk = getPK(staker_mnemonic)
        
        # initialize an algodClient
        algod_client = algod.AlgodClient(token, address)
        
        # Calculate the smart contract address, retrieve the application state,
        # and the users local state.
        pool_addr = logic.get_application_address(app_id)
        app = algod_client.application_info(app_id)
        acc = algod_client.account_info(staker_addr)
    except Exception as err:
        print(err)
        return {"code": 500 ,"msg" : "글작성자의 토큰을 스테이킹 하기위해 노드 및 기본 정보 저장 실패", "error":err}

    # 토큰 스테이킹 위한 트랜잭션 생성
    try:
        # Assume we're going to make an OptIn call transaction unless we find the
        # user has already opted in.
        oncomp = transaction.OnComplete.OptInOC
        for als in acc['apps-local-state']:
            if als['id'] == app_id:
                oncomp = transaction.OnComplete.NoOpOC
                break

        # Retrieve the reward asset ID for create the asset transfer transaction.
        for gs in app['params']['global-state']:
            if base64.b64decode(gs['key']).decode('utf8') == "SA":
                reward_asset = gs['value']['uint']

        # Fetch suggested parameters.
        sp = algod_client.suggested_params()
        sp.flat_fee = True
        sp.fee = 1000

        # Compile the program
        approval_program, clear_program, contract = staking_contract.router.compile_program(version=6)
        
            
        # We create a blank signer, since we intend to use the ATC purely to help
        # construct the transaction group. The signer will be external to this
        # process, such as AlgoSigner that's an extension on the users browser.
        atc = AtomicTransactionComposer()
        signer = AccountTransactionSigner(staker_pk)

        # Construct the asset transfer transaction, to send the full amount of
        # reward asset into the staking pool.
        axfer_txn = transaction.AssetTransferTxn(staker_addr, sp, pool_addr, amount, reward_asset)
        axfer_tws = TransactionWithSigner(axfer_txn, signer)

        # Add the 'deposit' method call. This expects the asset transfer
        # transaction, along with the reward asset.
        atc.add_method_call(
            app_id,
            get_method(contract, 'deposit'),
            staker_addr,
            sp,
            signer,
            method_args=[
                axfer_tws,
            ],
            on_complete=oncomp,
        )

        txgroup = []
        for tx in atc.build_group():
            txgroup.append(tx.txn)
            
    except Exception as err:
        print(err)
        return {"code": 500 ,"msg" : "토큰 스테이킹 위한 트랜잭션 생성 실패", "error":err}
    
    # 트랜잭션 그룹 실행
    result = execute_txn(algod_client, staker_pk, txgroup)
    
    if result["code"] == 200:
        result["msg"] = "토큰 스테이킹 완료"
    
    return result

# 토큰 인출(스마트 컨트랙트가 계정에게 돌려준다!)
# 개발사 계정이 서명 =>  될 지 모르겠음, 안되면 컨트랙트 니모닉 구해서 해보기
# 개발사 계정 opt-in해줘야 함
def withdraw(staker_addr, app_id, token, address, amount, dev_addr, dev_mnemonic):
    # 토큰 인출하기위한 정보 조회
    try:
        dev_pk = getPK(dev_mnemonic)
        
        # initialize an algodClient
        algod_client = algod.AlgodClient(token, address)
        
        # Calculate the smart contract address, retrieve the application state,
        # and the users local state.
        app = algod_client.application_info(app_id)
    except Exception as err:
        print(err)
        return {"code": 500 ,"msg" : "토큰 인출하기위한 정보 조회 실패", "error":err}
    
    # 토큰 인출하기위한 txn 생성
    try:
        # Retrieve the staking and reward asset IDs,
        for gs in app['params']['global-state']:
            match base64.b64decode(gs['key']).decode('utf8'):
                case "SA":
                    staking_asset = gs['value']['uint']

        # Fetch suggested parameters.
        sp = algod_client.suggested_params()
        sp.flat_fee = True
        sp.fee = constants.MIN_TXN_FEE

        # Compile the program
        approval_program, clear_program, contract = staking_contract.router.compile_program(version=6)


        # We create a blank signer, since we intend to use the ATC purely to help
        # construct the transaction group. The signer will be external to this
        # process, such as AlgoSigner that's an extension on the users browser.
        atc = AtomicTransactionComposer()
        signer = AccountTransactionSigner(dev_pk)

        # Add 'withdraw' method call for the staking asset.
        atc.add_method_call(
            app_id,
            get_method(contract, 'withdraw'),
            dev_addr,
            sp,
            signer,
            method_args=[
                staking_asset,
                amount,
                staker_addr,
            ],
        )

        txgroup = []
        for tx in atc.build_group():
            txgroup.append(tx.txn)
    except Exception as err:
        print(err)
        return {"code": 500 ,"msg" : "토큰 인출하기위한 txn 생성 실패", "error":err}
    
    # 트랜잭션 그룹 실행
    result = execute_txn(algod_client, dev_pk, txgroup)
    
    if result["code"] == 200:
        result["msg"] = "스테이킹한 토큰 인출 완료"
    
    return result


