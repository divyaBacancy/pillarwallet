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
import { sdkModules, sdkConstants } from '@archanova/sdk';
import { ethToWei, weiToEth } from '@netgum/utils';
import get from 'lodash.get';
import { NavigationActions } from 'react-navigation';
import { utils } from 'ethers';

// components
import Toast from 'components/Toast';

// constants
import {
  SET_SMART_WALLET_SDK_INIT,
  SET_SMART_WALLET_ACCOUNTS,
  SET_SMART_WALLET_CONNECTED_ACCOUNT,
  ADD_SMART_WALLET_UPGRADE_ASSETS,
  ADD_SMART_WALLET_UPGRADE_COLLECTIBLES,
  DISMISS_SMART_WALLET_UPGRADE,
  SET_SMART_WALLET_ASSETS_TRANSFER_TRANSACTIONS,
  SET_SMART_WALLET_UPGRADE_STATUS,
  SMART_WALLET_UPGRADE_STATUSES,
  ADD_SMART_WALLET_RECOVERY_AGENTS,
} from 'constants/smartWalletConstants';
import { ACCOUNT_TYPES, UPDATE_ACCOUNTS } from 'constants/accountsConstants';
import { ETH, UPDATE_BALANCES } from 'constants/assetsConstants';

import {
  TX_PENDING_STATUS,
  TX_CONFIRMED_STATUS,
  SET_HISTORY, ADD_TRANSACTION,
} from 'constants/historyConstants';
import {
  UPDATE_PAYMENT_NETWORK_ACCOUNT_BALANCES,
  SET_ESTIMATED_TOPUP_FEE,
  PAYMENT_NETWORK_ACCOUNT_TOPUP,
  PAYMENT_NETWORK_SUBSCRIBE_TO_TX_STATUS,
  PAYMENT_NETWORK_UNSUBSCRIBE_TX_STATUS,
} from 'constants/paymentNetworkConstants';
import { SMART_WALLET_UNLOCK, ASSETS } from 'constants/navigationConstants';

// services
import smartWalletService from 'services/smartWallet';
import Storage from 'services/storage';
import { navigate } from 'services/navigation';

// selectors
import { paymentNetworkAccountBalancesSelector } from 'selectors/paymentNetwork';
import { accountBalancesSelector } from 'selectors/balances';

// actions
import {
  addNewAccountAction,
  setActiveAccountAction,
  switchAccountAction,
} from 'actions/accountsActions';
import { saveDbAction } from 'actions/dbActions';
import {
  signAssetTransactionAction,
  sendSignedAssetTransactionAction,
  resetLocalNonceToTransactionCountAction,
  fetchAssetsBalancesAction,
} from 'actions/assetsActions';
import { fetchCollectiblesAction } from 'actions/collectiblesActions';

// types
import type { AssetTransfer } from 'models/Asset';
import type { CollectibleTransfer } from 'models/Collectible';
import type { RecoveryAgent } from 'models/RecoveryAgents';

// utils
import { buildHistoryTransaction } from 'utils/history';
import { getActiveAccountAddress, getActiveAccountId } from 'utils/accounts';
import { isConnectedToSmartAccount } from 'utils/smartWallet';
import { getBalance } from 'utils/assets';
import { formatAmount } from 'utils/common';
import { Sentry } from 'react-native-sentry';


const storage = Storage.getInstance('db');

export const initSmartWalletSdkAction = (walletPrivateKey: string) => {
  return async (dispatch: Function) => {
    await smartWalletService.init(walletPrivateKey, dispatch);
    const initialized = smartWalletService.sdkInitialized;
    dispatch({
      type: SET_SMART_WALLET_SDK_INIT,
      payload: initialized,
    });
  };
};

