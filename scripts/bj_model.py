#!/usr/bin/env python3
"""bj_model.py — 21 点算法的 Python 参考实现（与 docs/assets/bj-core.js 同口径）

用途：
  1) 复算页面里的「庄家优势实测」，避免只依赖浏览器 JavaScript；
  2) 校验基本策略表与结算口径（--check）；
  3) 供批量模拟 / 出报告使用（--sim）。

用法：
  python scripts/bj_model.py --sim 200000 --decks 6 --s17 --bj 1.5
  python scripts/bj_model.py --check
"""
from __future__ import annotations

import argparse
import math
import random
from typing import List, Optional

SUITS = ["♠", "♥", "♦", "♣"]
RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]


def card_value(r: str) -> int:
    if r == "A":
        return 11
    if r in ("10", "J", "Q", "K"):
        return 10
    return int(r)


def build_shoe(decks: int) -> List[dict]:
    shoe = [{"r": r, "s": s} for _ in range(decks) for s in SUITS for r in RANKS]
    random.shuffle(shoe)
    return shoe


def hand_value(cards: List[dict]) -> int:
    total = sum(card_value(c["r"]) for c in cards)
    aces = sum(1 for c in cards if c["r"] == "A")
    while total > 21 and aces:
        total -= 10
        aces -= 1
    return total


def is_soft(cards: List[dict]) -> bool:
    total = sum(card_value(c["r"]) for c in cards)
    aces = sum(1 for c in cards if c["r"] == "A")
    while total > 21 and aces:
        total -= 10
        aces -= 1
    return aces > 0


def is_blackjack(cards: List[dict], from_split: bool = False) -> bool:
    return len(cards) == 2 and hand_value(cards) == 21 and not from_split


def hi_lo(r: str) -> int:
    if r in "2345" or r == "6":
        return 1
    if r in ("A", "10", "J", "Q", "K"):
        return -1
    return 0


def basic_strategy(cards: List[dict], up: int, can_double: bool, can_split: bool, can_surrender: bool) -> str:
    total, soft = hand_value(cards), is_soft(cards)
    if can_split:
        r = cards[0]["r"]
        if r in ("A", "8"):
            return "SPLIT"
        if r in ("10", "J", "Q", "K"):
            return "STAND"
        if r == "9":
            return "SPLIT" if 2 <= up <= 9 and up != 7 else "STAND"
        if r == "7":
            return "SPLIT" if up <= 7 else "HIT"
        if r == "6":
            return "SPLIT" if 2 <= up <= 6 else "HIT"
        if r == "4":
            return "SPLIT" if up in (5, 6) else "HIT"
        if r in ("3", "2"):
            return "SPLIT" if up <= 7 else "HIT"
    if can_surrender and not soft:
        if total == 16 and up in (9, 10):
            return "SURR"
        if total == 15 and up == 10:
            return "SURR"
    if soft:
        if total >= 19:
            return "STAND"
        if total == 18:
            if 3 <= up <= 6:
                return "DOUBLE" if can_double else "STAND"
            if up in (2, 7, 8):
                return "STAND"
            return "HIT"
        if total == 17:
            return "DOUBLE" if 3 <= up <= 6 and can_double else "HIT"
        if total >= 15:
            return "DOUBLE" if 4 <= up <= 6 and can_double else "HIT"
        return "DOUBLE" if 5 <= up <= 6 and can_double else "HIT"
    if total >= 17:
        return "STAND"
    if total in (16, 15):
        return "STAND" if up <= 6 else "HIT"
    if total >= 13:
        return "STAND" if up <= 6 else "HIT"
    if total == 12:
        return "STAND" if 4 <= up <= 6 else "HIT"
    if total == 11:
        return "DOUBLE" if can_double and up <= 10 else "HIT"
    if total == 10:
        return "DOUBLE" if can_double and up <= 9 else "HIT"
    if total == 9:
        return "DOUBLE" if can_double and 3 <= up <= 6 else "HIT"
    return "HIT"


def hand_return(cards, bet, dealer_value, *, dealer_bj=False, bj_pay=1.5,
                surrendered=False, five_card=False, special=0, closed=False, from_split=False) -> float:
    """返回给玩家的钱（含本金）。"""
    hv = hand_value(cards)
    if closed:
        return bet * 2
    if surrendered:
        return bet * 0.5
    if five_card:
        return bet * 0.5
    if special:
        return bet * (1 + special)
    if hv > 21:
        return 0.0
    if is_blackjack(cards, from_split):
        return bet if dealer_bj else bet * (1 + bj_pay)
    if dealer_bj:
        return 0.0
    if dealer_value > 21 or hv > dealer_value:
        return bet * 2
    if hv == dealer_value:
        return bet
    return 0.0


