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
import 'utils/setup';
import * as React from 'react';
import Intercom from 'react-native-intercom';
import { StatusBar, NetInfo, AppState, Platform, Linking, Text, TouchableOpacity } from 'react-native';
import SplashScreen from 'react-native-splash-screen';
import { Provider, connect } from 'react-redux';
import { Sentry } from 'react-native-sentry';
import { PersistGate } from 'redux-persist/lib/integration/react';
import styled, { ThemeProvider } from 'styled-components/native';
import { SENTRY_DSN, BUILD_TYPE, SHOW_THEME_TOGGLE, SHOW_ONLY_STORYBOOK } from 'react-native-dotenv';
import { AppearanceProvider } from 'react-native-appearance';

// actions
import { initAppAndRedirectAction } from 'actions/appActions';
import { updateSessionNetworkStatusAction } from 'actions/sessionActions';
import { updateOfflineQueueNetworkStatusAction } from 'actions/offlineApiActions';
import {
  startListeningOnOpenNotificationAction,
  stopListeningOnOpenNotificationAction,
} from 'actions/notificationsActions';
import { executeDeepLinkAction } from 'actions/deepLinkActions';
import { startReferralsListenerAction, stopReferralsListenerAction } from 'actions/referralsActions';
import { setAppThemeAction, handleSystemDefaultThemeChangeAction } from 'actions/appSettingsActions';

// constants
import { DARK_THEME, LIGHT_THEME } from 'constants/appSettingsConstants';

// components
import { Container } from 'components/Layout';
import Root from 'components/Root';
import Toast from 'components/Toast';
import Spinner from 'components/Spinner';
import Walkthrough from 'components/Walkthrough';

// utils
import { getThemeByType, defaultTheme } from 'utils/themes';

// services
import { setTopLevelNavigator } from 'services/navigation';

// types
import type { RootReducerState, Dispatch } from 'reducers/rootReducer';
import type { Steps } from 'reducers/walkthroughsReducer';

// other
import RootNavigation from 'navigation/rootNavigation';
import Storybook from 'screens/Storybook';
import configureStore from './src/configureStore';

const { store, persistor } = configureStore();

export const LoadingSpinner = styled(Spinner)`
  padding: 10px;
  align-items: center;
  justify-content: center;
`;

type Props = {
  dispatch: Dispatch,
  isFetched: boolean,
  fetchAppSettingsAndRedirect: (appState: string, platform: string) => void,
  updateSessionNetworkStatus: (isOnline: boolean) => void,
  updateOfflineQueueNetworkStatus: (isOnline: boolean) => void,
  startListeningOnOpenNotification: () => void,
  stopListeningOnOpenNotification: () => void,
  executeDeepLink: (deepLinkUrl: string) => void,
  activeWalkthroughSteps: Steps,
  themeType: string,
  startReferralsListener: () => void,
  stopReferralsListener: () => void,
  setAppTheme: (themeType: string) => void,
  isManualThemeSelection: boolean,
  handleSystemDefaultThemeChange: () => void,
}

class App extends React.Component<Props, *> {
  constructor(props: Props) {
    super(props);
    if (!__DEV__) {
      Sentry.config(SENTRY_DSN).install();
      Sentry.setTagsContext({
        environment: BUILD_TYPE,
      });
    }
  }

  componentWillMount() {
    Intercom.setInAppMessageVisibility('GONE'); // prevent messanger launcher to appear
  }

  componentWillUnmount() {
    const { stopListeningOnOpenNotification, stopReferralsListener } = this.props;
    stopReferralsListener();
    stopListeningOnOpenNotification();
    NetInfo.isConnected.removeEventListener('connectionChange', this.handleConnectivityChange);
    Linking.removeEventListener('url', this.handleDeepLinkEvent);
  }

  async componentDidMount() {
    const {
      fetchAppSettingsAndRedirect,
      startListeningOnOpenNotification,
      executeDeepLink,
      startReferralsListener,
    } = this.props;
    startReferralsListener();
    const isOnline = await NetInfo.isConnected.fetch();
    this.setOnlineStatus(isOnline); // set initial online status
    fetchAppSettingsAndRedirect(AppState.currentState, Platform.OS);
    StatusBar.setBarStyle('dark-content');
    if (Platform.OS === 'android') {
      StatusBar.setTranslucent(true);
      StatusBar.setBackgroundColor('transparent');
    }
    NetInfo.isConnected.addEventListener('connectionChange', this.handleConnectivityChange);
    Linking.getInitialURL()
      .then(url => {
        if (url) executeDeepLink(url);
      })
      .catch(() => {});
    Linking.addEventListener('url', this.handleDeepLinkEvent);
    startListeningOnOpenNotification();
  }

