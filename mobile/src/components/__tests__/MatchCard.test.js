import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { MatchCard } from '../MatchCard';

jest.mock('../../contexts/PhotoViewerContext', () => ({
  usePhotoViewer: () => ({
    openProfileSheet: jest.fn(),
    openPhotoViewer: jest.fn(),
  }),
}));

jest.mock('../../contexts/FeatureFlagsContext', () => ({
  useIsPremium: () => false,
}));

const baseMatch = {
  matchId: 'match-1',
  otherUser: {
    id: 'user-2',
    name: 'Ani',
    birthDate: '1999-01-15',
    location: 'Yerevan',
    photos: [{ url: 'https://example.com/photo.jpg', isMain: true }],
    mainPhotoUrl: 'https://example.com/photo.jpg',
    lastActive: new Date().toISOString(),
  },
};

describe('MatchCard', () => {
  it('renders the other user name', () => {
    render(<MatchCard match={baseMatch} onPress={jest.fn()} />);
    expect(screen.getByText(/Ani/)).toBeTruthy();
  });

  it('shows the unread badge only when there are unread messages', () => {
    const { rerender } = render(
      <MatchCard match={baseMatch} onPress={jest.fn()} unreadCount={3} />
    );
    expect(screen.getByText('3')).toBeTruthy();

    rerender(<MatchCard match={baseMatch} onPress={jest.fn()} unreadCount={0} />);
    expect(screen.queryByText('3')).toBeNull();
  });

  it('tolerates a match object without otherUser (self-shaped payload)', () => {
    const flat = { ...baseMatch.otherUser, matchId: 'match-2' };
    render(<MatchCard match={flat} onPress={jest.fn()} />);
    expect(screen.getByText(/Ani/)).toBeTruthy();
  });
});
