/** Mock del módulo nativo de Google Sign-In (no existe en el entorno de test). */
export const googleSignInMock = {
  GoogleSignin: {
    configure: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn().mockResolvedValue(null),
  },
  isSuccessResponse: (r: { type?: string }) => r?.type === 'success',
  isErrorWithCode: (e: unknown) => typeof (e as { code?: unknown })?.code === 'string',
  statusCodes: { SIGN_IN_CANCELLED: '-5', IN_PROGRESS: '-6', SIGN_IN_REQUIRED: '-4' },
};

export function googleSuccess(idToken: string | null) {
  return { type: 'success', data: { idToken, user: { email: 'g@example.com' } } };
}

export const googleCancelled = { type: 'cancelled', data: null };

/** Error nativo tal y como lo lanza el SDK de Google cuando se cancela. */
export function googleCancelledError() {
  return Object.assign(new Error('cancelled'), { code: googleSignInMock.statusCodes.SIGN_IN_CANCELLED });
}
