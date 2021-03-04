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

/* eslint-disable no-unused-expressions */

import * as React from 'react';
import { Keyboard, FlatList } from 'react-native';
import { useDispatch } from 'react-redux';
import styled, { useTheme } from 'styled-components/native';
import Clipboard from '@react-native-community/clipboard';
import t from 'translations/translate';

// Actions
import { addContactAction } from 'actions/contactsActions';
import { goToInvitationFlowAction } from 'actions/referralsActions';

// Components
import { Spacing } from 'components/Layout';
import AddressScanner from 'components/QRCodeScanner/AddressScanner';
import Button from 'components/Button';
import ContactDetailsModal from 'components/ContactDetailsModal';
import ContainerWithHeader from 'components/Layout/ContainerWithHeader';
import EmptyStateParagraph from 'components/EmptyState/EmptyStateParagraph';
import FloatingButtons from 'components/FloatingButtons';
import ListItemWithImage from 'components/ListItem/ListItemWithImage';
import Modal from 'components/Modal';
import SearchBar from 'components/SearchBar';
import SlideModal from 'components/Modals/SlideModal';

// Selectors
import { useRootSelector, activeAccountAddressSelector } from 'selectors';

// Utils
import { addressesEqual } from 'utils/assets';
import { getMatchingSortedData } from 'utils/textInput';
import { getThemeColors } from 'utils/themes';
import { isValidAddressOrEnsName } from 'utils/validators';
import { spacing } from 'utils/variables';

// Types
import type { Contact } from 'models/Contact';

type Props = {|
  contacts?: Contact[],
  onSelectContact?: (contact: ?Contact) => mixed,
  allowCustomAddress?: boolean,
  allowAddContact?: boolean,
  title?: string,
  searchPlaceholder?: string,
|};

const MIN_QUERY_LENGTH = 2;

