import React, { useMemo } from 'react';
import FilterPreferencesForm from '../components/shared/FilterPreferencesForm';

const FilterScreen = ({ navigation, route }) => {
  const currentFilters = useMemo(
    () => route?.params?.userPreferences || {},
    [route?.params?.userPreferences]
  );
  const onSaveCallback = route?.params?.onSavePreferences;

  return (
    <FilterPreferencesForm
      navigation={navigation}
      headerTitle="Filters"
      buttonText="Apply Filters"
      showReset={true}
      onSave={onSaveCallback}
      initialFilters={currentFilters}
    />
  );
};

export default FilterScreen;
