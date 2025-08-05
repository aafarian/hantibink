import { useNavigation } from '@react-navigation/native';
import Logger from '../utils/logger';

export const useTabNavigation = () => {
  const navigation = useNavigation();

  const navigateToTab = (tabName, params = {}) => {
    try {
      // Try to get the parent navigator (tab navigator)
      const parentNav = navigation.getParent();
      if (parentNav) {
        parentNav.navigate(tabName, params);
        Logger.success(`✅ Navigated to ${tabName} tab via parent`);
        return { success: true, method: 'parent' };
      }

      // Fallback to direct navigation
      navigation.navigate(tabName, params);
      Logger.success(`✅ Navigated to ${tabName} tab directly`);
      return { success: true, method: 'direct' };
    } catch (error) {
      // Final fallback - try jumpTo for tab navigation (without params)
      try {
        navigation.jumpTo(tabName);
        Logger.success(`✅ Jumped to ${tabName} tab`);
        return { success: true, method: 'jumpTo' };
      } catch (jumpError) {
        Logger.error(`❌ All navigation methods failed for ${tabName}:`, { error, jumpError });
        return {
          success: false,
          error: `Failed to navigate to ${tabName}`,
          originalError: error,
        };
      }
    }
  };

  const navigateToMessages = () => navigateToTab('Messages');
  const navigateToPeople = () => navigateToTab('People');
  const navigateToProfile = () => navigateToTab('Profile');
  const navigateToLikedYou = () => navigateToTab('Liked You');

  return {
    navigateToTab,
    navigateToMessages,
    navigateToPeople,
    navigateToProfile,
    navigateToLikedYou,
  };
};
