import { render, screen } from '@testing-library/react-native';
import { MeetingPointMap, regionFor } from '../src/features/meetups/components/MeetingPointMap';
import { points } from './helpers';

describe('MeetingPointMap', () => {
  it('draws the approximate area as a circle and no marker', async () => {
    await render(<MeetingPointMap point={points.approximate} />);
    const circle = screen.getByTestId('map-area');
    expect(circle.props.radius).toBe(400);
    expect(circle.props.center).toEqual({ latitude: 40.0139, longitude: -99.9861 });
    expect(screen.queryByTestId('map-marker')).toBeNull();
    expect(screen.getByText('Approximate area · ~400 m')).toBeTruthy();
  });

  it('draws the exact point as a marker titled with the place name', async () => {
    await render(<MeetingPointMap point={points.exact} />);
    const marker = screen.getByTestId('map-marker');
    expect(marker.props.coordinate).toEqual({ latitude: 40.012046, longitude: -99.984517 });
    expect(marker.props.title).toBe('North gate, Linden Park');
    expect(screen.queryByTestId('map-area')).toBeNull();
  });

  it('frames the whole circle for the approximate view', () => {
    const region = regionFor(points.approximate);
    const radiusInDegrees = 400 / 111_320;
    expect(region.latitudeDelta).toBeGreaterThan(2 * radiusInDegrees);
    expect(region.latitude).toBe(40.0139);
  });
});