  componentDidUpdate(prevProps: Props) {
    const { isFetched, handleSystemDefaultThemeChange } = this.props;
    const { isFetched: prevIsFetched } = prevProps;
    if (isFetched && !prevIsFetched) {
      SplashScreen.hide();
      handleSystemDefaultThemeChange();
    }
  }

  setOnlineStatus = isOnline => {
    const {
      updateSessionNetworkStatus,
      updateOfflineQueueNetworkStatus,
    } = this.props;
    updateSessionNetworkStatus(isOnline);
    updateOfflineQueueNetworkStatus(isOnline);
  };

  handleConnectivityChange = isOnline => {
    this.setOnlineStatus(isOnline);
    if (!isOnline) {
      Toast.show({
        message: 'No active internet connection found!',
        type: 'warning',
        title: 'Connection Issue',
        autoClose: false,
      });
    } else {
      Toast.close();
    }
  };

  handleDeepLinkEvent = event => {
    const { executeDeepLink } = this.props;
    const { url: deepLink } = event;
    if (deepLink === undefined) return;
    executeDeepLink(deepLink);
  };

  render() {
    const {
      isFetched,
      themeType,
      setAppTheme,
      activeWalkthroughSteps,
    } = this.props;
    const theme = getThemeByType(themeType);
    const { colors, current } = theme;

    if (!isFetched) return null;

    return (
      <AppearanceProvider>
        <ThemeProvider theme={theme}>
          <React.Fragment>
            <Root>
              <RootNavigation
                ref={(node) => {
                  if (!node) return;
                  setTopLevelNavigator(node);
                }}
              />
              {!!SHOW_THEME_TOGGLE &&
              <TouchableOpacity
                style={{
                  padding: 20,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: 'center',
                  backgroundColor: colors.card,
                }}
                onPress={() => {
                  const themeToChangeTo = current === LIGHT_THEME ? DARK_THEME : LIGHT_THEME;
                  setAppTheme(themeToChangeTo);
                }}
              >
                <Text style={{ color: colors.text }}>{`THEME: ${current}`}</Text>
              </TouchableOpacity>}
              {!!activeWalkthroughSteps.length && <Walkthrough steps={activeWalkthroughSteps} />}
            </Root>
          </React.Fragment>
        </ThemeProvider>
      </AppearanceProvider>
    );
  }
}

const mapStateToProps = ({
  appSettings: { isFetched, data: { themeType, isManualThemeSelection } },
  walkthroughs: { steps: activeWalkthroughSteps },
}: RootReducerState): $Shape<Props> => ({
  isFetched,
  themeType,
  isManualThemeSelection,
  activeWalkthroughSteps,
});

const mapDispatchToProps = (dispatch: Dispatch): $Shape<Props> => ({
  fetchAppSettingsAndRedirect: (appState: string, platform: string) =>
    dispatch(initAppAndRedirectAction(appState, platform)),
  updateSessionNetworkStatus: (isOnline: boolean) => dispatch(updateSessionNetworkStatusAction(isOnline)),
  updateOfflineQueueNetworkStatus: (isOnline: boolean) => dispatch(updateOfflineQueueNetworkStatusAction(isOnline)),
  startListeningOnOpenNotification: () => dispatch(startListeningOnOpenNotificationAction()),
  stopListeningOnOpenNotification: () => dispatch(stopListeningOnOpenNotificationAction()),
  startReferralsListener: () => dispatch(startReferralsListenerAction()),
  stopReferralsListener: () => dispatch(stopReferralsListenerAction()),
  executeDeepLink: (deepLink: string) => dispatch(executeDeepLinkAction(deepLink)),
  setAppTheme: (themeType: string) => dispatch(setAppThemeAction(themeType)),
  handleSystemDefaultThemeChange: () => dispatch(handleSystemDefaultThemeChangeAction()),
});

const AppWithNavigationState = connect(mapStateToProps, mapDispatchToProps)(App);

const AppRoot = () => (
  <Provider store={store}>
    <PersistGate loading={<Container defaultTheme={defaultTheme}><LoadingSpinner /></Container>} persistor={persistor}>
      {SHOW_ONLY_STORYBOOK ? <Storybook /> : <AppWithNavigationState />}
    </PersistGate>
  </Provider>
);

export default AppRoot;