export const loadSmartWalletAccountsAction = (privateKey?: string) => {
  return async (dispatch: Function, getState: Function, api: Object) => {
    if (!smartWalletService) return;

    const { user = {} } = await storage.get('user');
    const { session: { data: session } } = getState();

    const smartAccounts = await smartWalletService.getAccounts();
    if (!smartAccounts.length && privateKey) {
      const newSmartAccount = await smartWalletService.createAccount();
      await api.registerSmartWallet({
        walletId: user.walletId,
        privateKey,
        ethAddress: newSmartAccount.address,
        fcmToken: session.fcmToken,
      });
      if (newSmartAccount) smartAccounts.push(newSmartAccount);
    }
    dispatch({
      type: SET_SMART_WALLET_ACCOUNTS,
      payload: smartAccounts,
    });

    const backendAccounts = await api.listAccounts(user.walletId);
    const newAccountsPromises = smartAccounts.map(async account => {
      return dispatch(addNewAccountAction(account.address, ACCOUNT_TYPES.SMART_WALLET, account, backendAccounts));
    });
    await Promise.all(newAccountsPromises);
  };
};

export const importSmartWalletAccountsAction = (privateKey: string, createNewAccount: boolean) => {
  return async (dispatch: Function, getState: Function, api: Object) => {
    if (!smartWalletService) return;

    const { user = {} } = await storage.get('user');
    const {
      session: { data: session },
      assets: { data: assets },
    } = getState();

    const smartAccounts = await smartWalletService.getAccounts();
    if (!smartAccounts.length && createNewAccount) {
      const newSmartAccount = await smartWalletService.createAccount();
      await api.registerSmartWallet({
        walletId: user.walletId,
        privateKey,
        ethAddress: newSmartAccount.address,
        fcmToken: session.fcmToken,
      });
      if (newSmartAccount) smartAccounts.push(newSmartAccount);
    }
    dispatch({
      type: SET_SMART_WALLET_ACCOUNTS,
      payload: smartAccounts,
    });

    // register on backend missed accounts
    let backendAccounts = await api.listAccounts(user.walletId);
    const registerOnBackendPromises = smartAccounts.map(async account => {
      const accountAddress = account.address.toLowerCase();
      const backendAccount = backendAccounts.find(({ ethAddress }) => ethAddress.toLowerCase() === accountAddress);
      if (!backendAccount) {
        return api.registerSmartWallet({
          walletId: user.walletId,
          privateKey,
          ethAddress: account.address,
          fcmToken: session.fcmToken,
        });
      }
      return Promise.resolve();
    });
    await Promise.all(registerOnBackendPromises);
    backendAccounts = await api.listAccounts(user.walletId);

    const newAccountsPromises = smartAccounts.map(async account => {
      return dispatch(addNewAccountAction(account.address, ACCOUNT_TYPES.SMART_WALLET, account, backendAccounts));
    });
    await Promise.all(newAccountsPromises);

    if (smartAccounts.length) {
      await dispatch(setActiveAccountAction(smartAccounts[0].address));
      dispatch(fetchAssetsBalancesAction(assets));
      dispatch(fetchCollectiblesAction());
    }
  };
};

export const setSmartWalletUpgradeStatusAction = (upgradeStatus: string) => {
  return async (dispatch: Function) => {
    dispatch(saveDbAction('smartWallet', { upgradeStatus }));
    dispatch({
      type: SET_SMART_WALLET_UPGRADE_STATUS,
      payload: upgradeStatus,
    });
  };
};

export const connectSmartWalletAccountAction = (accountId: string) => {
  return async (dispatch: Function) => {
    if (!smartWalletService || !smartWalletService.sdkInitialized) return;
    const connectedAccount = await smartWalletService.connectAccount(accountId).catch(() => null);
    if (!connectedAccount) {
      Toast.show({
        message: 'Failed to connect to Smart Wallet account',
        type: 'warning',
        title: 'Unable to upgrade',
        autoClose: false,
      });
      return;
    }
    dispatch({
      type: SET_SMART_WALLET_CONNECTED_ACCOUNT,
      payload: connectedAccount,
    });
    dispatch(setActiveAccountAction(accountId));
  };
};

