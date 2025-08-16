import React, { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react';
import { BackHandler } from 'react-native';
import PhotoViewer from '../components/shared/PhotoViewer';
import ProfileBottomSheet from '../components/shared/ProfileBottomSheet';

const PhotoViewerContext = createContext();

export const usePhotoViewer = () => {
  const context = useContext(PhotoViewerContext);
  if (!context) {
    throw new Error('usePhotoViewer must be used within a PhotoViewerProvider');
  }
  return context;
};

export const PhotoViewerProvider = ({ children }) => {
  const photoViewerRef = useRef(null);
  const profileBottomSheetRef = useRef(null);

  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);
  const [photoViewerIntentionallyOpen, setPhotoViewerIntentionallyOpen] = useState(false);
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);

  const [photoViewerState, setPhotoViewerState] = useState({
    photos: [],
    initialIndex: 0,
    showActions: false,
    title: 'Photo',
    onSetMain: null,
    onDelete: null,
    actionButtons: [],
  });

  const [profileSheetState, setProfileSheetState] = useState({
    profile: null,
    actionButtons: [],
  });

  // Close photo viewer
  const closePhotoViewer = useCallback(() => {
    setPhotoViewerOpen(false);
    setPhotoViewerIntentionallyOpen(false);
    photoViewerRef.current?.close();
  }, []);

  // Close profile sheet
  const closeProfileSheet = useCallback(() => {
    setProfileSheetOpen(false);
    profileBottomSheetRef.current?.close();
  }, []);

  // Handle hardware back button
  useEffect(() => {
    const backAction = () => {
      // Close PhotoViewer if it's open (state-based, reliable)
      if (photoViewerOpen) {
        closePhotoViewer();
        return true; // Prevent default back behavior
      }

      // Close ProfileSheet if it's open
      if (profileSheetOpen) {
        closeProfileSheet();
        return true; // Prevent default back behavior
      }
      return false; // Allow default back behavior
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

    return () => backHandler.remove();
  }, [photoViewerOpen, profileSheetOpen, closePhotoViewer, closeProfileSheet]);

  // Open photo viewer with full-screen bottom sheet
  const openPhotoViewer = ({
    photos = [],
    initialIndex = 0,
    showActions = false,
    title = 'Photo',
    onSetMain = null,
    onDelete = null,
    actionButtons = [],
  }) => {
    setPhotoViewerState({
      photos,
      initialIndex,
      showActions,
      title,
      onSetMain,
      onDelete,
      actionButtons,
    });

    // Set state to open BEFORE calling open to ensure back handler works
    setPhotoViewerOpen(true);

    // Open the viewer with a small delay to ensure state is set
    setTimeout(() => {
      photoViewerRef.current?.open(initialIndex);

      // Set intentionallyOpen after a longer delay to avoid spurious onClose during opening
      setTimeout(() => {
        setPhotoViewerIntentionallyOpen(true);
      }, 200);
    }, 50);
  };

  // Open profile bottom sheet
  const openProfileSheet = ({ profile, actionButtons = [] }) => {
    setProfileSheetState({ profile, actionButtons });
    setProfileSheetOpen(true);
    profileBottomSheetRef.current?.open();
  };

  const contextValue = {
    openPhotoViewer,
    openProfileSheet,
    closePhotoViewer,
    closeProfileSheet,
  };

  return (
    <PhotoViewerContext.Provider value={contextValue}>
      {children}

      {/* Global Photo Viewer - renders at app level */}
      <PhotoViewer
        ref={photoViewerRef}
        photos={photoViewerState.photos}
        initialPhotoIndex={photoViewerState.initialIndex}
        showActions={photoViewerState.showActions}
        title={photoViewerState.title}
        onSetMain={photoViewerState.onSetMain}
        onDelete={photoViewerState.onDelete}
        actionButtons={photoViewerState.actionButtons}
        onClose={() => {
          // Only update state if PhotoViewer is actually open to prevent spurious closes
          if (photoViewerOpen && photoViewerIntentionallyOpen) {
            setPhotoViewerOpen(false);
            setPhotoViewerIntentionallyOpen(false);
          }
        }}
      />

      {/* Global Profile Bottom Sheet - renders at app level */}
      <ProfileBottomSheet
        ref={profileBottomSheetRef}
        profile={profileSheetState.profile}
        showActions={true}
        actionButtons={profileSheetState.actionButtons}
        onClose={closeProfileSheet}
      />
    </PhotoViewerContext.Provider>
  );
};

export default PhotoViewerProvider;
