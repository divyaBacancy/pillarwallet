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
import {
  RefreshControl,
  Platform,
  View,
  // FlatList,
} from 'react-native';
import { connect } from 'react-redux';
import styled from 'styled-components/native';
import type { NavigationScreenProp } from 'react-navigation';
import { ImageCacheManager } from 'react-native-cached-image';
import { baseColors, fontSizes } from 'utils/variables';
import {
  syncContactAction,
  disconnectContactAction,
  muteContactAction,
  blockContactAction,
} from 'actions/contactsActions';
import { fetchContactTransactionsAction } from 'actions/historyActions';
import { ScrollWrapper } from 'components/Layout';
import ContainerWithBottomSheet from 'components/Layout/ContainerWithBottomSheet';
import { BADGE, SEND_TOKEN_FROM_CONTACT_FLOW } from 'constants/navigationConstants';
import { DISCONNECT, MUTE, BLOCK } from 'constants/connectionsConstants';
import { TRANSACTIONS } from 'constants/activityConstants';
import { CHAT, ACTIVITY } from 'constants/tabsConstants';
import Header from 'components/Header';
import ProfileImage from 'components/ProfileImage';
import CircleButton from 'components/CircleButton';
import ActivityFeed from 'components/ActivityFeed';
import ChatTab from 'components/ChatTab';
import BadgeTouchableItem from 'components/BadgeTouchableItem';
import EmptyStateParagraph from 'components/EmptyState/EmptyStateParagraph';
// import { CollapsibleSection } from 'components/CollapsibleSection';
import type { ApiUser } from 'models/Contacts';
import ConnectionConfirmationModal from './ConnectionConfirmationModal';
import ManageContactModal from './ManageContactModal';

const iconSend = require('assets/icons/icon_send.png');

const ContactWrapper = styled.View`
  position: relative;
  justify-content: center;
  align-items: center;
  margin: 5px 20px 20px;
  padding-top: ${Platform.select({
    ios: '15px',
    android: '9px',
  })};
`;

const CircleButtonsWrapper = styled.View`
  margin-top: ${Platform.select({
    ios: '30px',
    android: '15px',
  })};
  padding-top: 20px;
  padding-bottom: 30px;
  background-color: ${baseColors.snowWhite};
  border-top-width: 1px;
  border-bottom-width: 1px;
  border-color: ${baseColors.mediumLightGray};
  justify-content: center;
  align-items: center;
`;

const SheetContentWrapper = styled.View`
  flex: 1;
  padding-top: 30px;
`;

// const EmptyStateParagraphWrapper = styled.View`
//   margin-bottom: 30px;
//   align-items: center;
// `;

type Props = {
  name: string,
  navigation: NavigationScreenProp<*>,
  contacts: ApiUser[],
  syncContact: Function,
  fetchContactTransactions: (walletAddress: string, contactAddress: string, asset?: string) => Function,
  wallet: Object,
  chats: Object[],
  session: Object,
  disconnectContact: Function,
  muteContact: Function,
  blockContact: Function,
};

type State = {
  showManageContactModal: boolean,
  showConfirmationModal: boolean,
  manageContactType: string,
  activeTab: string,
  isSheetOpen: boolean,
  forceOpen: boolean,
  collapsedActivityHeight: ?number,
  collapsedChatHeight: ?number,
  // isBadgesSectionOpen: boolean,
};

class Contact extends React.Component<Props, State> {
  isComponentMounted: boolean = false;
  localContact: ?ApiUser;
  activityFeedRef: ?Object;
  scroll: Object;

  constructor(props: Props) {
    super(props);
    const { navigation, contacts } = this.props;
    this.activityFeedRef = React.createRef();
    const contactName = navigation.getParam('username', '');
    const shouldOpenSheet = navigation.getParam('chatTabOpen', false);
    const contact = navigation.getParam('contact', { username: contactName });
    this.localContact = contacts.find(({ username }) => username === contact.username);
    this.scroll = React.createRef();
    this.state = {
      showManageContactModal: false,
      showConfirmationModal: false,
      manageContactType: '',
      activeTab: CHAT,
      isSheetOpen: shouldOpenSheet,
      forceOpen: shouldOpenSheet,
      collapsedChatHeight: null,
      collapsedActivityHeight: null,
      // isBadgesSectionOpen: true,
    };
  }

  componentDidMount() {
    const {
      fetchContactTransactions,
      wallet,
      syncContact,
      session,
      navigation,
    } = this.props;
    this.isComponentMounted = true;
    const contactName = navigation.getParam('username', '');
    const contact = navigation.getParam('contact', { username: contactName });
    const defaultImageCacheManager = ImageCacheManager();

    if (contact.profileImage && session.isOnline) {
      defaultImageCacheManager
        .deleteUrl(contact.profileImage, {
          useQueryParamsInCacheKey: true,
        })
        .catch(() => null);
      defaultImageCacheManager
        .deleteUrl(contact.profileLargeImage, {
          useQueryParamsInCacheKey: true,
        })
        .catch(() => null);
    }

    const localContact = this.localContact; // eslint-disable-line
    if (localContact && session.isOnline) {
      syncContact(localContact.id);
      fetchContactTransactions(wallet.address, localContact.ethAddress);
    }
  }

