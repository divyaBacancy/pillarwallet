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
import { useNavigation } from 'react-navigation-hooks';
import styled from 'styled-components/native';
import { useTranslationWithPrefix } from 'translations/translate';

// Constants
import { CHAINS } from 'constants/assetsConstants';
import { ASSETS, CONTACTS_FLOW, SERVICES_FLOW } from 'constants/navigationConstants';

// Selectors
import { useFiatCurrency } from 'selectors';

// Utils
import { formatValue, formatFiatValue, formatFiatProfit } from 'utils/format';
import { useChainsConfig, useAssetCategoriesConfig } from 'utils/uiConfig';
import { useThemeColors } from 'utils/themes';

// Types
import type { ChainSummaries, ChainBalances, Balance } from 'models/Home';
import type { Chain, AssetCategory } from 'models/Asset';

// Local
import HomeListHeader from './components/HomeListHeader';
import HomeListItem from './components/HomeListItem';

type Props = {|
  chainSummaries: ChainSummaries,
  chainBalances: ChainBalances,
  showSideChains: boolean,
|};

function AssetsSection({ chainSummaries, chainBalances, showSideChains }: Props) {
  const { t, tRoot } = useTranslationWithPrefix('home.assets');
  const navigation = useNavigation();

  const fiatCurrency = useFiatCurrency();

  const chainsConfig = useChainsConfig();
  const categoriesConfig = useAssetCategoriesConfig();
  const colors = useThemeColors();

  const renderChain = (chain: Chain) => {
    const summary = chainSummaries[chain];
    const { title, iconName, color } = chainsConfig[chain];
    return (
      <>
        <HomeListHeader title={title} iconName={iconName} color={color} walletAddress={summary?.walletAddress} />
        {renderChainItems(chain)}
      </>
    );
  };

  const renderChainItems = (chain: Chain) => {
    const summary = chainSummaries[chain];
    const categoryBalances = chainBalances[chain];

    if (!summary && !categoryBalances) return null;

    return (
      <>
        {!!categoryBalances &&
          Object.keys(categoryBalances).map((category) =>
            renderBalanceItem(chain, category, categoryBalances[category]),
          )}

        {summary?.collectibleCount != null && (
          <HomeListItem
            title={tRoot('assetCategories.collectibles')}
            iconName="collectible"
            onPress={() => navigation.navigate(ASSETS)}
            value={formatValue(summary.collectibleCount)}
          />
        )}

        {summary?.contactCount != null && (
          <HomeListItem
            title={t('contacts')}
            iconName="contacts"
            onPress={() => navigation.navigate(CONTACTS_FLOW)}
            value={formatValue(summary.contactCount)}
          />
        )}

        {/* Temporary entry until other UI provided */}
        {chain === CHAINS.ETHEREUM && (
          <HomeListItem title={t('services')} iconName="info" onPress={() => navigation.navigate(SERVICES_FLOW)} />
        )}
      </>
    );
  };

  const renderBalanceItem = (chain: Chain, category: AssetCategory, balance: ?Balance) => {
    if (!balance || !categoriesConfig[category]) return null;

    const formattedBalance = formatFiatValue(balance?.balanceInFiat ?? 0, fiatCurrency);
    const formattedProfit = formatFiatProfit(balance.profitInFiat, balance.balanceInFiat, fiatCurrency);
    const { title, iconName } = categoriesConfig[category];

    return (
      <HomeListItem
        key={`${chain}-${category}`}
        title={title}
        iconName={iconName}
        onPress={() => navigation.navigate(ASSETS, { category })}
        value={formattedBalance}
        secondaryValue={formattedProfit}
        secondaryValueColor={balance.profitInFiat?.gte(0) ? colors.positive : colors.secondaryText}
      />
    );
  };

  if (!showSideChains) {
    return <Container>{renderChainItems(CHAINS.ETHEREUM)}</Container>;
  }

  return <Container>{Object.keys(chainBalances).map((key) => renderChain(key))}</Container>;
}

export default AssetsSection;

const Container = styled.View``;
