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
import t from 'translations/translate';

import { getCurrencySymbol } from 'utils/common';

/**
 * Modern formatting functions.
 *
 * Common assumptions:
 * - output user-facing strings
 * - numeric input as BigNumber
 * - accepts null and undefined values but returns null instead of formatted value as well as NaNs and ininity
 */

type FormatValueOptions = {|
  decimalPlaces?: number, // default: undefined -> full precision
  stripTrailingZeros?: boolean, // default: false
|};

/**
 * Generic formattting function.
 *
 * Does not make assumption about formatted output.
 */
export function formatValue(value: ?BigNumber, options?: FormatValueOptions) {
  if (!value || !value.isFinite()) return null;

  const stripTrailingZeros = options?.stripTrailingZeros ?? false;

  if (options?.decimalPlaces != null) {
    value = value.decimalPlaces(options?.decimalPlaces, BigNumber.ROUND_DOWN);
  }

  return stripTrailingZeros ? value.toFormat() : value.toFormat(options?.decimalPlaces, BigNumber.ROUND_DOWN);
}

/**
 * Format percent value.
 * By defaults outputs 1 decimal places, without stripping zeros.
 *
 * Examples:
 *   0.5 => '50.0%'
 *   -0.01234 => '-1.2%'
 *
 */
export function formatPercentValue(value: ?BigNumber, options?: FormatValueOptions) {
  if (!value || !value.isFinite()) return null;

  return t('percentValue', { value: formatValue(value.multipliedBy(100), { decimalPlaces: 1, ...options }) });
}

/**
 * Format percent change with +/- sign.
 * By defaults outputs 2 decimal places, without stripping zeros.
 *
 * Examples:
 *   0.5 => '+50.00%'
 *   -0.01234 => '-1.23%'
 *
 */
export function formatPercentChange(value: ?BigNumber, options?: FormatValueOptions) {
  if (!value || !value.isFinite()) return null;

  return value.gte(0)
    ? t('positivePercentValue', { value: formatValue(value.multipliedBy(100), { decimalPlaces: 2, ...options }) })
    : t('percentValue', { value: formatValue(value.multipliedBy(100), { decimalPlaces: 2, ...options }) });
}

/**
 * Format value with K, M, B units if needed.
 * By defaults outputs 2 decimal places, without stripping zeros.
 *
 * Examples:
 *   1000 => '1.00K'
 *   1234000 => '1.23M'
 *
 */
export function formatValueWithUnit(value: ?BigNumber, options?: FormatValueOptions) {
  if (!value || !value.isFinite()) return null;

  const threshold = 0.85;

  if (value.gte(threshold * 1e12)) {
    return t('units.1e12', { value: formatValue(value.dividedBy(1e12), { decimalPlaces: 2, ...options }) });
  }

  if (value.gte(threshold * 1e9)) {
    return t('units.1e9', { value: formatValue(value.dividedBy(1e9), { decimalPlaces: 2, ...options }) });
  }

  if (value.gte(threshold * 1e6)) {
    return t('units.1e6', { value: formatValue(value.dividedBy(1e6), { decimalPlaces: 2, ...options }) });
  }

  if (value.gte(threshold * 1e3)) {
    return t('units.1e3', { value: formatValue(value.dividedBy(1e3), { decimalPlaces: 2, ...options }) });
  }

  return formatValue(value, { decimalPlaces: 2, ...options });
}

type FormatFiatValueOptions = {|
  exact: boolean, // default: false
|};

export function formatFiatValue(value: ?BigNumber, currency?: string, options?: FormatFiatValueOptions) {
  const formattedValue = options?.exact ? formatValue(value, { decimalPlaces: 2 }) : formatValueWithUnit(value);
  if (!formattedValue) return null;

  return currency ? t('fiatValue', { value: formattedValue, symbol: getCurrencySymbol(currency) }) : formattedValue;
}

/**
 * Formats profit as `+10.00% ($100.00)`.
 *
 * Handles edge cases of missing profit and/or balance values.
 */
export function formatFiatProfit(profit: ?BigNumber, balance: ?BigNumber, currency: string) {
  if (!profit || !profit.isFinite()) return null;

  if (profit.isZero()) return formatPercentChange(BigNumber(0));

  const formattedProfitInFiat = formatFiatValue(profit, currency);
  const formattedProfitInPercent = balance != null ? formatPercentChange(profit.dividedBy(balance)) : null;

  if (formattedProfitInFiat && formattedProfitInPercent) {
    return `${formattedProfitInPercent} (${formattedProfitInFiat})`;
  }

  if (formattedProfitInFiat) return formattedProfitInFiat;

  return null;
}