def simulate(n: int, decks: int = 6, s17: bool = True, bj_pay: float = 1.5) -> dict:
    bank = 0.0
    hands = 0
    sum_sq = 0.0
    shoe = build_shoe(decks)

    def take():
        nonlocal shoe
        if len(shoe) < 20:
            shoe = build_shoe(decks)
        return shoe.pop()

    for _ in range(n):
        orig = 1
        up_card = take()
        up = card_value(up_card["r"])
        p0 = [take(), take()]
        p_bj = hand_value(p0) == 21
        hand_list = [{"cards": p0, "bet": orig, "from_split": False, "done": p_bj,
                      "surrendered": False, "five": False, "dbl": False}]

        if not p_bj:
            i = 0
            while i < len(hand_list):
                h = hand_list[i]
                guard = 0
                while not h["done"] and guard < 20:
                    guard += 1
                    total = hand_value(h["cards"])
                    if total >= 21:
                        h["done"] = True
                        break
                    is_pair = len(h["cards"]) == 2 and h["cards"][0]["r"] == h["cards"][1]["r"]
                    act = basic_strategy(
                        h["cards"], up,
                        can_double=len(h["cards"]) == 2 and not h["dbl"],
                        can_split=is_pair and not h["from_split"] and not h["dbl"] and len(hand_list) < 4,
                        can_surrender=len(h["cards"]) == 2 and not h["from_split"] and not h["dbl"] and up != 11,
                    )
                    if act == "STAND":
                        h["done"] = True
                    elif act == "HIT":
                        h["cards"].append(take())
                    elif act == "DOUBLE":
                        h["bet"] = orig * 2
                        h["dbl"] = True
                        h["cards"].append(take())
                        h["done"] = True
                    elif act == "SURR":
                        h["surrendered"] = True
                        h["done"] = True
                    elif act == "SPLIT":
                        c2 = h["cards"].pop()
                        ace = c2["r"] == "A"
                        new = {"cards": [c2], "bet": orig, "from_split": True, "done": False,
                               "surrendered": False, "five": False, "dbl": False}
                        h["cards"].append(take())
                        new["cards"].append(take())
                        h["from_split"] = True
                        hand_list.insert(i + 1, new)
                        if ace:
                            h["done"] = True
                            new["done"] = True
                        elif hand_value(h["cards"]) >= 21:
                            h["done"] = True
                i += 1

        dealer = [up_card, take()]
        dealer_bj = hand_value(dealer) == 21
        if not dealer_bj:
            live = any(not h["surrendered"] and not h["five"] and hand_value(h["cards"]) <= 21 for h in hand_list)
            if live:
                guard = 0
                while guard < 12:
                    guard += 1
                    v = hand_value(dealer)
                    if v < 17:
                        dealer.append(take())
                        continue
                    if v == 17 and not s17 and is_soft(dealer):
                        dealer.append(take())
                        continue
                    break
        dv = hand_value(dealer)

        if p_bj and dealer_bj:
            hands += 1
            continue
        if dealer_bj:
            staked = sum(h["bet"] for h in hand_list)
            loss = min(orig, staked)
            bank -= loss
            sum_sq += loss * loss
            hands += len(hand_list)
            continue
        for h in hand_list:
            hands += 1
            ret = hand_return(h["cards"], h["bet"], dv, bj_pay=bj_pay,
                              surrendered=h["surrendered"], five_card=h["five"], from_split=h["from_split"])
            r = ret - h["bet"]
            bank += r
            sum_sq += r * r

    per = bank / hands * 100
    mean = bank / hands
    sd = math.sqrt(max(0.0, sum_sq / hands - mean * mean))
    return {"ev": per, "se": sd / math.sqrt(hands) * 100, "hands": hands}


def points_for(turnover: float, rate: float) -> float:
    return turnover * rate


def tier_of(points: float, tiers) -> dict:
    idx = 0
    for i, (_, need) in enumerate(tiers):
        if points >= need:
            idx = i
    cur = tiers[idx]
    nxt = tiers[idx + 1] if idx + 1 < len(tiers) else None
    pct = min(100.0, (points - cur[1]) / (nxt[1] - cur[1]) * 100) if nxt else 100.0
    return {"index": idx, "tier": cur[0], "next": nxt[0] if nxt else None,
            "need": math.ceil(nxt[1] - points) if nxt else 0, "pct": pct}


def check() -> None:
    # 1) 点数
    assert hand_value([{"r": "A"}, {"r": "A"}]) == 12
    assert is_soft([{"r": "A"}, {"r": "6"}]) is True
    assert hand_value([{"r": "A"}, {"r": "6"}, {"r": "10"}]) == 17
    # 2) 策略抽查
    assert basic_strategy([{"r": "10"}, {"r": "6"}], 10, True, False, True) == "SURR"
    assert basic_strategy([{"r": "A"}, {"r": "7"}], 9, True, False, False) == "HIT"
    assert basic_strategy([{"r": "8"}, {"r": "8"}], 10, True, True, True) == "SPLIT"
    # 3) 结算
    assert hand_return([{"r": "10"}, {"r": "9"}], 100, 18, bj_pay=1.5) == 200
    assert hand_return([{"r": "A"}, {"r": "K"}], 100, 20, bj_pay=1.5) == 250
    assert hand_return([{"r": "A"}, {"r": "K"}], 100, 21, dealer_bj=True, bj_pay=1.5) == 100
    assert hand_return([{"r": "10"}, {"r": "6"}], 100, 20, surrendered=True) == 50
    # 4) 积分 / 卡级
    tiers = [["红卡", 0], ["金卡", 300], ["白金卡", 3000], ["钻石卡", 30000]]
    assert abs(points_for(35000, 0.001) - 35) < 1e-9
    assert tier_of(35, tiers)["tier"] == "红卡"
    assert tier_of(320, tiers)["tier"] == "金卡"
    print("check: OK")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sim", type=int, default=0, help="模拟手数（0 = 不跑）")
    ap.add_argument("--decks", type=int, default=6)
    ap.add_argument("--s17", dest="s17", action="store_true", default=True)
    ap.add_argument("--h17", dest="s17", action="store_false")
    ap.add_argument("--bj", type=float, default=1.5, help="BJ 赔付倍率：1.5=3:2，1.2=6:5")
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()

    if args.check:
        check()
    if args.sim:
        r = simulate(args.sim, args.decks, args.s17, args.bj)
        print(f"hands={r['hands']:,}  EV={r['ev']:.3f}%/手  SE=±{r['se']:.3f}%")
    if not args.check and not args.sim:
        print("用法：--check 或 --sim 100000 --decks 6 --s17 --bj 1.5")


if __name__ == "__main__":
    main()