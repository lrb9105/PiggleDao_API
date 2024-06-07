#!/usr/bin/env python3

import json
from pyteal import *

# 생성자인지 여부 확인
@Subroutine(TealType.uint64)
def is_creator() -> Expr:
    return Txn.sender() == Global.creator_address()

# 관리자인지 여부 확인
@Subroutine(TealType.none)
def is_admin() -> Expr:
    return Assert(Txn.sender() == App.globalGet(Bytes("A")))

# 관리자로 지정
@Subroutine(TealType.none)
def set_admin(addr: Expr):
    return Seq(
        App.globalPut(Bytes("A"), addr),
    )

# 에셋에 옵트인
@Subroutine(TealType.none)
def optin_asset(asset: Expr):
    return Seq(
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.AssetTransfer,
            TxnField.xfer_asset: asset,
            TxnField.asset_receiver: Global.current_application_address(),
        }),
        InnerTxnBuilder.Submit(),
    )

# 에셋 전송
@Subroutine(TealType.none)
def send_asset(
    asset: abi.Asset,
    amount: abi.Uint64,
    recipient: abi.Account
) -> Expr:
    return Seq(
        # Check if we're sending the staking asset or the reward asset
        # If we're trying to send more than the account has, use the maximum
        # available value the account has.
        # Deduct the amount from the local state.
        # Send the amount requested or maximum amount available to the recipient.
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields(
            {
                TxnField.type_enum: TxnType.AssetTransfer,
                TxnField.xfer_asset: asset.asset_id(),
                TxnField.asset_amount: amount.get(),
                TxnField.asset_receiver: recipient.address(),
                TxnField.fee: Int(0),
            }
        ),
        InnerTxnBuilder.Submit(),
    )

router = Router(
    # Name of the contract
    "staking",
    # What to do for each on-complete type when no arguments are passed (bare call)
    BareCallActions(
        # On create only, just approve
        no_op=OnCompleteAction.never(),
        # Just be nice, we _must_ provide _something_ for clear state becuase it is its own
        # program and the router needs _something_ to build
        clear_state=OnCompleteAction.call_only(Approve()),
    ),
)

# method는 인풋이 있고 리턴값이 있는 경우 사용한다
# no_op, opt_in: on_completion이 OnComplete.NoOp or OnComplete.OptIn인 경우에만 호출 가능
# CallConfig.ALL: app creation txn or non-creation txn 둘 다인 경우 호출 가능
# 스마트컨트랙트에 asset을 저장하는 경우 호출한다. 
# 최초엔 opt-in으로 호출하고 그 다음엔 no-op로 호출하는 것 같다.
@router.method(no_op=CallConfig.ALL, opt_in=CallConfig.ALL)
def deposit(
    axfer: abi.AssetTransferTransaction
) -> Expr:
    """Deposit adds an amount of staked assets to the pool, increasing the
    senders share of the rewards."""
    return Seq(
        # Confirm sender for this appl and the axfer are the same
        # Note: Do we need to care if it came from the same address?
        Assert(axfer.get().sender() == Txn.sender()),

        # Check the staking asset is being received by the smart contract
        Assert(axfer.get().asset_receiver() == Global.current_application_address()),

        # Add deposit to global
        App.globalPut(
            Bytes("TS"),
            App.globalGet(Bytes("TS")) + axfer.get().asset_amount()
        ),

        # Success
        Approve(),
    )


# 스테이킹한 금액 계정에게 전송
# 이번 토큰 전송으로 스테이킹한 금액이 0원이라면 close-out
# 여전히 금액이 남아있다면 close-out
@router.method(no_op=CallConfig.ALL, close_out=CallConfig.ALL)
def withdraw(
    asset: abi.Asset,
    amount: abi.Uint64,
    recipient: abi.Account,
) -> Expr:
    """Remove an amount of staked assets or reward assets from the pool."""
    return Seq(
        # Send asset to recipient
        send_asset(asset, amount, recipient),

        # Add deposit to global
        App.globalPut(
            Bytes("TS"),
            App.globalGet(Bytes("TS")) - amount.get()
        ),

        # Success
        Approve(),
    )


@router.method(no_op=CallConfig.CREATE)
def deploy(
    staking: abi.Asset,
) -> Expr:
    """Used to deploy the contract, defining assets and times."""
    return Seq(
        # Can only deploy as a new smart contract.
        Assert(Not(Txn.application_id())),

        # User sender as admin.
        set_admin(Txn.sender()),

        # Set staking asset
        App.globalPut(Bytes("SA"), staking.asset_id()),

        # Success
        Approve(),
    )

# 
@router.method
def init(
    pay: abi.PaymentTransaction,
    staking: abi.Asset,
) -> Expr:
    """Initialise the newly deployed contract, funding it with a minimum
    balance and allowing it to opt in to the request assets."""
    return Seq(
        # Check receiver of payment is this smart contract
        Assert(pay.get().receiver() == Global.current_application_address()),

        # Check amount is greater than minimum balance requirement
        Assert(
            Ge(
                Balance(Global.current_application_address()) + pay.get().amount(),
                (Global.min_balance() * (Txn.assets.length() + Int(1))) + (Global.min_txn_fee() * Txn.assets.length())
            )
        ),

        # OptIn to assets
        #(i := ScratchVar()).set(Int(1)),
        For(
            (i := ScratchVar()).store(Int(0)),
            i.load() < Txn.assets.length(),
            i.store(i.load() + Int(1))
        ).Do(
            optin_asset(Txn.assets[i.load()]),
        ),

        #Success
        Approve(),
    )
