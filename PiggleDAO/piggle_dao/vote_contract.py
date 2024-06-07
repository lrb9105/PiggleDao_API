from pyteal import *

# approval_program은 스마트컨트랙트 대부분의 tx를 다룬다.
""" App.globalPut(Bytes("EndTime"), Btoi(Txn.application_args[0]) <= 도저히 방법을 못찾겠어서 뺐음, 
    Btoi가 8bit까지만 변환가능한데 타임스탬프는 10bit임, 10bit를 변환할 수 있는 함수를 찾았는데 없음... 
    EndTime은 필요하지 않음, 서버단에서 제어해주면 된다.
"""
def approval_program():
    # 스마트컨트랙트 생성 시 글로벌 상태를 초기화해주는 부분
    on_creation = Seq(
        [
            App.globalPut(Bytes("Creator"), Txn.sender()),
            Assert(Txn.application_args.length() == Int(2)),
            App.globalPut(Bytes("Type"), Btoi(Txn.application_args[0])),
            App.globalPut(Bytes("Writer"), Txn.application_args[1]),
            App.globalPut(Bytes("up"), Int(0)),
            App.globalPut(Bytes("down"), Int(0)),
            Return(Int(1)),
        ]
    )
    
    is_creator = Txn.sender() == App.globalGet(Bytes("Creator"))
    
    # up 또는 down
    choice = Txn.application_args[1]
        
    # 해당 투표종류의 전체 투표수
    choice_tally = App.globalGet(choice)
    on_vote = Seq(
        [
            App.globalPut(choice, choice_tally + Int(1)),
            Return(Int(1)),
        ]
    )

    program = Cond(
        [Txn.application_id() == Int(0), on_creation],
        [Txn.on_completion() == OnComplete.DeleteApplication, Return(is_creator)],
        [Txn.on_completion() == OnComplete.UpdateApplication, Return(is_creator)],
        [Txn.application_args[0] == Bytes("vote"), on_vote],
    )

    return program


def clear_state_program():
    program = Return(Int(1))

    return program