export const deploySmartWalletAction = () => {
  return async (dispatch: Function, getState: Function) => {
    const {
      smartWallet: {
        connectedAccount: {
          address: accountAddress,
          state: accountState,
        },
        upgrade: {
          status: upgradeStatus,
        },
      },
    } = getState();
    dispatch(setActiveAccountAction(accountAddress));
    if (accountState === sdkConstants.AccountStates.Deployed) {
      dispatch(setSmartWalletUpgradeStatusAction(
        SMART_WALLET_UPGRADE_STATUSES.DEPLOYMENT_COMPLETE,
      ));
      console.log('deploySmartWalletAction account is already deployed!');
      return;
    }
    const deployEstimate = smartWalletService.getDeployEstimate();
    const feeSmartContractDeployEth = parseFloat(formatAmount(utils.formatEther(deployEstimate)));
    const balances = accountBalancesSelector(getState());
    const etherBalance = getBalance(balances, ETH);
    if (etherBalance < feeSmartContractDeployEth) {
      Toast.show({
        message: 'Not enough ETH to make deployment',
        type: 'warning',
        title: 'Unable to upgrade',
        autoClose: false,
      });
      return;
    }
    const deployTxHash = await smartWalletService.deploy();
    console.log('deploySmartWalletAction deployTxHash: ', deployTxHash);
    // depends from where called status might be `deploying` already
    if (upgradeStatus !== SMART_WALLET_UPGRADE_STATUSES.DEPLOYING) {
      await dispatch(setSmartWalletUpgradeStatusAction(
        SMART_WALLET_UPGRADE_STATUSES.DEPLOYING,
      ));
    }
    // update accounts info
    await dispatch(loadSmartWalletAccountsAction());
    const account = await smartWalletService.fetchConnectedAccount();
    dispatch({
      type: SET_SMART_WALLET_CONNECTED_ACCOUNT,
      account,
    });
  };
};

export const addAssetsToSmartWalletUpgradeAction = (assets: AssetTransfer[]) => ({
  type: ADD_SMART_WALLET_UPGRADE_ASSETS,
  payload: assets,
});

export const addCollectiblesToSmartWalletUpgradeAction = (collectibles: CollectibleTransfer[]) => ({
  type: ADD_SMART_WALLET_UPGRADE_COLLECTIBLES,
  payload: collectibles,
});

export const addRecoveryAgentsToSmartWalletUpgradeAction = (recoveryAgents: RecoveryAgent[]) => ({
  type: ADD_SMART_WALLET_RECOVERY_AGENTS,
  payload: recoveryAgents,
});

export const dismissSmartWalletUpgradeAction = () => {
  return async (dispatch: Function) => {
    dispatch(saveDbAction('app_settings', { appSettings: { smartWalletUpgradeDismissed: true } }));
    dispatch({ type: DISMISS_SMART_WALLET_UPGRADE });
  };
};

export const setAssetsTransferTransactionsAction = (transactions: Object[]) => {
  return async (dispatch: Function) => {
    await dispatch(saveDbAction('smartWallet', { upgradeTransferTransactions: transactions }));
    dispatch({
      type: SET_SMART_WALLET_ASSETS_TRANSFER_TRANSACTIONS,
      payload: transactions,
    });
  };
};

export const createAssetsTransferTransactionsAction = (wallet: Object, transactions: Object[]) => {
  return async (dispatch: Function) => {
    // reset local nonce to transaction count
    await dispatch(resetLocalNonceToTransactionCountAction(wallet));
    dispatch(setSmartWalletUpgradeStatusAction(
      SMART_WALLET_UPGRADE_STATUSES.TRANSFERRING_ASSETS,
    ));
    const signedTransactions = [];
    // we need this to wait for each to complete because of local nonce increment
    for (const transaction of transactions) { // eslint-disable-line
      const signedTransaction = await dispatch(signAssetTransactionAction(transaction, wallet)); // eslint-disable-line
      signedTransactions.push({
        transaction,
        signedTransaction,
      });
    }
    // filter out if any of the signed transactions got empty object or error
    const signedTransactionsFixed = signedTransactions.filter(tx =>
      !!tx && !!tx.signedTransaction && Object.keys(tx.signedTransaction),
    );
    dispatch(setAssetsTransferTransactionsAction(signedTransactionsFixed));
  };
};

