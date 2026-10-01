import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import PhotoCaptureModal from '../PhotoCaptureModal';

let mockPermiso: { granted: boolean } | null = { granted: true };
const mockPedirPermiso = jest.fn();
const mockTakePicture = jest.fn();

jest.mock('expo-camera', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    useCameraPermissions: () => [mockPermiso, mockPedirPermiso],
    CameraView: React.forwardRef((_props: object, ref: React.Ref<unknown>) => {
      React.useImperativeHandle(ref, () => ({ takePictureAsync: mockTakePicture }));
      return <View />;
    }),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockPermiso = { granted: true };
  mockTakePicture.mockResolvedValue({ uri: 'file:///cara.jpg' });
});

describe('PhotoCaptureModal', () => {
  it('pide permiso si aún no lo hay', async () => {
    mockPermiso = { granted: false };
    await render(<PhotoCaptureModal visible onClose={jest.fn()} onCaptured={jest.fn()} />);

    await fireEvent.press(screen.getByText('Allow camera access'));

    expect(mockPedirPermiso).toHaveBeenCalled();
  });

  it('hace la foto, la entrega y se cierra', async () => {
    const onCaptured = jest.fn(async () => undefined);
    const onClose = jest.fn();
    await render(<PhotoCaptureModal visible onClose={onClose} onCaptured={onCaptured} />);

    await act(async () => {
      await fireEvent.press(screen.getByLabelText('Take photo'));
    });

    expect(onCaptured).toHaveBeenCalledWith('file:///cara.jpg');
    expect(onClose).toHaveBeenCalled();
  });

  it('avisa si falla y no se cierra', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const onClose = jest.fn();
    await render(
      <PhotoCaptureModal visible onClose={onClose} onCaptured={jest.fn(async () => { throw new Error('subida fallida'); })} />
    );

    await act(async () => {
      await fireEvent.press(screen.getByLabelText('Take photo'));
    });

    await waitFor(() => expect(alerta).toHaveBeenCalledWith("Couldn't update your photo", 'subida fallida'));
    expect(onClose).not.toHaveBeenCalled();
    alerta.mockRestore();
  });

  it('se cierra con la X', async () => {
    const onClose = jest.fn();
    await render(<PhotoCaptureModal visible onClose={onClose} onCaptured={jest.fn()} />);

    await fireEvent.press(screen.getByLabelText('Close'));

    expect(onClose).toHaveBeenCalled();
  });
});
