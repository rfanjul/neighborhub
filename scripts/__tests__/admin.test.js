/**
 * npm run admin con un Auth falso: el claim es lo que abre la web /admin y
 * lo que comprueban las reglas, así que tiene que quedar bien puesto.
 */
const { hacerAdmin, quitarAdmin, listarAdmins } = require('../admin');

const formatoClave = /^[a-km-zA-HJ-NP-Z2-9]{4}-[a-km-zA-HJ-NP-Z2-9]{4}-[a-km-zA-HJ-NP-Z2-9]{4}$/;

function authFalsa(usuarios = {}) {
  const porEmail = { ...usuarios };
  return {
    getUserByEmail: jest.fn(async (email) => {
      if (porEmail[email]) return porEmail[email];
      throw Object.assign(new Error('no existe'), { code: 'auth/user-not-found' });
    }),
    createUser: jest.fn(async (datos) => (porEmail[datos.email] = { uid: 'nueva', email: datos.email, customClaims: null })),
    updateUser: jest.fn(async () => ({})),
    setCustomUserClaims: jest.fn(async () => {}),
    revokeRefreshTokens: jest.fn(async () => {}),
    listUsers: jest.fn(),
  };
}

describe('hacerAdmin', () => {
  it('crea la cuenta con una contraseña nueva y el claim admin', async () => {
    const auth = authFalsa();

    const r = await hacerAdmin(auth, { email: 'jefa@neighborhub.test' });

    expect(r).toEqual({ uid: 'nueva', email: 'jefa@neighborhub.test', password: expect.stringMatching(formatoClave), nueva: true });
    expect(auth.createUser).toHaveBeenCalledWith(expect.objectContaining({ email: 'jefa@neighborhub.test', password: r.password, emailVerified: true }));
    expect(auth.setCustomUserClaims).toHaveBeenCalledWith('nueva', { admin: true });
  });

  it('a una cuenta que ya existe le da el claim sin tocar su contraseña ni sus otros claims', async () => {
    const auth = authFalsa({ 'ruben@ejemplo.test': { uid: 'u1', customClaims: { beta: true } } });

    const r = await hacerAdmin(auth, { email: 'ruben@ejemplo.test' });

    expect(r.password).toBeNull();
    expect(auth.createUser).not.toHaveBeenCalled();
    expect(auth.updateUser).not.toHaveBeenCalled();
    expect(auth.setCustomUserClaims).toHaveBeenCalledWith('u1', { beta: true, admin: true });
  });

  it('con nuevaClave cambia la contraseña', async () => {
    const auth = authFalsa({ 'ruben@ejemplo.test': { uid: 'u1' } });

    const r = await hacerAdmin(auth, { email: 'ruben@ejemplo.test', nuevaClave: true });

    expect(r.password).toMatch(formatoClave);
    expect(auth.updateUser).toHaveBeenCalledWith('u1', { password: r.password });
  });

  it.each([undefined, '', 'no-es-un-correo'])('sin un email válido (%p) no hace nada', async (email) => {
    const auth = authFalsa();

    await expect(hacerAdmin(auth, { email })).rejects.toThrow('--email');
    expect(auth.createUser).not.toHaveBeenCalled();
  });

  it('otros errores de Auth no se tapan', async () => {
    const auth = authFalsa();
    auth.getUserByEmail.mockRejectedValueOnce(Object.assign(new Error('sin permiso'), { code: 'auth/insufficient-permission' }));

    await expect(hacerAdmin(auth, { email: 'jefa@neighborhub.test' })).rejects.toThrow('sin permiso');
  });
});

describe('quitarAdmin', () => {
  it('quita el claim, conserva los demás y cierra sus sesiones', async () => {
    const auth = authFalsa({ 'ruben@ejemplo.test': { uid: 'u1', customClaims: { admin: true, beta: true } } });

    expect(await quitarAdmin(auth, 'ruben@ejemplo.test')).toEqual({ uid: 'u1', email: 'ruben@ejemplo.test', eraAdmin: true });
    expect(auth.setCustomUserClaims).toHaveBeenCalledWith('u1', { beta: true });
    expect(auth.revokeRefreshTokens).toHaveBeenCalledWith('u1');
  });

  it('avisa si la cuenta no existe', async () => {
    await expect(quitarAdmin(authFalsa(), 'nadie@ejemplo.test')).rejects.toThrow('No hay ninguna cuenta');
  });
});

it('lista solo las cuentas con el claim, página a página', async () => {
  const auth = authFalsa();
  auth.listUsers
    .mockResolvedValueOnce({ users: [{ email: 'a@x.test', customClaims: { admin: true } }, { email: 'b@x.test' }], pageToken: 'p2' })
    .mockResolvedValueOnce({ users: [{ email: 'c@x.test', customClaims: { admin: true } }] });

  expect(await listarAdmins(auth)).toEqual(['a@x.test', 'c@x.test']);
});