  componentWillUnmount() {
    this.isComponentMounted = false;
  }

  getUserAvatar = (isAccepted, url, updateTime) => {
    if (isAccepted && updateTime) {
      return `${url}?t=${updateTime}`;
    }
    return url;
  };

  showManageContactModalTrigger = () => {
    this.setState({
      showManageContactModal: true,
    });
  };

  manageContact = (manageContactType: string) => {
    this.setState({
      showManageContactModal: false,
      manageContactType,
    });

    setTimeout(() => {
      this.setState({ showConfirmationModal: true });
    }, 1000);
  };

  confirmManageAction = (status: ?string = '') => {
    // here will be called the action to manageContactType (block, disconnect, mute)
    const { navigation, contacts } = this.props;
    const {
      manageContactType,
    } = this.state;

    const contact = navigation.getParam('contact', {});
    const theContact = contacts.find(({ username }) => username === contact.username);
    if (!theContact) {
      return;
    }
    if (manageContactType === DISCONNECT) {
      this.props.disconnectContact(theContact.id);
    } else if (manageContactType === MUTE) {
      const mute = !(status === 'muted');
      this.props.muteContact(theContact.id, mute);
    } else if (manageContactType === BLOCK) {
      const block = !(status === 'blocked');
      this.props.blockContact(theContact.id, block);
    }

    setTimeout(() => {
      this.setState({
        showConfirmationModal: false,
      });
    }, 1000);
  };

  setActiveTab = (activeTab) => {
    this.setState({ activeTab });
  };

  handleSheetOpen = () => {
    this.setState({ isSheetOpen: true });
  };

  manageFeedCollapseHeight = (length: number) => {
    const { collapsedActivityHeight } = this.state;
    const TWO_ITEMS_HEIGHT = 245;
    const EMPTY_STATE_HEIGHT = 160;
    if (length && collapsedActivityHeight !== TWO_ITEMS_HEIGHT) {
      this.setState({ collapsedActivityHeight: TWO_ITEMS_HEIGHT });
    } else if (!length && collapsedActivityHeight !== EMPTY_STATE_HEIGHT) {
      this.setState({ collapsedActivityHeight: EMPTY_STATE_HEIGHT });
    }
  };

  renderBadge = ({ item }) => {
    const { navigation } = this.props;
    return (
      <BadgeTouchableItem
        data={item}
        onPress={() => navigation.navigate(BADGE, { id: item.id })}
      />
    );
  };

  renderSheetContent = (displayContact, unreadCount) => {
    const { activeTab, isSheetOpen } = this.state;
    const { navigation } = this.props;
    if (activeTab === ACTIVITY) {
      return (
        <ActivityFeed
          ref={(ref) => { this.activityFeedRef = ref; }}
          navigation={navigation}
          activeTab={TRANSACTIONS}
          additionalFiltering={data => data.filter(({ username }) => username === displayContact.username)}
          showArrowsOnly
          contentContainerStyle={{ paddingTop: 10 }}
          esComponent={(
            <View style={{ width: '100%', alignItems: 'center' }}>
              <EmptyStateParagraph
                title="Make your first step"
                bodyText="Your activity will appear here."
              />
            </View>
          )}
          getFeedLength={(length) => this.manageFeedCollapseHeight(length)}
        />
      );
    }
    return (
      <ChatTab
        contact={displayContact}
        isOpen={activeTab === CHAT && isSheetOpen}
        navigation={navigation}
        hasUnreads={!!unreadCount}
        getCollapseHeight={(cHeight) => { this.setState({ collapsedChatHeight: cHeight }); }}
      />
    );
  };

  onSendPress(contact: Object): void {
    this.props.navigation.navigate(SEND_TOKEN_FROM_CONTACT_FLOW, { contact });
  }

  // toggleBadgesSection = () => {
  //   this.setState({ isBadgesSectionOpen: !this.state.isBadgesSectionOpen });
  // };

