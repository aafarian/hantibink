import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';

/**
 * Verification seal shown next to a verified user's name.
 *
 * @param {Object} props
 * @param {number} [props.size=16] - Icon size in points
 * @param {Object} [props.style] - Optional style applied to the icon
 */
const VerifiedBadge = ({ size = 16, style }) => (
  <MaterialCommunityIcons
    name="check-decagram"
    size={size}
    color={theme.colors.secondaryLight}
    style={style}
    testID="verified-badge"
  />
);

export default VerifiedBadge;
