/** Mock ESM `jose` pour Jest e2e (jetons HS256 via jsonwebtoken uniquement). */
export const createRemoteJWKSet = () => ({});

export async function jwtVerify() {
  return { payload: { sub: "mock" } };
}