export const checkAssetTransferTransactionsAction = () => {
  return async (dispatch: Function, getState: Function) => {
    const {
      assets: { data: assets },
      history: {
        data: transactionsHistory,
      },
      collectibles: { transactionHistory: collectiblesHistory = {} },
      smartWallet: {
        upgrade: {
          status: upgradeStatus,
          transfer: {
            transactions: transferTransactions = [],
          },
        },
      },
    } = getState();
    if (upgradeStatus !== SMART_WALLET_UPGRADE_STATUSES.TRANSFERRING_ASSETS) return;
    if (!transferTransactions.length) {
      // TODO: no transactions at all?
      return;
    }

    // update with statuses from history
    // TODO: visit current workaround to get history from all wallets
    const accountIds = Object.keys(transactionsHistory);
    const allHistory = accountIds.reduce(
      // $FlowFixMe
      (existing = [], accountId) => {
        const walletCollectiblesHistory = collectiblesHistory[accountId] || [];
        const walletAssetsHistory = transactionsHistory[accountId] || [];
        return [...existing, ...walletAssetsHistory, ...walletCollectiblesHistory];
      },
      [],
    );
    let updatedTransactions = transferTransactions.map(transaction => {
      const { transactionHash } = transaction;
      if (!transactionHash || transaction.status === TX_CONFIRMED_STATUS) return transaction;
      const logged = allHistory.find(_transaction => _transaction.hash === transactionHash);
      console.log('transaction history check: ', !!logged, transactionHash);
      if (!logged) return transaction;
      return { ...transaction, status: logged.status };
    });

    // if any is still pending then don't do anything
    const pendingTransactions = updatedTransactions.filter(transaction => transaction.status === TX_PENDING_STATUS);
    if (pendingTransactions.length) return;

    const _unsentTransactions = updatedTransactions.filter(transaction => transaction.status !== TX_CONFIRMED_STATUS);
    if (!_unsentTransactions.length) {
      const {
        smartWallet: {
          accounts,
        },
      } = getState();
      // account should be already created by this step
      await dispatch(setSmartWalletUpgradeStatusAction(
        SMART_WALLET_UPGRADE_STATUSES.DEPLOYING,
      ));
      const { address } = accounts[0];
      await dispatch(connectSmartWalletAccountAction(address));
      dispatch(fetchAssetsBalancesAction(assets));
      dispatch(fetchCollectiblesAction());
      await dispatch(deploySmartWalletAction());
    } else {
      const unsentTransactions = _unsentTransactions.sort(
        (_a, _b) => _a.signedTransaction.nonce - _b.signedTransaction.nonce,
      );
      // grab first in queue
      const unsentTransaction = unsentTransactions[0];
      const transactionHash = await dispatch(sendSignedAssetTransactionAction(unsentTransaction));
      if (!transactionHash) {
        Toast.show({
          message: 'Failed to send signed asset',
          type: 'warning',
          title: 'Unable to upgrade',
          autoClose: false,
        });
        return;
      }
      console.log('sent new asset transfer transaction: ', transactionHash);
      const { signedTransaction: { signedHash } } = unsentTransaction;
      updatedTransactions = updatedTransactions.filter(
        transaction => transaction.signedTransaction.signedHash !== signedHash,
      );
      updatedTransactions.push({
        ...unsentTransaction,
        transactionHash,
        status: TX_PENDING_STATUS,
      });
    }
    dispatch(setAssetsTransferTransactionsAction(updatedTransactions));
  };
};

export const upgradeToSmartWalletAction = (wallet: Object, transferTransactions: Object[]) => {
  return async (dispatch: Function, getState: Function) => {
    const {
      smartWallet: {
        sdkInitialized,
      },
    } = getState();
    if (!sdkInitialized) {
      Toast.show({
        message: 'Failed to load Smart Wallet SDK',
        type: 'warning',
        title: 'Unable to upgrade',
        autoClose: false,
      });
      return Promise.reject();
    }
    await dispatch(loadSmartWalletAccountsAction(wallet.privateKey));
    const {
      smartWallet: {
        accounts,
      },
    } = getState();
    if (!accounts.length) {
      Toast.show({
        message: 'Failed to load Smart Wallet account',
        type: 'warning',
        title: 'Unable to upgrade',
        autoClose: false,
      });
      return Promise.reject();
    }
    const { address } = accounts[0];
    const addressedTransferTransactions = transferTransactions.map(transaction => {
      return { ...transaction, to: address };
    });
    await dispatch(createAssetsTransferTransactionsAction(
      wallet,
      addressedTransferTransactions,
    ));
    dispatch(checkAssetTransferTransactionsAction());
    return Promise.resolve(true);
  };
};

