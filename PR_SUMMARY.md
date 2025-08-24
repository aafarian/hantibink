# Pull Request Summary

## Changes Made

### 1. Fixed Dropdown Value Casing Issue

- **Problem**: Dropdown values (smoking, drinking) were being converted to lowercase when saved, causing inconsistent display
- **Solution**:
  - Removed `toLowerCase()` conversion in API to preserve original casing
  - Added capitalization helper to properly display existing lowercase data
- **Files Changed**:
  - `api/src/services/authService.js` - Removed lowercase conversion
  - `mobile/src/components/profile/ProfileFieldsConfig.js` - Added capitalization helper for backward compatibility

### 2. Improved Form Validation UX

- **Problem**: Both Save and Discard buttons disappeared when validation errors occurred
- **Solution**: Keep Discard button visible during validation errors so users can revert changes
- **Implementation**:
  - Added separate `hasFormChanges` state to track any changes
  - Show Discard button when `hasFormChanges` is true
  - Show Save button only when changes exist AND no validation errors
- **Files Changed**:
  - `mobile/src/screens/ProfileEditScreen.js` - Added dual state tracking
  - `mobile/src/components/profile/ProfileForm.js` - Pass raw form data for proper change detection

### 3. Database Schema Updates

- **Change**: Removed enum constraints on `relationshipType`, `smoking`, and `drinking` fields
- **Reason**: Allow flexibility for UI value changes without database migrations
- **Note**: Migration already applied to production database

## Testing

- Mobile app tested locally with changes
- Dropdown values now maintain proper casing (both new and existing data)
- Form validation UX improved - users can discard changes during error state
- Backward compatibility maintained for existing lowercase data

## Breaking Changes

None - all changes are backward compatible

## Key Files Modified

- `api/src/services/authService.js` - Fixed casing preservation
- `mobile/src/components/profile/ProfileFieldsConfig.js` - Added backward compatibility
- `mobile/src/components/profile/ProfileForm.js` - Fixed data passing
- `mobile/src/screens/ProfileEditScreen.js` - Improved validation UX
