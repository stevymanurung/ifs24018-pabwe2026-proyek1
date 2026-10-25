export function validateAuthResponse(result) {
  if (!result?.token || !result?.user) {
    throw new Error('Respons login dari server tidak lengkap. Coba lagi.');
  }
  return result;
}
