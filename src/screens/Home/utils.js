// @flow
/*
    Pillar Wallet: the personal data locker
    Copyright (C) 2021 Stiftung Pillar Project

    This program is free software; you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation; either version 2 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License along
    with this program; if not, write to the Free Software Foundation, Inc.,
    51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
*/

// Selectors
import { useRootSelector, activeAccountAddressSelector } from 'selectors';
import {
  walletBalanceSelector,
  depositsBalanceSelector,
  investmentsBalanceSelector,
  liquidityPoolsBalanceSelector,
} from 'selectors/balances';
import { accountCollectiblesSelector } from 'selectors/collectibles';
import { contactsCountSelector } from 'selectors/contacts';

// Utils
import { BigNumber } from 'utils/common';
import { sum, sumOrNull } from 'utils/bigNumber';

// Types
import type { WalletInfo, ChainInfo, BalanceInfo } from 'models/Home';

export const useTotalBalance = (): BalanceInfo => {
  const walletBalance = useRootSelector(walletBalanceSelector);

  return {
    balanceInFiat: walletBalance,
  };
};

export const useWalletInfo = (): WalletInfo => {
  const wallet = { balanceInFiat: useRootSelector(walletBalanceSelector) };
  const deposits = { balanceInFiat: BigNumber(3100) }; // useRootSelector(depositsBalanceSelector);
  const investments = { balanceInFiat: BigNumber(5100) }; // useRootSelector(investmentsBalanceSelector);
  const liquidityPools = { balanceInFiat: BigNumber(2100) }; // useRootSelector(liquidityPoolsBalanceSelector);
  const rewards = { balanceInFiat: BigNumber(500) };
  const datasets = { balanceInFiat: BigNumber(450) };

  const ethereum = {
    wallet,
    deposits,
    investments,
    liquidityPools,
    rewards,
    datasets,
    total: getTotalBalanceInfo([wallet, deposits, investments, liquidityPools, rewards, datasets]),
    collectibles: useRootSelector(accountCollectiblesSelector).length,
    contacts: useRootSelector(contactsCountSelector),
    walletAddress: useRootSelector(activeAccountAddressSelector),
  };

  const binance = {
    total: { balanceInFiat: BigNumber(5000) },
    wallet: { balanceInFiat: BigNumber(5000) },
  };

  return {
    total: getTotalChainInfo([ethereum, binance]),
    ethereum,
    binance,
  };
};

const getTotalBalanceInfo = (balances: (?BalanceInfo)[]): BalanceInfo => {
  return {
    balanceInFiat: sum(balances.map(b => b?.balanceInFiat)),
    profitInFiat: sumOrNull(balances.map(b => b?.profitInFiat)),
  };
};

const getTotalChainInfo = (chains: ChainInfo[]): ChainInfo => {
  return {
    wallet: getTotalBalanceInfo(chains.map((c) => c.wallet)),
    deposits: getTotalBalanceInfo(chains.map((c) => c.deposits)),
    investments: getTotalBalanceInfo(chains.map((c) => c.investments)),
    liquidityPools: getTotalBalanceInfo(chains.map((c) => c.liquidityPools)),
    rewards: getTotalBalanceInfo(chains.map((c) => c.rewards)),
    datasets: getTotalBalanceInfo(chains.map((c) => c.datasets)),
    total: getTotalBalanceInfo(chains.map((c) => c.total)),
  };
};
