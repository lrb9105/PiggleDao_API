from algosdk.future import transaction
from algosdk import account, mnemonic
from algosdk.atomic_transaction_composer import *
from algosdk.v2client import algod
from pyteal import *
from flask import Flask, request,jsonify

count_key = Bytes("Count")

handle_creation = Seq(
    App.globalPut(count_key, Int(0)),
    # Approve()는 Return(Int(1))의 약어임(<= 성공)
    Approve()
)

router=Router(
    # 계약 이름
    "my-first-router",
    # arg가 넘어오지 않는 경우 실행할 핸들러 지정
    BareCallActions(
        # On create only, just approve
        no_op=OnCompleteAction.create_only(handle_creation),
        # Always let creator update/delete but only by the creator of this contract
        # Reject()는 Return(Int(0))의 약어임(<= 실패)
        update_application=OnCompleteAction.always(Reject()),
        delete_application=OnCompleteAction.always(Reject()),
        # No local state, don't bother handling it. 
        close_out=OnCompleteAction.never(),   # Equivalent to omitting completely
        opt_in=OnCompleteAction.never(),      # Equivalent to omitting completely
        clear_state=OnCompleteAction.never(), # Equivalent to omitting completely
    ),
)

# 메소드 => arg와 반환값이 있는 경우 외부에서 호출할 수 있는 함수
@router.method
def increment():
    # Declare the ScratchVar as a Python variable _outside_ the expression tree
    # PyTeal을 사용해서 스마트 컨트랙트를 만들면 expression tree가 생성된다(컴파일 시 Teal로 변환된 트리인듯?).
    # 그런데 scratchCount = ScratchVar()는 스마트 컨트랙트가 아닌 파이썬 표현식이므로 expression tree에 포함되지 않는다.
    # Smart contracts can hold up to 256 temporary variables in scratch space.  
    # The scratch variable in this example happens to be an integer, byte arrays can also be stored.
    scratchCount = ScratchVar(TealType.uint64)
    return Seq(
        # Assert는 조건에 맞지 않으면 트랜잭션을 바로 종료시킨다(Reject()를 호출한다!)
        Assert(Global.group_size() == Int(1)),
        # The initial `store` for the scratch var sets the value to 
        # whatever is in the `Count` global state variable
        scratchCount.store(App.globalGet(count_key)), 
        # Increment the value stored in the scratch var 
        # and update the global state variable 
        App.globalPut(count_key, scratchCount.load() + Int(1)),
    )
    
@router.method
def decrement():
    # Declare the ScratchVar as a Python variable _outside_ the expression tree
    scratchCount = ScratchVar(TealType.uint64)
    return Seq(
        Assert(Global.group_size() == Int(1)),
        # The initial `store` for the scratch var sets the value to 
        # whatever is in the `Count` global state variable
        scratchCount.store(App.globalGet(count_key)),
        # Check if the value would be negative by decrementing 
        If(scratchCount.load() > Int(0),
            # If the value is > 0, decrement the value stored 
            # in the scratch var and update the global state variable
            App.globalPut(count_key, scratchCount.load() - Int(1)),
        ),
    )
    
# helper function to compile program source
def compile_program(client, source_code):
    compile_response = client.compile(source_code)
    return base64.b64decode(compile_response["result"])

# helper function that converts a mnemonic passphrase into a private signing key
def get_private_key_from_mnemonic(mn):
    private_key = mnemonic.to_private_key(mn)
    return private_key


# helper function that formats global state for printing
def format_state(state):
    formatted = {}
    for item in state:
        key = item["key"]
        value = item["value"]
        formatted_key = base64.b64decode(key).decode("utf-8")
        if value["type"] == 1:
            # byte string
            if formatted_key == "voted":
                formatted_value = base64.b64decode(value["bytes"]).decode("utf-8")
            else:
                formatted_value = value["bytes"]
            formatted[formatted_key] = formatted_value
        else:
            # integer
            formatted[formatted_key] = value["uint"]
    return formatted

