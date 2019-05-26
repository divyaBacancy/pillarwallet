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
import * as React from 'react';
import { connect } from 'react-redux';
import { TouchableOpacity, Keyboard } from 'react-native';
import t from 'tcomb-form-native';
import { utils } from 'ethers';
import { BigNumber } from 'bignumber.js';
import styled from 'styled-components/native';
import { createStructuredSelector } from 'reselect';
import get from 'lodash.get';
import { SDK_PROVIDER } from 'react-native-dotenv';

// components
import { Container, Footer, Wrapper } from 'components/Layout';
import Button from 'components/Button';
import { TextLink, Label, BaseText } from 'components/Typography';
import Header from 'components/Header';

// utils
import { formatAmount, getCurrencySymbol, formatMoney } from 'utils/common';
import { fontSizes, spacing, UIColors } from 'utils/variables';
import { getBalance, getRate, calculateMaxAmount, checkIfEnoughForFee } from 'utils/assets';
import { makeAmountForm, getAmountFormFields } from 'utils/formHelpers';

// types
import type { NavigationScreenProp } from 'react-navigation';
import type { TopUpFee } from 'models/PaymentNetwork';
import type { Assets, Balances, Rates } from 'models/Asset';

// constants
import { FUND_CONFIRM } from 'constants/navigationConstants';
import { ETH, defaultFiatCurrency } from 'constants/assetsConstants';

// actions
import { estimateTopUpVirtualAccountAction } from 'actions/smartWalletActions';

// selectors
import { accountBalancesSelector } from 'selectors/balances';


const ActionsWrapper = styled.View`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
`;

const SendTokenDetails = styled.View``;

const SendTokenDetailsValue = styled(BaseText)`
  font-size: ${fontSizes.small};
  margin-bottom: 8px;
`;

const HelperText = styled(BaseText)`
  font-size: ${fontSizes.small};
  margin-bottom: ${spacing.rhythm / 2}px;
  color: ${UIColors.placeholderTextColor};
`;

const FooterInner = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: flex-end;
  width: 100%;
