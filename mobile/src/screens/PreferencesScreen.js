import React from 'react';
import FilterPreferencesForm from '../components/shared/FilterPreferencesForm';

const PreferencesScreen = ({ navigation }) => {
  return (
    <FilterPreferencesForm
      navigation={navigation}
      headerTitle="Preferences"
      buttonText="Save Preferences"
      showReset={false}
    />
  );
};

export default PreferencesScreen;
