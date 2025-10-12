// lib/cookie-utils.js
"use server"
import { cookies } from "next/headers";

// Funzione per impostare un cookie
export const setCookie = async (name, value, days = 7) => {
  const expires = new Date();
  expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
  
  (await cookies()).set({ name, value, expires, path: '/', sameSite: 'lax' })
  //document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax;Secure=${window.location.protocol === 'https:'}`;
};

// Funzione per ottenere un cookie
export const getCookie = async (name) => {
  
  return (await cookies()).get(name)?.value
};

// Funzione per eliminare un cookie
export const deleteCookie = async (name) => {
  
  (await cookies()).delete(name, { path: '/' });
};

// Funzioni specifiche per l'autenticazione
export const setAuthCookie = async (token, userData) => {
  await setCookie('authToken', token, 7); // 7 giorni
  await setCookie('userData', JSON.stringify(userData), 7);
};

export const getAuthCookie = async () => {
  const token = await getCookie('authToken');
  const userDataString = await getCookie('userData');
  
  if (!token || !userDataString) return null;
  
  try {
    const userData = JSON.parse(userDataString);
    return { token, userData };
  } catch {
    return null;
  }
};

export const clearAuthCookies = async () => {
  console.log("clearing auth cookies")
    await deleteCookie('authToken');
  await deleteCookie('userData');
};