export const onSmartWalletSdkEventAction = (event: Object) => {
  return async (dispatch: Function, getState: Function) => {
    if (!event) return;

    const ACCOUNT_DEVICE_UPDATED = get(sdkModules, 'Api.EventNames.AccountDeviceUpdated', '');
    const ACCOUNT_TRANSACTION_UPDATED = get(sdkModules, 'Api.EventNames.AccountTransactionUpdated', '');
    const TRANSACTION_COMPLETED = get(sdkConstants, 'AccountTransactionStates.completed', '');

    if (!ACCOUNT_DEVICE_UPDATED || !ACCOUNT_TRANSACTION_UPDATED || !TRANSACTION_COMPLETED) {
      let path = 'sdkModules.Api.EventNames.AccountDeviceUpdated';
      if (!ACCOUNT_TRANSACTION_UPDATED) path = 'sdkModules.Api.EventNames.AccountTransactionUpdated';
      if (!TRANSACTION_COMPLETED) path = 'sdkConstants.AccountTransactionStates.completed';
      Sentry.captureMessage('Missing Smart Wallet SDK constant', { extra: { path } });
    }

    // on wallet deployed
    const accountState = get(getState(), 'smartWallet.upgrade.status', '');
    if (event.name === ACCOUNT_DEVICE_UPDATED) {
      const newAccountState = get(event, 'payload.state', '');
      const deployedAccountState = sdkConstants.AccountStates.Deployed;
      if (newAccountState === deployedAccountState && accountState !== deployedAccountState) {
        dispatch(setSmartWalletUpgradeStatusAction(SMART_WALLET_UPGRADE_STATUSES.DEPLOYMENT_COMPLETE));
        Toast.show({
          message: 'Your Smart wallet has been deployed',
          type: 'success',
          title: 'Success',
          autoClose: true,
        });
      }
    }

    // manual transactions tracker
    if (event.name === ACCOUNT_TRANSACTION_UPDATED) {
      const {
        history: { data: currentHistory },
        assets: { data: assets },
        paymentNetwork: { txToListen },
      } = getState();
      const txHash = get(event, 'payload.hash', '').toLowerCase();
      const txStatus = get(event, 'payload.state', '');
      const txGasInfo = get(event, 'payload.gas', {});
      const txFound = txToListen.find(hash => hash.toLowerCase() === txHash);

      if (txStatus === TRANSACTION_COMPLETED) {
        if (txFound) {
          let txUpdated = null;
          const accounts = Object.keys(currentHistory);
          const updatedHistory = accounts.reduce((history, accountId) => {
            const accountHistory = currentHistory[accountId].map(transaction => {
              if (transaction.hash.toLowerCase() !== txHash) return transaction;
              txUpdated = {
                ...transaction,
                gasPrice: txGasInfo.price ? txGasInfo.price.toString() : transaction.gasPrice,
                gasUsed: txGasInfo.used ? txGasInfo.used.toNumber() : transaction.gasUsed,
                status: TX_CONFIRMED_STATUS,
              };
              return txUpdated;
            });
            return { ...history, [accountId]: accountHistory };
          }, {});

          if (txUpdated) {
            if (txUpdated.note === PAYMENT_NETWORK_ACCOUNT_TOPUP) {
              Toast.show({
                message: 'Your Pillar Tank was successfully funded!',
                type: 'success',
                title: 'Success',
                autoClose: true,
              });
            }
            dispatch(saveDbAction('history', { history: updatedHistory }, true));
            dispatch({
              type: SET_HISTORY,
              payload: updatedHistory,
            });
            dispatch({
              type: PAYMENT_NETWORK_UNSUBSCRIBE_TX_STATUS,
              payload: txHash,
            });
          }
        }
        dispatch(fetchAssetsBalancesAction(assets));
      }
    }

    // check status for assets transfer during migration
    if (event.name === ACCOUNT_TRANSACTION_UPDATED) {
      const transferTransactions = get(getState('smartWallet.upgrade.transfer.transactions'), '', []);
      const txHash = get(event, 'payload.hash', '').toLowerCase();
      const txStatus = get(event, 'payload.state', '');
      const txFound = transferTransactions.find(({ transactionHash }) => transactionHash === txHash);

      if (txStatus === TRANSACTION_COMPLETED) {
        if (txFound) {
          const updatedTransactions = transferTransactions.filter(
            _tx => _tx.transactionHash !== txFound.transactionHash,
          );
          updatedTransactions.push({
            ...txFound,
            status: TX_CONFIRMED_STATUS,
          });
          await dispatch(setAssetsTransferTransactionsAction(updatedTransactions));
        }
        dispatch(checkAssetTransferTransactionsAction());
      }
    }
    console.log(event);
  };
};

