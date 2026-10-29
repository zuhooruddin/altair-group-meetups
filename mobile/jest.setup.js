/* eslint-disable no-undef */
// Native map views cannot render under Jest: stand them in with plain Views
// that keep their props, so tests can assert what would be drawn.
jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  const make = (name) => {
    const Component = (props) => React.createElement(View, { ...props, testID: props.testID ?? name }, props.children);
    Component.displayName = name;
    return Component;
  };
  return { __esModule: true, default: make('MapView'), Marker: make('Marker'), Circle: make('Circle') };
});

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

jest.mock('@react-native-community/datetimepicker', () => {
  const Picker = () => null;
  Picker.displayName = 'DateTimePicker';
  return { __esModule: true, default: Picker, DateTimePickerAndroid: { open: jest.fn() } };
});
