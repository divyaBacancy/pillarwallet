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

import * as React from 'react';
import { orderBy, groupBy } from 'lodash';

// Models
import type { Theme } from 'models/Theme';

// Utils
import { formatHexAddress } from 'utils/format';
import { humanizeDateString, formatDate } from 'utils/date';

// Types
import type { SectionBase } from 'utils/types/react-native';
import type { HistoryItem } from 'models/History';

// Local
import HistoryListItem, { TextValue, TokenValue } from './HistoryListItem';

export type HistorySection = {
  ...SectionBase<HistoryItem>,
  title: string,
};

export function mapHistoryItemsToSections(items: HistoryItem[]): HistorySection[] {
  const sortedItems = orderBy(items, ['date'], ['desc']);
  const groups = groupBy(sortedItems, (item) => formatDate(item.date));

  return Object.keys(groups).map((key: string) => ({
    title: humanizeDateString(key),
    data: groups[key],
  }));
}

export function renderHistoryItem(item: HistoryItem, theme: Theme): React.Element<any> {
  if (item.type === 'walletEvent') {
    return (
      <HistoryListItem
        title={item.title}
        subtitle={item.subtitle}
        iconName="wallet"
        iconColor={theme.colors.neutral}
        iconBorderColor={theme.colors.neutralWeak}
        rightComponent={<TextValue>{item.event}</TextValue>}
      />
    );
  }

  if (item.type === 'sent') {
    return (
      <HistoryListItem
        title={formatHexAddress(item.to)}
        iconName="send"
        iconColor={theme.colors.negative}
        iconBorderColor={theme.colors.negativeWeak}
        rightComponent={<TokenValue symbol={item.value.symbol} value={item.value.value.negated()} />}
      />
    );
  }

  if (item.type === 'received') {
    return (
      <HistoryListItem
        title={formatHexAddress(item.from)}
        iconName="send-down"
        iconColor={theme.colors.positive}
        iconBorderColor={theme.colors.positiveWeak}
        rightComponent={<TokenValue symbol={item.value.symbol} value={item.value.value} />}
      />
    );
  }

  return <HistoryListItem title="Not supported tx" iconName="question" />;
}