export const ensureSmartAccountConnectedAction = (privateKey: string) => {
  return async (dispatch: Function, getState: Function) => {
    const {
      accounts: { data: accounts },
      smartWallet: { connectedAccount },
    } = getState();

    const accountId = getActiveAccountId(accounts);

    if (!smartWalletService) {
      await dispatch(initSmartWalletSdkAction(privateKey));
    }

    if (!isConnectedToSmartAccount(connectedAccount)) {
      await dispatch(connectSmartWalletAccountAction(accountId));
    }
  };
};

export const estimateTopUpVirtualAccountAction = () => {
  return async (dispatch: Function) => {
    if (!smartWalletService) return;

    const value = ethToWei(0.1);
    const response = await smartWalletService
      .estimateTopUpAccountVirtualBalance(value)
      .catch((e) => {
        Toast.show({
          message: e.toString(),
          type: 'warning',
          autoClose: false,
        });
        return {};
      });

    if (!response || !Object.keys(response).length) return;

    const {
      fixedGas,
      totalGas,
      totalCost,
      gasPrice,
    } = response;

    dispatch({
      type: SET_ESTIMATED_TOPUP_FEE,
      payload: {
        fixedGas,
        totalGas,
        totalCost,
        gasPrice,
      },
    });
  };
};

export const topUpVirtualAccountAction = (amount: string) => {
  return async (dispatch: Function, getState: Function) => {
    if (!smartWalletService) return;

    const { accounts: { data: accounts } } = getState();
    const accountId = getActiveAccountId(accounts);
    const accountAddress = getActiveAccountAddress(accounts);
    const value = ethToWei(parseFloat(amount));

    const estimated = await smartWalletService
      .estimateTopUpAccountVirtualBalance(value)
      .catch((e) => {
        Toast.show({
          message: e.toString(),
          type: 'warning',
          autoClose: false,
        });
        return {};
      });

    if (!estimated || !Object.keys(estimated).length) return;

    const txHash = await smartWalletService.topUpAccountVirtualBalance(estimated)
      .catch((e) => {
        Toast.show({
          message: e.toString() || 'Failed to top up the account',
          type: 'warning',
          autoClose: false,
        });
        return null;
      });

    if (txHash) {
      const historyTx = buildHistoryTransaction({
        from: accountAddress,
        hash: txHash,
        to: accountAddress,
        value,
        asset: ETH,
        note: PAYMENT_NETWORK_ACCOUNT_TOPUP,
      });

      dispatch({
        type: ADD_TRANSACTION,
        payload: {
          accountId,
          historyTx,
        },
      });

      dispatch({
        type: PAYMENT_NETWORK_SUBSCRIBE_TO_TX_STATUS,
        payload: txHash,
      });

      const { history: { data: currentHistory } } = getState();
      dispatch(saveDbAction('history', { history: currentHistory }, true));

      Toast.show({
        message: 'Your Pillar Tank will be funded soon',
        type: 'success',
        title: 'Success',
        autoClose: true,
      });
    }
  };
};