  render() {
    const {
      navigation,
      contacts,
      fetchContactTransactions,
      wallet,
      chats,
    } = this.props;
    const {
      showManageContactModal,
      showConfirmationModal,
      manageContactType,
      activeTab,
      forceOpen,
      collapsedActivityHeight,
      collapsedChatHeight,
      // isBadgesSectionOpen,
    } = this.state;

    const contactName = navigation.getParam('username', '');
    const contact = navigation.getParam('contact', { username: contactName });
    // NOTE: we need a fresh copy of the contact here as the avatar might be changed
    const localContact = contacts.find(({ username }) => username === contact.username);
    const isAccepted = !!localContact;
    const displayContact = localContact || contact;

    // due to the fact that profileLargeImage is not being passed in connections notifications payload for now
    // profileImage is set here as a fallback so requester's avatar (if exists) would be visible
    const existingProfileImage = displayContact.profileLargeImage || displayContact.profileImage;
    const userAvatar = existingProfileImage
      ? this.getUserAvatar(isAccepted, existingProfileImage, displayContact.lastUpdateTime)
      : undefined;

    const chatInfo = chats.find(chat => chat.username === displayContact.username) || { unread: 0 };
    const unreadCount = chatInfo.unread;

    const contactTabs = [
      {
        id: CHAT,
        name: 'Chat',
        onPress: () => this.setActiveTab(CHAT),
        unread: unreadCount,
      },
      {
        id: ACTIVITY,
        name: 'Activity',
        onPress: () => this.setActiveTab(ACTIVITY),
      },
    ];

    return (
      <ContainerWithBottomSheet
        inset={{ bottom: 0 }}
        color={baseColors.white}
        hideSheet={!isAccepted}
        bottomSheetProps={{
          forceOpen,
          sheetHeight: activeTab === CHAT ? collapsedChatHeight + 140 : collapsedActivityHeight,
          swipeToCloseHeight: 62,
          onSheetOpen: this.handleSheetOpen,
          onSheetClose: () => { this.setState({ isSheetOpen: false }); },
          tabs: contactTabs,
          activeTab,
          inverse: activeTab === CHAT,
        }}
        bottomSheetChildren={
          (
            <SheetContentWrapper>
              {this.renderSheetContent(displayContact, unreadCount)}
            </SheetContentWrapper>
          )
        }
      >
        <Header
          title={displayContact.username}
          onBack={() => navigation.goBack(null)}
          showRight
          onNextPress={this.showManageContactModalTrigger}
          nextIcon={displayContact.status ? 'more' : null}
        />
        <ScrollWrapper
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={() => {
                fetchContactTransactions(wallet.address, displayContact.ethAddress);
              }}
            />
          }
          innerRef={ref => { this.scroll = ref; }}
        >
          <ContactWrapper>
            <ProfileImage
              uri={userAvatar}
              userName={displayContact.username}
              borderWidth={4}
              initialsSize={fontSizes.extraGiant}
              diameter={172}
              style={{ backgroundColor: baseColors.geyser }}
              imageUpdateTimeStamp={displayContact.lastUpdateTime}
            />
          </ContactWrapper>
          {isAccepted &&
            <React.Fragment>
              <CircleButtonsWrapper>
                <CircleButton
                  label="Send"
                  icon={iconSend}
                  onPress={() => this.onSendPress(displayContact)}
                />
              </CircleButtonsWrapper>
              { /* CONTACT'S BADGES [Commented out since we do not have endpoint to fetch them]
              <CollapsibleSection
                label="game of badges."
                sectionWrapperStyle={{ marginBottom: 25 }}
                collapseContent={
                  <FlatList
                    data={badges}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={this.renderBadge}
                    style={{ width: '100%' }}
                    contentContainerStyle={[
                      { paddingHorizontal: 10 },
                      !badges.length ? { width: '100%', justifyContent: 'center' } : {},
                      ]}
                    horizontal
                    ListEmptyComponent={
                      <EmptyStateParagraphWrapper>
                        <EmptyStateParagraph
                          title="No badges"
                          bodyText="This user has no badges yet"
                        />
                      </EmptyStateParagraphWrapper>
                    }
                    initialNumToRender={5}
                    removeClippedSubviews
                  />
                }
                onPress={this.toggleBadgesSection}
                open={isBadgesSectionOpen}
                onAnimationEnd={
                  isBadgesSectionOpen
                  ? () => { this.scroll.scrollToEnd(); }
                  : () => {}
                }
              /> */ }
            </React.Fragment>
         }
        </ScrollWrapper>
        <ManageContactModal
          showManageContactModal={showManageContactModal}
          onManageContact={this.manageContact}
          onModalHide={() => {
            this.setState({ showManageContactModal: false });
          }}
          contactStatus={displayContact.status}
        />
        <ConnectionConfirmationModal
          showConfirmationModal={showConfirmationModal}
          manageContactType={manageContactType}
          contact={displayContact}
          onConfirm={() => { this.confirmManageAction(displayContact.status); }}
          onModalHide={() => {
            this.setState({ showConfirmationModal: false });
          }}
        />
      </ContainerWithBottomSheet>
    );
  }
}

const mapStateToProps = ({
  contacts: { data: contacts },
  wallet: { data: wallet },
  chat: { data: { chats } },
  session: { data: session },
}) => ({
  contacts,
  wallet,
  chats,
  session,
});

const mapDispatchToProps = (dispatch: Function) => ({
  syncContact: userId => dispatch(syncContactAction(userId)),
  fetchContactTransactions: (walletAddress, contactAddress) => {
    dispatch(fetchContactTransactionsAction(walletAddress, contactAddress));
  },
  disconnectContact: (contactId: string) => dispatch(disconnectContactAction(contactId)),
  muteContact: (contactId: string, mute: boolean) => dispatch(muteContactAction(contactId, mute)),
  blockContact: (contactId: string, block: boolean) => dispatch(blockContactAction(contactId, block)),
});

export default connect(mapStateToProps, mapDispatchToProps)(Contact);