def create_app(
    client, private_key, approval_program, clear_program, global_schema, local_schema
):
    # define sender as creator
    sender = account.address_from_private_key(private_key)

    # declare on_complete as NoOp
    on_complete = transaction.OnComplete.NoOpOC.real

    # get node suggested parameters
    params = client.suggested_params()

    # create unsigned transaction
    txn = transaction.ApplicationCreateTxn(
        sender,
        params,
        on_complete,
        approval_program,
        clear_program,
        global_schema,
        local_schema,
    )

    # sign transaction
    signed_txn = txn.sign(private_key)
    tx_id = signed_txn.transaction.get_txid()

    # send transaction
    client.send_transactions([signed_txn])

    # wait for confirmation
    try:
        transaction_response = transaction.wait_for_confirmation(client, tx_id, 5)
        print("TXID: ", tx_id)
        print(
            "Result confirmed in round: {}".format(
                transaction_response["confirmed-round"]
            )
        )

    except Exception as err:
        print(err)
        return

    # display results
    transaction_response = client.pending_transaction_info(tx_id)
    app_id = transaction_response["application-index"]
    print("Created new app-id:", app_id)

    return app_id


# helper function to read app global state
def read_global_state(client, app_id):
    app = client.application_info(app_id)
    global_state = (
        app["params"]["global-state"] if "global-state" in app["params"] else []
    )
    return format_state(global_state)

# create new application
def create_new_app(creator_mnemonic, token, address):
    try:
        # initialize an algodClient
        algod_client = algod.AlgodClient(token, address)

        # define private keys
        creator_private_key = getPK(creator_mnemonic)

        # declare application state storage (immutable)
        local_ints = 0
        local_bytes = 0
        global_ints = 1
        global_bytes = 0
        global_schema = transaction.StateSchema(global_ints, global_bytes)
        local_schema = transaction.StateSchema(local_ints, local_bytes)

        # Compile the program
        approval_program, clear_program, contract = router.compile_program(version=6)

        with open("./approval.teal", "w") as f:
            f.write(approval_program)

        with open("./clear.teal", "w") as f:
            f.write(clear_program)

        with open("./contract.json", "w") as f:
            import json

            f.write(json.dumps(contract.dictify()))

        # compile program to binary
        approval_program_compiled = compile_program(algod_client, approval_program)

        # compile program to binary
        clear_state_program_compiled = compile_program(algod_client, clear_program)

        
        print("--------------------------------------------")
        print("Deploying Counter application......")
        
        
        # create new application
        app_id = create_app(
            algod_client,
            creator_private_key,
            approval_program_compiled,
            clear_state_program_compiled,
            global_schema,
            local_schema,
        )
        
        
        return jsonify({
            'code': 200,
            'result':'success',
            'appId': app_id
        })
    except Exception as err:
        print(err)
        return jsonify({
            'code': 400,
            'result':'fail',
            'msg': err
        })


# call application
def call_app(caller_mnemonic, token, address, caller_addr, app_id, method_name):
    private_key = getPK(caller_mnemonic)
    
    # Compile the program
    approval_program, clear_program, contract = router.compile_program(version=6)
        
    # initialize an algodClient
    algod_client = algod.AlgodClient(token, address)
    
    # get sender address
    sender = caller_addr
    # create a Signer object
    signer = AccountTransactionSigner(private_key)

    # get node suggested parameters
    sp = algod_client.suggested_params()

    # Create an instance of AtomicTransactionComposer
    atc = AtomicTransactionComposer()
    atc.add_method_call(
        app_id=app_id,
        method=contract.get_method_by_name(method_name),
        sender=sender,
        sp=sp,
        signer=signer,
        method_args=[],  # No method args needed here
    )

    # send transaction
    results = atc.execute(algod_client, 2)

    # wait for confirmation
    print("TXID: ", results.tx_ids[0])
    print("Result confirmed in round: {}".format(results.confirmed_round))
    
    # read global state of application
    print("Global state:", read_global_state(algod_client, app_id))

    return results.tx_ids[0]

def getPK(mn) :
    # kmd_token = "3c3d3bfa2d53960b1b443e3a5fed1530981dae6aa6427cf531da1b41cb8d40a2"
    # kmd_address = "http://localhost:7833"
    account_private_key = mnemonic.to_private_key(mn)
    print("Private Key: ", account_private_key)
    return account_private_key

'''  
# Compile the program
approval_program, clear_program, contract = router.compile_program(version=6)

# print out the results
print(approval_program)
print()
print(clear_program)

import json
print(json.dumps(contract.dictify()))
'''