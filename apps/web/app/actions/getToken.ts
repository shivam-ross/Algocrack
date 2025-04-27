'use server';


import { cookies } from 'next/headers';

export async function getUserToken() {
  const cookieStore = cookies();
  const token = (await cookieStore).get("__Secure-next-auth.session-token")
  if (!token) {
    throw new Error("Token not found");
  }
  return token.value;
}
