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
import type { Option } from './Selector';

type Value = string | number;

type SelectorValueType = {
  input: string | number,
  selector: {
    icon?: string,
    iconFallback?: string,
    value: string | number,
  }
};

export type InputPropsType = {
  placeholder?: string,
  onChange: (Value | SelectorValueType) => void,
  onBlur?: (Value | SelectorValueType) => void,
  onFocus?: () => void,
  onSubmit?: () => void,
  value: Value,
  selectorValue: SelectorValueType,
  onSelectorClose: () => void,
  multiline?: boolean,
  onSelectorOpen?: () => void,
  onSelectorChange?: () => void,
  label?: string,
  rightLabel?: string,
  onPressRightLabel?: () => void,
  inputHeaderStyle?: Object,
  customLabel?: React.Node,
  editable?: boolean,
  inputAccessoryViewID?: string,
  customRightLabel?: React.Node,
};

export type SelectorOptions = {
  options?: Option[],
  selectorPlaceholder?: 'string',
  fullWidth?: boolean,
  showOptionsTitles?: boolean,
  optionsTitle?: string,
  selectorModalTitle?: string,
  optionsSearchPlaceholder?: string,
  displayFiatOptionsFirst?: boolean,
};

export type FormSelector = {
  selector: Object,
  input: string,
  dontCheckBalance?: boolean,
};