export const fetchVirtualAccountBalanceAction = () => {
  return async (dispatch: Function, getState: Function) => {
    if (!smartWalletService) return;
    const {
      accounts: { data: accounts },
      session: { data: { isOnline } },
      smartWallet: { connectedAccount, sdkInitialized },
    } = getState();

    if ((!smartWalletService.sdkInitialized || !sdkInitialized) && isOnline) {
      navigate(NavigationActions.navigate({
        routeName: SMART_WALLET_UNLOCK,
        params: {
          successNavigateScreen: ASSETS,
        },
      }));
      return;
    }

    if (!isConnectedToSmartAccount(connectedAccount) || !isOnline) return;

    const accountId = getActiveAccountId(accounts);
    const virtualBalance = smartWalletService.getAccountVirtualBalance();
    const balanceInEth = !virtualBalance.eq(0) ? weiToEth(virtualBalance).toString() : '0';

    const accountBalances = {
      [ETH]: {
        balance: balanceInEth,
        symbol: ETH,
      },
    };

    const { paymentNetwork: { balances } } = getState();
    const updatedBalances = {
      ...balances,
      [accountId]: accountBalances,
    };
    dispatch(saveDbAction('paymentNetworkBalances', { paymentNetworkBalances: updatedBalances }, true));

    dispatch({
      type: UPDATE_PAYMENT_NETWORK_ACCOUNT_BALANCES,
      payload: {
        accountId,
        balances: accountBalances,
      },
    });
  };
};

export const settleBalancesAction = (assetsToSettle: Object[]) => {
  return async (dispatch: Function, getState: Function) => {
    if (!smartWalletService) return;
    // NOTE: while we support only the ETH settlement we can ignore the assetsToSettle array
    console.log({ assetsToSettle });

    const balances = paymentNetworkAccountBalancesSelector(getState());
    const ethBalance = getBalance(balances, ETH);
    const balanceInWei = ethToWei(parseFloat(ethBalance));

    const estimated = await smartWalletService
      .estimateWithdrawFromAccountVirtualBalance(balanceInWei)
      .catch((e) => {
        let errorMessage = 'You need to deposit ETH to cover the withdrawal';
        if (typeof e === 'object' && get(e, 'errors.value') === 'tooHigh') {
          errorMessage = 'You\'re trying to withdraw more funds then you have';
        }
        Toast.show({
          message: errorMessage,
          type: 'warning',
          autoClose: false,
        });
        return {};
      });

    if (!estimated || !Object.keys(estimated).length) return;

    const txHash = await smartWalletService.withdrawAccountVirtualBalance(estimated)
      .catch((e) => {
        Toast.show({
          message: e.toString() || 'Failed to withdraw the balance',
          type: 'warning',
          autoClose: false,
        });
        return null;
      });

    if (txHash) {
      // TODO: create tx history record
      Toast.show({
        message: 'Settlement was successful. Please wait for transaction to be mined',
        type: 'success',
        title: 'Success',
        autoClose: true,
      });
    }
  };
};

export const cleanSmartWalletAccountsAction = () => {
  return async (dispatch: Function, getState: Function) => {
    const {
      accounts: { data: accounts },
      balances: { data: balances },
      history: { data: history },
    } = getState();

    const activeAccount = accounts.find(({ isActive }) => isActive);
    const keyBasedAccount = accounts.find(({ type }) => type === ACCOUNT_TYPES.KEY_BASED);
    const smartAccounts = accounts.filter(({ type }) => type === ACCOUNT_TYPES.SMART_WALLET);

    if (!smartAccounts.length) {
      Toast.show({
        message: 'Smart Accounts not found',
        type: 'warning',
        autoClose: false,
      });
      return;
    }

    dispatch({
      type: UPDATE_ACCOUNTS,
      payload: [keyBasedAccount],
    });
    dispatch(saveDbAction('accounts', { accounts: [keyBasedAccount] }, true));

    const updatedBalances = { [keyBasedAccount.id]: balances[keyBasedAccount.id] };
    dispatch(saveDbAction('balances', { balances: updatedBalances }, true));
    dispatch({
      type: UPDATE_BALANCES,
      payload: updatedBalances,
    });

    const updatedHistory = { [keyBasedAccount.id]: history[keyBasedAccount.id] };
    dispatch(saveDbAction('history', { history: updatedHistory }, true));
    dispatch({
      type: SET_HISTORY,
      payload: updatedHistory,
    });

    if (activeAccount.type === ACCOUNT_TYPES.SMART_WALLET) {
      dispatch(switchAccountAction(keyBasedAccount.id));
    }

    Toast.show({
      message: 'Smart Accounts cleaned',
      type: 'success',
      autoClose: false,
    });
  };
};