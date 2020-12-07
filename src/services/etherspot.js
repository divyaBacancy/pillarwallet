// @flow
/*
    Pillar Wallet: the personal data locker
    Copyright (C) 2019 Stiftung Pillar Project

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

import { constants, utils } from 'ethers';
import {
  Sdk as EtherspotSdk,
  NetworkNames,
  Env,
  Account as EtherspotAccount,
  Accounts as EtherspotAccounts,
  GatewayEstimatedBatch,
  P2PPaymentDeposit,
  ENSNode,
} from 'etherspot';
import BigNumber from 'bignumber.js';
import type { UpdateP2PPaymentChannelDto } from 'etherspot/dist/sdk/dto';

// utils
import {
  getEnsPrefix,
  isCaseInsensitiveMatch,
  parseTokenAmount,
  reportErrorLog,
} from 'utils/common';
import { mapToEtherspotTransactionsBatch } from 'utils/etherspot';
import { addressesEqual } from 'utils/assets';

// constants
import { ETH } from 'constants/assetsConstants';

// types
import type { EtherspotTransaction } from 'models/Etherspot';
import type { Asset, Balance } from 'models/Asset';
import type { TransactionPayload } from 'models/Transaction';


class EtherspotService {
  sdk: EtherspotSdk;

  async init(privateKey: string) {
    // TODO: replace with testnet/mainnet instead of local
    this.sdk = new EtherspotSdk({
      privateKey,
      networkName: NetworkNames.LocalA,
    }, {
      env: new Env({
        apiOptions: {
          host: '192.168.1.111', // dev: enter your machine's local IP
          port: '4000',
        },
        networkOptions: {
          supportedNetworkNames: [NetworkNames.LocalA],
        },
      }),
    });
    await this.sdk.computeContractAccount({ sync: true }).catch((error) => {
      reportErrorLog('EtherspotService init computeContractAccount failed', { error });
    });
  }

  subscribe() {
    // return this.sdk.api.subscribe()
  }

  unsubscribe() {
    // return this.sdk.api.subscribe()
  }

  getAccounts(): ?EtherspotAccount[] {
    return this.sdk.getConnectedAccounts()
      .then(({ items }: EtherspotAccounts) => items) // TODO: pagination
      .catch((error) => {
        reportErrorLog('EtherspotService getAccounts -> getConnectedAccounts failed', { error });
        return null;
      });
  }

  reserveENSName(username: string): ?EtherspotAccount[] {
    const fullENSName = `${username}${getEnsPrefix()}`;
    return this.sdk.reserveENSName({ name: fullENSName }).catch((error) => {
      reportErrorLog('EtherspotService reserveENSName failed', { error, username, fullENSName });
      return null;
    });
  }

  clearTransactionsBatch() {
    return this.sdk.clearGatewayBatch();
  }

  setTransactionsBatch(transactions: EtherspotTransaction[]): Promise<?GatewayEstimatedBatch> {
    return Promise.all(transactions.map((transaction) => this.sdk.batchExecuteAccountTransaction(transaction)));
  }

  estimateTransactionsBatch() {
    return this.sdk.estimateGatewayBatch().then((result) => result?.estimation);
  }

  async getBalances(accountAddress: string, assets: Asset[]): Promise<Balance[]> {
    const assetAddresses = assets
      // 0x0...0 is default ETH address in our assets, but it's not a token
      .filter(({ address }) => !isCaseInsensitiveMatch(address, constants.AddressZero))
      .map(({ address }) => address);

    // gets balances by provided token (asset) address and ETH balance regardless
    const accountBalances = await this.sdk
      .getAccountBalances({
        account: accountAddress,
        tokens: assetAddresses,
      })
      .catch((error) => {
        reportErrorLog('EtherspotService getBalances -> getAccountBalances failed', { error, accountAddress });
        return null;
      });

    // map to our Balance type
    return accountBalances.items.reduce((balances, { balance, token }) => {
      // if SDK returned token value is null then it's ETH
      const asset = assets.find(({
        address,
        symbol,
      }) => token === null ? symbol === ETH : isCaseInsensitiveMatch(address, token));

      if (!asset) {
        reportErrorLog('EtherspotService getBalances asset mapping failed', { token });
        return balances;
      }

      return [
        ...balances,
        {
          symbol: asset.symbol,
          balance: utils.formatUnits(balance, asset.decimals),
        },
      ];
    }, []);
  }

  async setTransactionsBatchAndSend(transactions: EtherspotTransaction[]) {
    // clear batch
    this.clearTransactionsBatch();

    // set batch
    await this.setTransactionsBatch(transactions).catch((error) => {
      reportErrorLog('setTransactionsBatchAndSend -> setTransactionsBatch failed', { error, transactions });
      throw error;
    });

    // estimate current batch
    await this.estimateTransactionsBatch();

    // submit current batch
    return this.sdk.submitGatewayBatch().then(({ hash }) => ({ hash }));
  }

  async sendTransaction(transaction: TransactionPayload, fromAccountAddress: string) {
    const ethersportTransactions = await mapToEtherspotTransactionsBatch(transaction, fromAccountAddress);
    return this.setTransactionsBatchAndSend(ethersportTransactions);
  }


  sendP2PTransaction(transaction: TransactionPayload) {
    const { to: recipient, amount, decimals } = transaction;

    const paymentChannelUpdateRequest: UpdateP2PPaymentChannelDto = {
      token: transaction.symbol === ETH ? null : transaction.contractAddress,
      totalAmount: parseTokenAmount(amount.toString(), decimals),
      recipient,
    };

    return this.sdk.updateP2PPaymentChannel(paymentChannelUpdateRequest).then(({ hash }) => ({ hash }));
  }

  async getAccountTokenDeposit(tokenAddress: string): Promise<?P2PPaymentDeposit> {
    // returns all deposits: ETH and provided tokens
    const deposits = await this.sdk.syncP2PPaymentDeposits({ tokens: [tokenAddress] })
      .then(({ items }) => items)
      .catch((error) => {
        reportErrorLog('getAccountTokenDeposit -> syncP2PPaymentDeposits failed', { error, tokenAddress });
        throw error;
      });

    // find our token deposit
    return deposits.find(({ token }) => addressesEqual(token, tokenAddress));
  }

  async getAccountTokenDepositBalance(tokenAddress: string): BigNumber {
    const tokenDeposit = await this.getAccountTokenDeposit(tokenAddress);
    if (!tokenDeposit) {
      reportErrorLog('getAccountTokenDepositBalance failed: cannot find token deposit', { tokenAddress });
      return new BigNumber(0);
    }

    // BigNumber lib compatibility
    return new BigNumber(tokenDeposit.availableAmount.toString());
  }

  async getENSNameByAccountAddress(accountAddress: string): Promise<?ENSNode> {
    return this.sdk.getENSNode({ nameOrHashOrAddress: accountAddress })
      .then((ensNode) => ensNode?.name)
      .catch((error) => {
        reportErrorLog('getENSNameByAccountAddress -> getENSNode failed', { accountAddress, error });
      });
  }

  async logout() {
    if (!this.sdk) return; // not initialized, nothing to do

    await this.sdk.destroy();
    this.sdk = null;
  }
}

const etherspot = new EtherspotService();

export default etherspot;