`;

type Props = {
  assets: Assets,
  navigation: NavigationScreenProp<*>,
  balances: Balances,
  session: Object,
  estimateTopUpVirtualAccount: Function,
  topUpFee: TopUpFee,
  rates: Rates,
  baseFiatCurrency: string,
};

type State = {
  value: ?{
    amount: ?string,
  },
};

const { Form } = t.form;
const MIN_TX_AMOUNT = 0.000000000000000001;

class FundTank extends React.Component<Props, State> {
  _form: t.form;
  formSubmitted: boolean = false;
  enoughForFee: boolean = false;
  state = {
    value: null,
  };

  componentDidMount() {
    this.props.estimateTopUpVirtualAccount();
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.session.isOnline !== this.props.session.isOnline && this.props.session.isOnline) {
      this.props.estimateTopUpVirtualAccount();
    }
  }

  handleChange = (value: Object) => {
    this.setState({ value });
  };

  handleFormSubmit = () => {
    this.formSubmitted = true;
    const { navigation } = this.props;
    const value = this._form.getValue();

    if (!value) return;

    Keyboard.dismiss();
    navigation.navigate(FUND_CONFIRM, { value });
  };

  useMaxValue = () => {
    const { balances } = this.props;
    const txFeeInWei = this.getTxFeeInWei();
    const token = ETH;
    const balance = getBalance(balances, token);
    const maxAmount = calculateMaxAmount(token, balance, txFeeInWei);
    this.enoughForFee = checkIfEnoughForFee(balances, txFeeInWei);
    this.setState({
      value: {
        amount: formatAmount(maxAmount),
      },
    });
  };

  getTxFeeInWei = (): BigNumber => {
    return get(this.props, 'topUpFee.feeInfo.totalCost', 0);
  };

  render() {
    const { value } = this.state;
    const {
      assets,
      session,
      balances,
      topUpFee,
      rates,
      baseFiatCurrency,
    } = this.props;

    const { symbol: token, iconUrl, decimals } = assets[ETH] || {};
    const icon = iconUrl ? `${SDK_PROVIDER}/${iconUrl}?size=3` : '';
    const fiatCurrency = baseFiatCurrency || defaultFiatCurrency;
    const currencySymbol = getCurrencySymbol(fiatCurrency);

    // balance
    const balance = getBalance(balances, token);
    const formattedBalance = formatAmount(balance);

    // balance in fiat
    const totalInFiat = balance * getRate(rates, token, fiatCurrency);
    const formattedBalanceInFiat = formatMoney(totalInFiat);

    // fee
    const txFeeInWei = this.getTxFeeInWei();
    const isEnoughForFee = checkIfEnoughForFee(balances, txFeeInWei);
    const feeInEth = formatAmount(utils.formatEther(this.getTxFeeInWei()));

    // max amount
    const maxAmount = calculateMaxAmount(token, balance, txFeeInWei);

    // value
    const currentValue = (!!value && !!parseFloat(value.amount)) ? parseFloat(value.amount) : 0;

    // value in fiat
    const valueInFiat = currentValue * getRate(rates, token, fiatCurrency);
    const formattedValueInFiat = formatMoney(valueInFiat);
    const valueInFiatOutput = `${currencySymbol}${formattedValueInFiat}`;

    // form
    const formStructure = makeAmountForm(maxAmount, MIN_TX_AMOUNT, isEnoughForFee, this.formSubmitted, decimals);
    const formFields = getAmountFormFields({
      icon,
      currency: token,
      valueInFiatOutput,
      customProps: {
        noTint: true,
        floatingImageStyle: { marginRight: 3 },
        white: true,
      },
    });

    return (
      <Container>
        <Header
          onBack={() => this.props.navigation.goBack(null)}
          title="fund plr tank"
          white
        />
        <Wrapper regularPadding>
          <Form
            ref={node => { this._form = node; }}
            type={formStructure}
            options={formFields}
            value={value}
            onChange={this.handleChange}
          />
          <ActionsWrapper>
            <SendTokenDetails>
              <Label small>Available Balance</Label>
              <SendTokenDetailsValue>
                {formattedBalance} {token}
                <HelperText> ({currencySymbol}{formattedBalanceInFiat})</HelperText>
              </SendTokenDetailsValue>
            </SendTokenDetails>
            <TouchableOpacity onPress={this.useMaxValue}>
              <TextLink>Send All</TextLink>
            </TouchableOpacity>
          </ActionsWrapper>
        </Wrapper>
        <Footer keyboardVerticalOffset={35}>
          <FooterInner>
            <Label>{`Estimated fee ${feeInEth} ETH`}</Label>
            {!!value && !!parseFloat(value.amount) &&
              <Button
                disabled={!session.isOnline || !topUpFee.isFetched}
                small
                flexRight
                title="Next"
                onPress={this.handleFormSubmit}
              />
            }
          </FooterInner>
        </Footer>
      </Container>
    );
  }
}

const mapStateToProps = ({
  assets: { data: assets },
  session: { data: session },
  rates: { data: rates },
  paymentNetwork: { topUpFee },
  appSettings: { data: { baseFiatCurrency } },
}) => ({
  assets,
  rates,
  session,
  topUpFee,
  baseFiatCurrency,
});

const structuredSelector = createStructuredSelector({
  balances: accountBalancesSelector,
});

const combinedMapStateToProps = (state) => ({
  ...structuredSelector(state),
  ...mapStateToProps(state),
});

const mapDispatchToProps = (dispatch) => ({
  estimateTopUpVirtualAccount: () => dispatch(estimateTopUpVirtualAccountAction()),
});

export default connect(combinedMapStateToProps, mapDispatchToProps)(FundTank);