const ContactSelectorOptions = ({
  contacts = [],
  onSelectContact,
  allowCustomAddress = true,
  allowAddContact = true,
  title = t('label.sendTo'),
  searchPlaceholder = t('label.walletAddressEnsUser'),
}: Props) => {
  const theme = useTheme();
  const colors = getThemeColors(theme);

  const searchInputRef = React.useRef(null);
  const modalRef = React.useRef(null);

  const [query, setQuery] = React.useState('');
  const [customAddressContact, setCustomAddressContact] = React.useState(null);
  const [hasSearchError, setHasSearchError] = React.useState(false);

  const dispatch = useDispatch();
  const activeAccountAddress = useRootSelector(activeAccountAddressSelector);

  const close = () => {
    Keyboard.dismiss();
    modalRef.current?.close();
  };

  const handleInputChange = (input: string) => {
    input = input?.trim() ?? '';
    setQuery(input);

    if (allowCustomAddress) {
      const isValid = isValidAddressOrEnsName(input);
      setCustomAddressContact(isValid ? { name: input, ethAddress: input } : null);
    }
  };

  const selectValue = async (contact: Contact) => {
    onSelectContact?.(contact);
    close();
  };

  const handlePaste = async () => {
    const clipboardValue = await Clipboard.getString();
    handleInputChange(clipboardValue);
  };

  const handleAddToContactsPress = async (contact?: Contact) => {
    Modal.open(() => (
      <ContactDetailsModal
        title={t('title.addNewContact')}
        contact={contact}
        contacts={contacts}
        onSave={(savedContact: Contact) => {
          dispatch(addContactAction(savedContact));
          selectValue(savedContact);
        }}
      />
    ));
  };

  const validateSearch = (searchQuery: string) => {
    if (addressesEqual(searchQuery, activeAccountAddress)) {
      setHasSearchError(true);
      return t('error.cannotSendYourself');
    }

    if (hasSearchError) {
      setHasSearchError(false);
    }

    return null;
  };

  const handleScannerRead = (address: string) => {
    if (isValidAddressOrEnsName(address)) {
      selectValue({ name: address, ethAddress: address });
    }
  };

  const openScanner = () => {
    Keyboard.dismiss();
    Modal.open(() => <AddressScanner onRead={handleScannerRead} />);
  };

  const renderItem = (item: Contact) => {
    return <ListItemWithImage label={item.name} onPress={() => selectValue(item)} />;
  };

  const isSearching = query && query.length >= MIN_QUERY_LENGTH;
  const filteredContacts: Contact[] = isSearching ? getMatchingSortedData(contacts, query) : contacts;

  const renderEmptyStateIfNeeded = () => {
    if (filteredContacts?.length || customAddressContact) return null;

    if (!query) {
      return (
        <EmptyStateWrapper>
          <EmptyStateParagraph title={t('label.noContacts')} bodyText={t('paragraph.addContacts')} />
        </EmptyStateWrapper>
      );
    }

    return (
      <EmptyStateWrapper>
        <EmptyStateParagraph title={allowCustomAddress ? t('error.invalid.address') : t('label.nothingFound')} />
      </EmptyStateWrapper>
    );
  };

  let items: Contact[] = [];
  if (filteredContacts.length) {
    items = [...filteredContacts];
  } else if (!hasSearchError && customAddressContact) {
    items = [customAddressContact];
  }

  const buttons = [
    {
      title: t('button.addContact'),
      iconName: 'add-contact',
      onPress: () => handleAddToContactsPress(),
    },
    {
      title: t('button.inviteFriend'),
      iconName: 'plus',
      onPress: () => dispatch(goToInvitationFlowAction()),
    },
  ];

  return (
    <SlideModal
      ref={modalRef}
      fullScreen
      onModalShow={() => searchInputRef.current?.focus()}
      noSwipeToDismiss
      noClose
      backgroundColor={colors.basic050}
      noTopPadding
    >
      <ContainerWithHeader
        headerProps={{
          noPaddingTop: true,
          customOnBack: close,
          centerItems: [{ title }],
          rightItems: [
            {
              icon: 'qrcode',
              onPress: openScanner,
              fontSize: 18,
              color: colors.basic020,
            },
          ],
        }}
        inset={{ bottom: 'never' }}
      >
        <SearchContainer>
          <SearchBarWrapper>
            <SearchBar
              inputProps={{
                value: query,
                onChange: handleInputChange,
                autoCapitalize: 'none',
                validator: validateSearch,
              }}
              inputRef={searchInputRef}
              placeholder={searchPlaceholder}
              noClose
              marginBottom="0"
              iconProps={{ persistIconOnFocus: true }}
            />
          </SearchBarWrapper>

          <Button onPress={handlePaste} title={t('button.paste')} transparent small />
        </SearchContainer>

        <FlatList
          data={items}
          renderItem={({ item }) => renderItem(item)}
          keyExtractor={(contact) => contact.ethAddress || contact.name}
          keyboardShouldPersistTaps="always"
          ListEmptyComponent={renderEmptyStateIfNeeded()}
          contentContainerStyle={{ flex: 1, paddingBottom: FloatingButtons.SCROLL_VIEW_BOTTOM_INSET }}
        />

        {allowAddContact && !customAddressContact && <FloatingButtons items={buttons} />}

        {allowAddContact && customAddressContact && !hasSearchError && (
          <ActionButtonsContainer>
            <Button
              title={t('button.addToAddressBook')}
              onPress={() => handleAddToContactsPress(customAddressContact)}
            />

            <Spacing h={spacing.small} />

            <Button secondary title={t('button.skip')} onPress={() => selectValue(customAddressContact)} />
          </ActionButtonsContainer>
        )}
      </ContainerWithHeader>
    </SlideModal>
  );
};

export default ContactSelectorOptions;

const EmptyStateWrapper = styled.View`
  flex: 1;
  justify-content: center;
  align-items: center;
`;

const SearchContainer = styled.View`
  flex-direction: row;
  align-items: center;
  padding-vertical: ${spacing.small}px;
  padding-start: ${spacing.layoutSides}px;
`;

const SearchBarWrapper = styled.View`
  flex: 1;
`;

const ActionButtonsContainer = styled.View`
  padding-horizontal: ${spacing.large}px;
  padding-bottom: ${spacing.extraLarge}px;
`;