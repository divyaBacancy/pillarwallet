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

import { BigNumber } from 'bignumber.js';
import type { ImageSource } from 'utils/types/react-native';

type HistoryItemCommon = {|
  id: string,
  date: Date,
|};

type TokenValue = {|
  symbol: string,
  value: BigNumber,
|};

export type HistoryItem =
  | HistoryItemReceived
  | HistoryItemSent
  | HistoryItemExchange
  | HistoryItemWalletEvent
  | HistoryItemBadgeEvent
  | HistoryItemUnknown;

export type HistoryItemReceived = {|
  ...HistoryItemCommon,
  type: 'received',
  from: string, // ENS or hex
  to: string, // ENS or hex
  value: TokenValue,
|};

export type HistoryItemSent = {|
  ...HistoryItemCommon,
  type: 'sent',
  from: string, // ENS or hex
  to: string, // ENS or hex
  value: TokenValue,
|};

export type HistoryItemExchange = {|
  ...HistoryItemCommon,
  type: 'exchange',
  fromValue: TokenValue,
  toValue: TokenValue,
|};

export type HistoryItemWalletEvent = {|
  ...HistoryItemCommon,
  type: 'walletEvent',
  title: string,
  subtitle?: string,
  event: string,
|};

export type HistoryItemBadgeEvent = {|
  ...HistoryItemCommon,
  type: 'badgeEvent',
  title: string,
  subtitle?: string,
  event: string,
  iconUrl: ?string,
|};

export type HistoryItemUnknown = {|
  ...HistoryItemCommon,
  type: 'unknown',
|};
