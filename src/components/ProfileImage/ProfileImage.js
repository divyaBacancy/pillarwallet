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
import { ImageBackground } from 'react-native';
import styled, { css } from 'styled-components/native';

// Components
import Image from 'components/Image';

// Utils
import { getIdenticonImageUrl } from 'utils/images';
import { getColorByTheme } from 'utils/themes';

const CircleImage = styled(Image)`
  width: ${props => (props.diameter ? props.diameter : '50')}px;
  height: ${props => (props.diameter ? props.diameter : '50')}px;
  border-radius: ${props => (props.diameter ? props.diameter / 2 : '25')}px;
  ${props => (props.additionalImageStyle)};
  align-items: center;
  justify-content: center;
`;

const ImageTouchable = styled.TouchableOpacity`
  width: ${props => (props.diameter ? props.diameter : '50')}px;
  height: ${props => (props.diameter ? props.diameter : '50')}px;
  border-radius: ${props => (props.diameter ? props.diameter / 2 : '25')}px;
  display: flex;
  ${({ needBackground }) => needBackground
    && css`background-color: ${getColorByTheme({ lightCustom: '#e0eeff', darkKey: 'basic040' })};`}
  ${props => (props.additionalContainerStyle)};
  position: relative;
  border: ${({ borderWidth, borderColor }) =>
    css`${borderWidth}px solid ${borderColor
    || getColorByTheme({ lightCustom: '#e0eeff', darkKey: 'basic040' })}`};
  justify-content: center;
  align-items: center;
`;

const InnerBackground = styled.View`
  width: 100%;
  height: 100%;
  position: absolute;
  justify-content: center;
  align-items: center;
`;

const CornerIcon = styled(Image)`
  width: ${({ size }) => size}px;
  height: ${({ size }) => size}px;
  position: absolute;
  top: 0;
  right: 0;
`;

export type ProfileImageProps = {|
  uri?: ?string,
  userName?: ?string,
  containerStyle?: Object,
  imageStyle?: Object,
  onPress?: ?Function,
  diameter?: number,
  borderWidth?: number,
  borderColor?: string,
  style?: Object,
  children?: React.Node,
  fallbackImage?: string,
  cornerIcon?: Object,
  cornerIconSize?: number,
|};

const CACHED_IMAGE_REF = 'cachedImage';
const IMAGE_LOAD_FAILED = 'image_load_failed';

const ProfileImage = (props: ProfileImageProps) => {
  const {
    uri,
    containerStyle,
    imageStyle,
    onPress,
    style,
    diameter = 50,
    borderColor,
    borderWidth = 0,
    children,
    userName,
    fallbackImage,
    cornerIcon,
    cornerIconSize = 22,
  } = props;

  const diameterWithBorder = diameter + (borderWidth * 2);

  const renderDefaultImage = () => {
    if (fallbackImage) {
      return (<CircleImage source={fallbackImage} diameter={diameter} />);
    }

    return (
      <React.Fragment>
        {children && <InnerBackground>{children}</InnerBackground>}

        {!children && !!userName && (
          <CircleImage
            source={{ uri: getIdenticonImageUrl(userName, diameter) }}
            diameter={diameter}
            additionalImageStyle={imageStyle}
            fallbackSource={IMAGE_LOAD_FAILED}
          />
        )}
      </React.Fragment>
    );
  };

  const renderImage = (data: Object) => {
    if (data.source === IMAGE_LOAD_FAILED) {
      return renderDefaultImage();
    }

    return <ImageBackground imageStyle={data.style} ref={CACHED_IMAGE_REF} {...data} />;
  };

  return (
    <ImageTouchable
      additionalContainerStyle={containerStyle}
      diameter={diameterWithBorder}
      disabled={!onPress}
      onPress={onPress}
      transparent={uri}
      style={style}
      hasChildren={children}
      borderWidth={borderWidth}
      borderColor={borderColor}
      needBackground={!uri}
    >
      {!uri && renderDefaultImage()}
      {!!uri &&
      <CircleImage
        additionalImageStyle={imageStyle}
        diameter={diameter}
        renderImage={renderImage}
        fallbackSource={IMAGE_LOAD_FAILED}
        source={{ uri }}
      />
      }
      {cornerIcon && <CornerIcon source={cornerIcon} size={cornerIconSize} />}
    </ImageTouchable>
  );
};

export default ProfileImage;
